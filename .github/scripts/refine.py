#!/usr/bin/env python3
"""Requirement refinement automation: GitHub issues <-> Claude <-> Slack.

Usage:
  refine.py kickoff <issue_number>   # issue labelled needs-refinement -> open Slack thread
  refine.py sync                     # follow every in-refinement thread

Follows docs/refinement-workflow.md (the playbook is also sent to Claude as its instructions).
"""
import json
import os
import re
import sys
import time

import requests

REPO = os.environ.get("GITHUB_REPOSITORY", "iebouihi/aisdlc-gh-claude-slack")
CHANNEL = os.environ.get("SLACK_CHANNEL_ID", "")
APPROVER = os.environ.get("SLACK_APPROVER_ID", "")
MODEL = os.environ.get("CLAUDE_MODEL") or "claude-sonnet-5-5"
PLAYBOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "refinement-workflow.md")

NEEDS, IN_REF, READY, BLOCKED = "needs-refinement", "in-refinement", "ready-for-dev", "blocked"
THREAD_RE = re.compile(r"<!-- slack-thread: (\w+)/([\d.]+) -->")
PROPOSAL_RE = re.compile(r"<!-- proposal: ([\d.]+) -->\s*.*?<!-- body-start -->\n(.*?)\n<!-- body-end -->", re.S)
APPROVE_EMOJI = {"white_check_mark", "heavy_check_mark"}
NUDGE_MARK = "⏰"
DAY = 86400
NUDGE_AFTER = 3 * DAY

GROUPS = ["Scope", "Behaviour & edge cases", "Data", "UX", "Non-functional", "Dependencies & risks"]


# ---------- API helpers ----------

def gh(method, path, **kw):
    r = requests.request(
        method, f"https://api.github.com/repos/{REPO}{path}",
        headers={"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
                 "Accept": "application/vnd.github+json"},
        timeout=30, **kw)
    if method == "DELETE" and r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json() if r.content else None


