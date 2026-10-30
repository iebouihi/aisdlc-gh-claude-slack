"""Offline test of the whole refinement loop with fake GitHub, Slack and Claude.

Run: python .github/scripts/test_refine.py
"""
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.update(SLACK_CHANNEL_ID="C1", SLACK_APPROVER_ID="UPO")
import refine  # noqa: E402

refine.CHANNEL, refine.APPROVER = "C1", "UPO"
BOT = "UBOT"


class Fake:
    def __init__(self):
        self.issue = {"number": 7, "title": "[REQ] Create and manage habits", "state": "open",
                      "html_url": "https://github.com/x/y/issues/7", "body": "Users add habits.",
                      "labels": [{"name": "needs-refinement"}]}
        self.comments, self.thread, self.reactions = [], [], {}
        self.claude_calls, self.next_sync = [], None
        self.clock = time.time() - 3600  # thread started an hour ago

    # --- GitHub ---
    def gh(self, method, path, **kw):
        lbls = self.issue["labels"]
        if method == "GET" and path == "/issues/7":
            return self.issue
        if method == "GET" and path.startswith("/issues?labels="):
            want = re.search(r"labels=([\w-]+)", path).group(1)
            return [self.issue] if any(l["name"] == want for l in lbls) else []
        if method == "GET" and path.startswith("/issues/7/comments"):
            return [{"body": c} for c in self.comments]
        if method == "POST" and path == "/issues/7/comments":
            self.comments.append(kw["json"]["body"]); return {}
        if method == "POST" and path == "/issues/7/labels":
            lbls.extend({"name": n} for n in kw["json"]["labels"]); return {}
        if method == "DELETE" and path.startswith("/issues/7/labels/"):
            name = path.rsplit("/", 1)[1]
            self.issue["labels"] = [l for l in lbls if l["name"] != name]; return {}
        if method == "PATCH" and path == "/issues/7":
            self.issue.update(kw["json"]); return {}
        raise AssertionError(f"unexpected GitHub call {method} {path}")

    # --- Slack ---
    def say(self, user, text, root=None):
        self.clock += 1
        ts = f"{self.clock:.6f}"
        m = {"ts": ts, "user": user, "text": text}
        if user == BOT:
            m["bot_id"] = "B1"
        self.thread.append(m)
        return ts

    def slack(self, method, **p):
        if method == "chat.postMessage":
            return {"ts": self.say(BOT, p["text"], p.get("thread_ts"))}
        if method == "chat.getPermalink":
            return {"permalink": f"https://slack/p{p['message_ts']}"}
        if method == "auth.test":
            return {"user_id": BOT}
        if method == "conversations.replies":
            return {"messages": list(self.thread)}
        if method == "reactions.get":
            return {"message": {"reactions": self.reactions.get(p["timestamp"], [])}}
        if method == "users.info":
            return {"user": {"real_name": {"UPO": "Imad (PO)", "UDEV": "Sara (dev)"}.get(p["user"], p["user"])}}
        raise AssertionError(f"unexpected Slack call {method}")

    # --- Claude ---
    def ask_claude(self, instruction, tool):
        self.claude_calls.append((tool["name"], instruction))
        if tool["name"] == "kickoff":
            return {"restatement": "Users can add, edit and delete habits.", "questions": (
                "Scope :: Which fields? :: Name + emoji.\n"
                "Data :: Storage? :: localStorage.\n"
                "UX :: Empty state? :: Prompt + Add button.")}
        return self.next_sync


def labels(f):
    return sorted(l["name"] for l in f.issue["labels"])


def parsing():
    # the exact malformed output seen in the first live run (stringified JSON with a typo)
    broken = ('[\n{"group":"Scope","\"question":"Is a habit just a name?","default":"Name only."},\n'
              '{"group":"Data","question":"Where is data stored?","default":"localStorage."}\n]')
    qs = refine.parse_questions(broken)
    assert [q["question"] for q in qs] == ["Is a habit just a name?", "Where is data stored?"], qs
    assert qs[1]["group"] == "Data" and qs[1]["default"] == "localStorage."
    qs = refine.parse_questions("1. UX :: Empty state? :: Prompt\n\n- Scope :: Edit? :: Inline :: in row\nJust a question?")
    assert [(q["group"], q["question"], q["default"]) for q in qs] == [
        ("UX", "Empty state?", "Prompt"), ("Scope", "Edit?", "Inline :: in row"), ("Other", "Just a question?", "")], qs
    qs = refine.parse_questions([{"group": "UX", "question": "Q?", "default": "D"}])
    assert qs == [{"group": "UX", "question": "Q?", "default": "D"}]
    print("ok  question parsing (lines, list, broken JSON)")


