"""The refinement workflow: kick-off, then follow each thread until approval.

Instructions come from the agent/skills, texts and settings from config/refinement.yml.
Hidden HTML markers on the issue keep the state between runs.
"""
import re
import time

from .questions import group_in_order, parse_questions

THREAD_MARK = "<!-- slack-thread: {channel}/{ts} -->"
THREAD_RE = re.compile(r"<!-- slack-thread: (\w+)/([\d.]+) -->")
PROPOSAL_MARK = "<!-- proposal: {first} {last} -->"  # first and last Slack message of the proposal
PROPOSAL_RE = re.compile(
    r"<!-- proposal: ([\d.]+)(?: ([\d.]+))? -->\s*.*?<!-- body-start -->\n(.*?)\n<!-- body-end -->", re.S)
DAY = 86400


def normalize(text):
    """Lower-case text without :emoji: codes, emoji, markup or punctuation - for comparisons."""
    text = re.sub(r":[a-z0-9_+-]+:", " ", (text or "").lower())
    return " ".join(re.sub(r"[^\w\s]", " ", text).split())


class Refinement:
    def __init__(self, cfg, agent, github, slack, claude, log=print, now=time.time):
        self.cfg, self.agent, self.gh, self.slack, self.claude = cfg, agent, github, slack, claude
        self.log, self.now = log, now
        self.labels = cfg["github"]["labels"]
        self.channel = cfg["slack"]["channel_id"]
        self.approver = cfg["slack"]["approver_id"]
        ref = cfg["refinement"]
        self.groups, self.other = ref["question_groups"], ref["other_group"]
        self.nudge_after = ref["nudge_after_days"] * DAY
        self.approve_reactions = set(ref["approval"]["reactions"])
        words = sorted(ref["approval"]["reply_words"], key=len, reverse=True)
        self.approve_reply = re.compile(r"^\s*(?:(?:" + "|".join(map(re.escape, words)) + r")[\s.!,]*)+$", re.I)
        self.strip_lines = [re.compile(p) for p in ref.get("proposal_strip_lines", [])]
        self.slack_text, self.gh_text = cfg["messages"]["slack"], cfg["messages"]["github"]
        self.max_chars = cfg["slack"]["max_message_chars"]
        self._names = {}

    # ---------- shared helpers ----------

    def ask(self, skill_name, number, **data):
        skill = self.agent.skill(self.cfg["claude"]["skills"][skill_name])
        task = self.cfg["tasks"][skill_name].format(product=self.cfg["product"]["description"].strip(), **data)
        return self.claude(self.agent.system_prompt(arguments=number), task, skill.tool)

    def issue_text(self, issue):
        return f"Issue #{issue['number']}: {issue['title']}\nURL: {issue['html_url']}\n\n{issue.get('body') or ''}"

    def post(self, text, thread_ts=None):
        """Post text, split at line breaks into messages under Slack's size limit. Returns every ts."""
        parts, current = [], ""
        for line in text.split("\n"):
            while len(line) > self.max_chars:  # a single over-long line: hard split
                parts += [current] if current else []
                current, parts = "", parts + [line[:self.max_chars]]
                line = line[self.max_chars:]
            if current and len(current) + 1 + len(line) > self.max_chars:
                parts.append(current)
                current = line
            else:
                current = f"{current}\n{line}" if current else line
        parts.append(current)
        stamps = []
        for part in parts:
            params = {"channel": self.channel, "text": part, "unfurl_links": "false"}
            if thread_ts:
                params["thread_ts"] = thread_ts
            stamps.append(self.slack("chat.postMessage", **params)["ts"])
        return stamps

    def permalink(self, channel, ts):
        return self.slack("chat.getPermalink", channel=channel, message_ts=ts)["permalink"]

    def user_name(self, uid):
        if uid not in self._names:
            try:
                u = self.slack("users.info", user=uid)["user"]
                self._names[uid] = u.get("real_name") or u.get("name") or uid
            except Exception:
                self._names[uid] = uid
        return self._names[uid]

    def comment(self, n, body):
        self.gh("POST", f"/issues/{n}/comments", json={"body": body})

    def swap_label(self, n, remove=(), add=()):
        for name in remove:
            self.gh("DELETE", f"/issues/{n}/labels/{name}")
        if add:
            self.gh("POST", f"/issues/{n}/labels", json={"labels": list(add)})

    @staticmethod
    def labels_of(issue):
        return {lbl["name"] for lbl in issue["labels"]}

    # ---------- kick-off ----------

    def kickoff(self, n):
        issue = self.gh("GET", f"/issues/{n}")
        if self.labels["needs"] not in self.labels_of(issue) or issue["state"] != "open":
            self.log(f"#{n}: not labelled {self.labels['needs']} or closed, skipped")
            return
        out = self.ask("kickoff", n, issue=self.issue_text(issue), groups=", ".join(self.groups))
        questions = parse_questions(out.get("questions"), self.groups, self.other)
        if not questions:
            raise RuntimeError(f"no usable questions returned: {str(out.get('questions'))[:300]}")

        # build everything before posting, so a failure never leaves a half-finished thread
        t = self.slack_text
        fields = {"number": n, "title": issue["title"], "url": issue["html_url"]}
        lines, index = [t["questions_header"].format(**fields)], 0
        for group, qs in group_in_order(questions, self.groups, self.other):
            lines += ["", t["question_group"].format(group=group)]
            for q in qs:
                index += 1
                line = t["question"].format(index=index, question=q["question"])
                lines.append(line + (t["question_default"].format(default=q["default"]) if q["default"] else ""))
        lines += ["", t["questions_footer"].format(**fields)]

        root = self.post(t["kickoff"].format(restatement=out.get("restatement", "").strip(), **fields))[0]
        self.post("\n".join(lines), thread_ts=root)
        self.comment(n, self.gh_text["thread_started"].format(link=self.permalink(self.channel, root))
                     + "\n\n" + THREAD_MARK.format(channel=self.channel, ts=root))
        stale = [self.labels[k] for k in ("needs", "ready", "blocked") if self.labels[k] in self.labels_of(issue)]
        self.swap_label(n, remove=stale, add=[self.labels["active"]])
        self.log(f"#{n}: kicked off, thread {root}")

    # ---------- follow the threads ----------

    def sync(self):
        bot = self.slack("auth.test")["user_id"]
        issues = self.gh("GET", f"/issues?labels={self.labels['active']}&state=open&per_page=100")
        self.log(f"{len(issues)} issue(s) in refinement")
        for issue in issues:
            try:
                self.sync_issue(issue, bot)
            except Exception as e:  # one broken issue must not stop the others
                self.log(f"::error title=Sync failed for #{issue['number']}::{type(e).__name__}: {e}".replace("\n", " "))

    def sync_issue(self, issue, bot):
        n = issue["number"]
        comments = self.gh("GET", f"/issues/{n}/comments?per_page=100")
        thread = next((m for c in reversed(comments) if (m := THREAD_RE.search(c["body"]))), None)
        if not thread:
            self.log(f"#{n}: no Slack thread recorded, skipped")
            return
        channel, root = thread.groups()
        msgs = self.slack("conversations.replies", channel=channel, ts=root, limit=200)["messages"]

        def is_bot(m):
            return m.get("user") == bot or "bot_id" in m

        msgs = sorted(msgs, key=lambda m: float(m["ts"]))
        last_bot = max((float(m["ts"]) for m in msgs if is_bot(m)), default=0.0)
        new_human = [m for m in msgs if not is_bot(m) and float(m["ts"]) > last_bot]
        proposals = [(first, body) for c in comments for first, _last, body in PROPOSAL_RE.findall(c["body"])
                     if float(first) > float(root)]  # only this thread's proposals
        proposal = proposals[-1] if proposals else None

        if proposal:
            # a long proposal spans several consecutive bot messages; they all belong to it
            parts = []
            for m in (m for m in msgs if float(m["ts"]) >= float(proposal[0])):
                if not is_bot(m):
                    break
                parts.append(m["ts"])
            if parts and float(parts[-1]) >= last_bot:  # the proposal is Claude's latest word
                if new_human and all(m.get("user") == self.approver
                                     and self.approve_reply.match(m.get("text", "")) for m in new_human):
                    return self.write_back(issue, channel, root, proposal[1])
                if not new_human:
                    if any(self.approved_by_reaction(channel, ts) for ts in parts):
                        return self.write_back(issue, channel, root, proposal[1])
                    self.log(f"#{n}: proposal waiting for approval")
                    return
                # replies asking for changes -> Claude below

        if not new_human:
            return self.nudge_or_block(issue, msgs, root)

        if self.labels["blocked"] in self.labels_of(issue):
            self.swap_label(n, remove=[self.labels["blocked"]])
        transcript = "\n\n".join(
            f"[{'Claude' if is_bot(m) else self.user_name(m.get('user', '?'))}] {m.get('text', '')}" for m in msgs)
        link = self.permalink(channel, root)
        out = self.ask("thread", n, issue=self.issue_text(issue), thread_link=link, transcript=transcript)

        action = out.get("action")
        if action == "follow_up" and out.get("slack_message"):
            self.post(out["slack_message"], thread_ts=root)
            self.log(f"#{n}: follow-up posted")
        elif action == "propose" and out.get("final_requirement"):
            body = self.clean_proposal(out.get("slack_message") or out["final_requirement"])
            stamps = self.post(self.slack_text["proposal"].format(body=body), thread_ts=root)
            self.comment(n, PROPOSAL_MARK.format(first=stamps[0], last=stamps[-1]) + "\n"
                         + self.gh_text["proposal_posted"].format(link=self.permalink(channel, stamps[0]))
                         + f"\n\n<details><summary>{self.gh_text['proposal_details']}</summary>\n\n"
                         + f"<!-- body-start -->\n{out['final_requirement']}\n<!-- body-end -->\n\n</details>")
            self.log(f"#{n}: proposal posted")
        else:
            self.log(f"#{n}: waiting")

    def approved_by_reaction(self, channel, ts):
        reacts = self.slack("reactions.get", channel=channel, timestamp=ts).get("message", {}).get("reactions", [])
        return any(r["name"] in self.approve_reactions and self.approver in r.get("users", []) for r in reacts)

    def clean_proposal(self, text):
        keep = [line for line in text.strip().splitlines()
                if not any(p.search(normalize(line)) for p in self.strip_lines)]
        return "\n".join(keep).strip()

    def nudge_or_block(self, issue, msgs, root):
        n, last = issue["number"], msgs[-1]
        if self.now() - float(last["ts"]) < self.nudge_after or self.labels["blocked"] in self.labels_of(issue):
            return
        if normalize(last.get("text")) == normalize(self.slack_text["nudge"]):
            self.swap_label(n, add=[self.labels["blocked"]])
            self.post(self.slack_text["blocked"].format(number=n), thread_ts=root)
            self.log(f"#{n}: blocked")
        else:
            self.post(self.slack_text["nudge"].format(number=n), thread_ts=root)
            self.log(f"#{n}: nudged")

    def write_back(self, issue, channel, root, final):
        n, original = issue["number"], issue.get("body") or ""
        approver = self.user_name(self.approver)
        g = self.gh_text
        final = final.replace(g["approved_pending"],
                              g["approved_by"].format(approver=approver, date=time.strftime("%Y-%m-%d")))
        summary = f"<summary>{g['original_request']}</summary>"
        kept = re.search(r"<details>" + re.escape(summary) + r".*?</details>", original, re.S)
        # re-refined issue: keep the very first request; otherwise the current body is the original
        block = kept.group(0) if kept else f"<details>{summary}\n\n{original}\n\n</details>"
        final += f"\n\n---\n{block}"
        self.gh("PATCH", f"/issues/{n}", json={"body": final})
        self.comment(n, g["approved"].format(approver=approver, link=self.permalink(channel, root)))
        self.swap_label(n, remove=[self.labels["active"], self.labels["blocked"]], add=[self.labels["ready"]])
        self.post(self.slack_text["done"].format(number=n, url=issue["html_url"]), thread_ts=root)
        self.log(f"#{n}: approved and written back")