def slack(method, **params):
    r = requests.post(f"https://slack.com/api/{method}",
                      headers={"Authorization": f"Bearer {os.environ['SLACK_BOT_TOKEN'].strip()}"},
                      data=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(f"Slack {method} failed: {data.get('error')}")
    return data


def ask_claude(instruction, tool):
    import anthropic
    with open(PLAYBOOK) as f:
        playbook = f.read()
    system = ("You are Claude, facilitating requirement refinement for the good-habit-tracker app "
              "(a small static Next.js habit tracker, browser storage only). Follow this playbook exactly.\n\n"
              + playbook +
              "\n\nWrite Slack text in Slack mrkdwn (*bold*, _italic_, <url|label>), never **double asterisks**.")
    # Forced tool_choice isn't supported by every model, so ask for the tool call and retry once.
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": instruction + f"\n\nRespond only by calling the `{tool['name']}` tool."}]
    for _ in range(2):
        msg = client.messages.create(model=MODEL, max_tokens=8000, system=system, tools=[tool],
                                     tool_choice={"type": "auto"}, messages=messages)
        for block in msg.content:
            if block.type == "tool_use" and block.name == tool["name"]:
                return block.input
        messages += [{"role": "assistant", "content": msg.content},
                     {"role": "user", "content": f"Please call the `{tool['name']}` tool now with your answer."}]
    raise RuntimeError("Claude returned no structured output")


# ---------- small utilities ----------

def labels_of(issue):
    return {lbl["name"] for lbl in issue["labels"]}


def swap_label(n, remove=(), add=()):
    for name in remove:
        gh("DELETE", f"/issues/{n}/labels/{name}")
    if add:
        gh("POST", f"/issues/{n}/labels", json={"labels": list(add)})


def comment(n, body):
    gh("POST", f"/issues/{n}/comments", json={"body": body})


def post(text, thread_ts=None):
    params = {"channel": CHANNEL, "text": text, "unfurl_links": "false"}
    if thread_ts:
        params["thread_ts"] = thread_ts
    return slack("chat.postMessage", **params)["ts"]


def permalink(channel, ts):
    return slack("chat.getPermalink", channel=channel, message_ts=ts)["permalink"]


_names = {}


def user_name(uid):
    if uid not in _names:
        try:
            u = slack("users.info", user=uid)["user"]
            _names[uid] = u.get("real_name") or u.get("name") or uid
        except Exception:
            _names[uid] = uid
    return _names[uid]


def issue_text(issue):
    return f"Issue #{issue['number']}: {issue['title']}\nURL: {issue['html_url']}\n\n{issue.get('body') or '(empty)'}"


# ---------- step 2: kick-off ----------

KICKOFF_TOOL = {
    "name": "kickoff",
    "description": "Open the refinement of a requirement.",
    "input_schema": {
        "type": "object",
        "properties": {
            "restatement": {"type": "string", "description": "One short paragraph restating the requirement in plain words."},
            "questions": {
                "type": "string",
                "description": ("3 to 15 questions, ONE PER LINE, each formatted exactly as\n"
                                "<group> :: <question> :: <proposed default answer>\n"
                                f"where <group> is one of: {', '.join(GROUPS)}. Plain text, no JSON, no numbering."),
            },
        },
        "required": ["restatement", "questions"],
    },
}


def _question(group, question, default=""):
    group = group.strip() if group and group.strip() in GROUPS else "Other"
    return {"group": group, "question": question.strip(), "default": (default or "").strip()}


def parse_questions(raw):
    """Parse 'group :: question :: default' lines; also tolerates a list or JSON (even slightly broken)."""
    if isinstance(raw, list):
        items = raw
    else:
        text = str(raw or "")
        try:
            items = json.loads(text)
        except ValueError:
            items = text.splitlines()
    result = []
    for item in items:
        if isinstance(item, dict):
            if item.get("question"):
                result.append(_question(item.get("group", ""), str(item["question"]), str(item.get("default") or "")))
            continue
        line = str(item).strip().strip(",")
        if not line or line in "[]{}":
            continue
        if line.startswith("{"):  # a JSON object on its own line, possibly with a typo
            fields = dict(re.findall(r'"(group|question|default)"\s*:\s*"((?:[^"\\]|\\.)*)"', line))
            if fields.get("question"):
                result.append(_question(fields.get("group", ""), fields["question"], fields.get("default", "")))
            continue
        line = re.sub(r"^\s*(\d+[.)]|[-*•])\s*", "", line)
        parts = [p.strip() for p in line.split("::")]
        if len(parts) >= 3:
            result.append(_question(parts[0], parts[1], " :: ".join(parts[2:])))
        elif len(parts) == 2:
            result.append(_question(parts[0], parts[1]) if parts[0] in GROUPS else _question("", parts[0], parts[1]))
        else:
            result.append(_question("", parts[0]))
    return result


def kickoff(n):
    issue = gh("GET", f"/issues/{n}")
    if NEEDS not in labels_of(issue) or issue["state"] != "open":
        print(f"#{n}: not labelled {NEEDS} (or closed) - skipping")
        return
    out = ask_claude("Open the refinement for this requirement. Ask only the questions that matter "
                     "for this issue, each with a sensible default.\n\n" + issue_text(issue), KICKOFF_TOOL)

    questions = parse_questions(out.get("questions"))
    if not questions:
        raise RuntimeError(f"Claude returned no usable questions: {str(out.get('questions'))[:300]}")

    # Build everything before posting, so a failure never leaves a half-finished thread
    lines, i = [f"*Open questions for #{n}* (proposed default in _italics_)"], 0
    for group in GROUPS + ["Other"]:
        qs = [q for q in questions if q["group"] == group]
        if qs:
            lines.append(f"\n*{group}*")
        for q in qs:
            i += 1
            lines.append(f"{i}. {q['question']}" + (f" _{q['default']}_" if q["default"] else ""))
    lines.append("\nWhen these are settled I'll post a 📋 proposed final requirement for ✅.")

    parent = post(f"🧩 *Refinement: #{n} {issue['title']}*\n<{issue['html_url']}|View issue #{n} on GitHub>\n\n"
                  f"{out.get('restatement', '')}\n\nQuestions are in the thread 👇 Answer by number (e.g. \"3: yes\"). "
                  "Each has a proposed default, so \"ok\" works too.")
    post("\n".join(lines), thread_ts=parent)

    comment(n, f"Refinement started in Slack: {permalink(CHANNEL, parent)}\n\n<!-- slack-thread: {CHANNEL}/{parent} -->")
    swap_label(n, remove=[NEEDS], add=[IN_REF])
    print(f"#{n}: kicked off, thread {parent}")


# ---------- steps 3-7: follow the thread ----------

SYNC_TOOL = {
    "name": "next_step",
    "description": "Decide the next step in the refinement thread.",
    "input_schema": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["wait", "follow_up", "propose"],
                       "description": "wait: nothing useful to add yet. follow_up: ask about conflicts/gaps. "
                                      "propose: every question is answered (or a requested change is clear)."},
            "slack_message": {"type": "string", "description": "follow_up: the reply. propose: the final requirement, formatted for Slack."},
            "final_requirement": {"type": "string", "description": "propose only: the new GitHub issue body in the playbook's Final requirement format (GitHub markdown)."},
        },
        "required": ["action"],
    },
}