def run():
    parsing()
    f = Fake()
    refine.gh, refine.slack, refine.ask_claude = f.gh, f.slack, f.ask_claude

    # 1. Kick-off: thread opened, issue linked, label moved
    refine.kickoff(7)
    assert labels(f) == ["in-refinement"], labels(f)
    assert len(f.thread) == 2 and "Refinement: #7" in f.thread[0]["text"]
    assert "1. Which fields?" in f.thread[1]["text"] and "*Data*" in f.thread[1]["text"]
    assert "<!-- slack-thread: C1/" in f.comments[0]
    refine.kickoff(7)  # duplicate event (opened + labeled) is ignored
    assert len(f.thread) == 2
    print("ok  kick-off")

    # 2. Sync with no replies: nothing happens, Claude not called
    n_calls = len(f.claude_calls)
    refine.sync()
    assert len(f.claude_calls) == n_calls and len(f.thread) == 2
    print("ok  no replies -> wait")

    # 3. Conflicting answers -> follow-up
    f.say("UDEV", "1: name only, no emoji")
    f.say("UPO", "1: we need emoji. rest ok")
    f.next_sync = {"action": "follow_up", "slack_message": "Q1 conflict: emoji or not?"}
    refine.sync()
    assert f.thread[-1]["text"] == "Q1 conflict: emoji or not?"
    assert "[Sara (dev)] 1: name only" in f.claude_calls[-1][1]
    print("ok  conflict -> follow-up")

    # 4. Resolved -> proposal posted and stored on the issue
    f.say("UDEV", "ok, emoji optional")
    body = "## Summary\nHabits CRUD.\n\n## Refinement trace\n- Approved by: (pending)"
    f.next_sync = {"action": "propose", "slack_message": "Summary: habits CRUD", "final_requirement": body}
    refine.sync()
    prop_ts = f.thread[-1]["ts"]
    assert f.thread[-1]["text"].startswith("📋 *PROPOSED FINAL REQUIREMENT*")
    assert f"<!-- proposal: {prop_ts} -->" in f.comments[-1]
    print("ok  answered -> proposal")

    # 5. ✅ from someone who is not the approver -> no write-back
    f.reactions[prop_ts] = [{"name": "white_check_mark", "users": ["UDEV"]}]
    n_calls = len(f.claude_calls)
    refine.sync()
    assert labels(f) == ["in-refinement"] and len(f.claude_calls) == n_calls
    print("ok  non-approver ✅ ignored")

    # 6. Change request after proposal -> Claude revises
    f.say("UPO", "add: max 20 habits")
    body2 = body + "\n- AC: max 20 habits"
    f.next_sync = {"action": "propose", "slack_message": "Summary v2", "final_requirement": body2}
    refine.sync()
    prop_ts = f.thread[-1]["ts"]
    assert "Summary v2" in f.thread[-1]["text"]
    print("ok  change request -> new proposal")

    # 6b. a ✅ *reply* from someone else is just a message -> goes to Claude, not approved
    f.say("UDEV", ":white_check_mark:")
    f.next_sync = {"action": "wait"}
    refine.sync()
    assert labels(f) == ["in-refinement"]
    f.thread.pop()
    print("ok  non-approver ✅ reply ignored")

    # 7. Approver replies ✅ (as a message, like in the live test) -> write-back
    f.say("UPO", ":white_check_mark:")
    n_calls = len(f.claude_calls)
    refine.sync()
    assert len(f.claude_calls) == n_calls, "approval must not go through Claude"
    assert labels(f) == ["ready-for-dev"], labels(f)
    assert f.issue["body"].startswith("## Summary") and "max 20 habits" in f.issue["body"]
    assert "Approved by: Imad (PO) on" in f.issue["body"]
    assert "<summary>Original request</summary>" in f.issue["body"] and "Users add habits." in f.issue["body"]
    assert f.comments[-1].startswith("✅ Approved by Imad (PO)")
    assert f.thread[-1]["text"].startswith("✅ Done - #7 is ready for dev")
    print("ok  approver ✅ -> issue updated, ready-for-dev")

    # 8. Stalled thread -> nudge, then blocked, then resumes
    g = Fake()
    refine.gh, refine.slack, refine.ask_claude = g.gh, g.slack, g.ask_claude
    refine.kickoff(7)
    real_time = time.time
    try:
        time.time = lambda: g.clock + 4 * refine.DAY
        refine.sync()
        assert refine.NUDGE_MARK in g.thread[-1]["text"]
        time.time = lambda: g.clock + 4 * refine.DAY
        refine.sync()
        assert "blocked" in labels(g) and "blocked" in g.thread[-1]["text"]
    finally:
        time.time = real_time
    g.say("UPO", "rest ok")
    g.next_sync = {"action": "follow_up", "slack_message": "Thanks, one more: max habits?"}
    refine.sync()
    assert "blocked" not in labels(g)
    print("ok  stalled -> nudge -> blocked -> resumes")

    print("\nAll scenarios passed.")


if __name__ == "__main__":
    run()