def sync():
    bot = slack("auth.test")["user_id"]
    issues = gh("GET", f"/issues?labels={IN_REF}&state=open&per_page=100")
    print(f"{len(issues)} issue(s) in refinement")
    for issue in issues:
        try:
            sync_issue(issue, bot)
        except Exception as e:  # one broken issue must not stop the others
            print(f"::error title=Sync failed for #{issue['number']}::{type(e).__name__}: {e}".replace("\n", " "))


def sync_issue(issue, bot):
    n = issue["number"]
    comments = gh("GET", f"/issues/{n}/comments?per_page=100")
    # latest thread wins: an issue sent back to needs-refinement gets a fresh thread
    thread = next((m for c in reversed(comments) if (m := THREAD_RE.search(c["body"]))), None)
    if not thread:
        print(f"#{n}: no Slack thread recorded - skipping")
        return
    channel, root = thread.groups()
    msgs = slack("conversations.replies", channel=channel, ts=root, limit=200)["messages"]
    is_bot = lambda m: m.get("user") == bot or "bot_id" in m
    bot_ts = [float(m["ts"]) for m in msgs if is_bot(m)]
    last_bot = max(bot_ts, default=0.0)
    new_human = [m for m in msgs if not is_bot(m) and float(m["ts"]) > last_bot]
    proposals = [(ts, body) for c in comments for ts, body in PROPOSAL_RE.findall(c["body"])]
    proposal = proposals[-1] if proposals else None

    # Step 5/6: latest bot message is the proposal and nobody asked for changes -> check approval
    if proposal and float(proposal[0]) >= last_bot and not new_human:
        reacts = slack("reactions.get", channel=channel, timestamp=proposal[0]).get("message", {}).get("reactions", [])
        if any(r["name"] in APPROVE_EMOJI and APPROVER in r.get("users", []) for r in reacts):
            write_back(issue, channel, root, proposal[1])
        else:
            print(f"#{n}: proposal waiting for ✅")
        return

    if not new_human:
        nudge_or_block(issue, msgs, root)
        return

    if BLOCKED in labels_of(issue):
        swap_label(n, remove=[BLOCKED])
    transcript = "\n\n".join(f"[{'Claude' if is_bot(m) else user_name(m.get('user', '?'))}] {m.get('text', '')}" for m in msgs)
    link = permalink(channel, root)
    out = ask_claude(
        f"{issue_text(issue)}\n\nSlack thread so far ({link}):\n\n{transcript}\n\n"
        "Decide the next step. Use only answers the team gave or defaults someone explicitly accepted "
        "(\"ok\", \"rest ok\" accepts the remaining defaults). If anything is unanswered or contradictory, follow_up. "
        f"If proposing, the Refinement trace must link {link} and say 'Approved by: (pending)'.",
        SYNC_TOOL)

    if out["action"] == "follow_up" and out.get("slack_message"):
        post(out["slack_message"], thread_ts=root)
        print(f"#{n}: follow-up posted")
    elif out["action"] == "propose" and out.get("final_requirement"):
        ts = post("📋 *PROPOSED FINAL REQUIREMENT*\n\n" + clean_proposal(out.get("slack_message") or out["final_requirement"])
                  + "\n\nReact ✅ to approve, or reply with changes.", thread_ts=root)
        comment(n, f"<!-- proposal: {ts} -->\nProposed final requirement posted for approval: {permalink(channel, ts)}\n\n"
                   f"<details><summary>Proposed issue body</summary>\n\n<!-- body-start -->\n{out['final_requirement']}\n<!-- body-end -->\n\n</details>")
        print(f"#{n}: proposal posted")
    else:
        print(f"#{n}: waiting")


def clean_proposal(text):
    """Drop the header and approval prompt if Claude wrote them too (the script adds its own)."""
    keep = [line for line in text.strip().splitlines()
            if "PROPOSED FINAL REQUIREMENT" not in line.upper()
            and not re.match(r"^\s*_?react\s*(✅|:white_check_mark:|:heavy_check_mark:)", line, re.I)]
    return "\n".join(keep).strip()


def nudge_or_block(issue, msgs, root):
    n, last = issue["number"], msgs[-1]
    if time.time() - float(last["ts"]) < NUDGE_AFTER or BLOCKED in labels_of(issue):
        return
    if NUDGE_MARK in last.get("text", ""):
        swap_label(n, add=[BLOCKED])
        post(f"🚧 No answers for 6 days - #{n} is now marked *blocked*. Reply here to resume.", thread_ts=root)
        print(f"#{n}: blocked")
    else:
        post(f"{NUDGE_MARK} Friendly nudge: some questions above are still open. Answer by number, or \"rest ok\" to accept the defaults.", thread_ts=root)
        print(f"#{n}: nudged")


def write_back(issue, channel, root, final):
    n, original = issue["number"], issue.get("body") or ""
    approver = user_name(APPROVER)
    final = final.replace("Approved by: (pending)", f"Approved by: {approver} on {time.strftime('%Y-%m-%d')}")
    if "<summary>Original request</summary>" not in original:
        final += f"\n\n---\n<details><summary>Original request</summary>\n\n{original}\n\n</details>"
    gh("PATCH", f"/issues/{n}", json={"body": final})
    comment(n, f"✅ Approved by {approver} in Slack: {permalink(channel, root)}\n\nIssue body updated with the final requirement.")
    swap_label(n, remove=[IN_REF, BLOCKED], add=[READY])
    post(f"✅ Done - #{n} is ready for dev: <{issue['html_url']}|issue #{n}>", thread_ts=root)
    print(f"#{n}: approved and written back")


def main():
    missing = [v for v in ("SLACK_BOT_TOKEN", "ANTHROPIC_API_KEY", "SLACK_CHANNEL_ID", "SLACK_APPROVER_ID") if not os.environ.get(v)]
    if missing:
        print(f"::warning::Refinement automation not configured yet, missing: {', '.join(missing)} (see docs/automation-setup.md)")
        return
    if sys.argv[1:2] == ["kickoff"] and len(sys.argv) == 3:
        kickoff(int(sys.argv[2]))
    elif sys.argv[1:] == ["sync"]:
        sync()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # surface the reason as a GitHub annotation, not just "exit code 1"
        detail = getattr(getattr(e, "response", None), "text", "") or ""
        print(f"::error title=Refinement failed::{type(e).__name__}: {e} {detail[:500]}".replace("\n", " "))
        raise
