"""Offline tests: the whole refinement loop with fake GitHub, Slack and Claude,
using the real agent, skills and config.

Run: python -m automation.tests.test_refinement   (or: pytest automation/tests)
"""
import ast
import re
import time
from pathlib import Path

from automation.refinement import catalog, config
from automation.refinement.engine import Refinement, normalize
from automation.refinement.questions import parse_questions

PKG = Path(__file__).resolve().parents[1] / "refinement"
BOT, PO, DEV = "UBOT", "UPO", "UDEV"


def make_cfg():
    return config.load(env={"SLACK_CHANNEL_ID": "C1", "SLACK_APPROVER_ID": PO, "GITHUB_REPOSITORY": "x/y"})


class Fake:
    def __init__(self, cfg):
        lb = cfg["github"]["labels"]
        self.issue = {"number": 7, "title": "[REQ] Create and manage habits", "state": "open",
                      "html_url": "https://github.com/x/y/issues/7", "body": "Users add habits.",
                      "labels": [{"name": lb["needs"]}]}
        self.comments, self.thread, self.reactions, self.calls = [], [], {}, []
        self.next_answer = None
        self.clock = time.time() - 3600

    def gh(self, method, path, **kw):
        if method == "GET" and path == "/issues/7":
            return self.issue
        if method == "GET" and path.startswith("/issues?labels="):
            want = re.search(r"labels=([\w-]+)", path).group(1)
            return [self.issue] if any(l["name"] == want for l in self.issue["labels"]) else []
        if method == "GET" and path.startswith("/issues/7/comments"):
            return [{"body": c} for c in self.comments]
        if method == "POST" and path == "/issues/7/comments":
            self.comments.append(kw["json"]["body"]); return {}
        if method == "POST" and path == "/issues/7/labels":
            self.issue["labels"] += [{"name": n} for n in kw["json"]["labels"]]; return {}
        if method == "DELETE" and path.startswith("/issues/7/labels/"):
            name = path.rsplit("/", 1)[1]
            self.issue["labels"] = [l for l in self.issue["labels"] if l["name"] != name]; return {}
        if method == "PATCH" and path == "/issues/7":
            self.issue.update(kw["json"]); return {}
        raise AssertionError(f"unexpected GitHub call {method} {path}")

    def say(self, user, text):
        self.clock += 1
        m = {"ts": f"{self.clock:.6f}", "user": user, "text": text}
        if user == BOT:
            m["bot_id"] = "B1"
        self.thread.append(m)
        return m["ts"]

    def slack(self, method, **p):
        if method == "chat.postMessage":
            return {"ts": self.say(BOT, p["text"])}
        if method == "chat.getPermalink":
            return {"permalink": f"https://slack/p{p['message_ts']}"}
        if method == "auth.test":
            return {"user_id": BOT}
        if method == "conversations.replies":
            return {"messages": list(self.thread)}
        if method == "reactions.get":
            return {"message": {"reactions": self.reactions.get(p["timestamp"], [])}}
        if method == "users.info":
            return {"user": {"real_name": {PO: "Imad (PO)", DEV: "Sara (dev)"}.get(p["user"], p["user"])}}
        raise AssertionError(f"unexpected Slack call {method}")

    def claude(self, system, task, tool):
        self.calls.append((system, task, tool))
        if tool["name"] == "kickoff":
            return {"restatement": "Users can add, edit and delete habits.",
                    "questions": "Scope :: Which fields? :: Name + emoji.\nData :: Storage? :: localStorage.\n"
                                 "UX :: Empty state? :: Prompt + Add button."}
        return self.next_answer


def setup():
    cfg = make_cfg()
    f = Fake(cfg)
    agent = catalog.load_agent(cfg["claude"]["agent"])
    eng = Refinement(cfg, agent, f.gh, f.slack, f.claude, log=lambda *_: None, now=lambda: f.clock)
    return cfg, f, eng


def labels(f):
    return sorted(l["name"] for l in f.issue["labels"])


# ---------- the agent and skills are the instructions ----------

def test_agent_and_skills_load_as_claude_code_files():
    cfg = make_cfg()
    agent = catalog.load_agent(cfg["claude"]["agent"])
    assert agent.name == "requirements-refiner" and agent.description
    names = [s.name for s in agent.skills]
    assert names == ["refine-kickoff", "refine-thread", "requirement-format"], names
    for step, skill_name in cfg["claude"]["skills"].items():
        skill = agent.skill(skill_name)
        assert skill.description and skill.tool and skill.tool["input_schema"]["type"] == "object", step
    system = agent.system_prompt(arguments="7")
    for s in agent.skills:
        assert s.body.splitlines()[0] in system
    assert "$ARGUMENTS" not in system and "gh issue view 7" in system


def test_no_instructions_hardcoded_in_python():
    """Any sentence-length text in the automation code belongs in the agent, skills or config."""
    offenders = []
    for path in PKG.glob("*.py"):
        tree = ast.parse(path.read_text())
        docstrings = {id(n.body[0].value) for n in ast.walk(tree)
                      if isinstance(n, (ast.Module, ast.FunctionDef, ast.ClassDef)) and n.body
                      and isinstance(n.body[0], ast.Expr) and isinstance(n.body[0].value, ast.Constant)}
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docstrings:
                # hidden <!-- markers --> are state plumbing, not instructions
                if len(node.value.split()) >= 8 and "<!--" not in node.value:
                    offenders.append(f"{path.name}:{node.lineno}: {node.value[:60]}")
    assert not offenders, offenders


def test_config_texts_have_known_placeholders():
    cfg = make_cfg()
    allowed = {"number", "title", "url", "restatement", "group", "index", "question", "default", "body",
               "link", "approver", "date", "product", "groups", "issue", "thread_link", "transcript", "tool"}
    texts = list(cfg["messages"]["slack"].values()) + list(cfg["messages"]["github"].values()) + \
        list(cfg["tasks"].values())
    for t in texts:
        unknown = set(re.findall(r"{(\w+)}", t)) - allowed
        assert not unknown, (t, unknown)


# ---------- parsing ----------

def test_question_parsing():
    g, o = ["Scope", "Data", "UX"], "Other"
    broken = ('[\n{"group":"Scope",""question":"Is a habit just a name?","default":"Name only."},\n'
              '{"group":"Data","question":"Where is data stored?","default":"localStorage."}\n]')
    qs = parse_questions(broken, g, o)
    assert [q["question"] for q in qs] == ["Is a habit just a name?", "Where is data stored?"]
    qs = parse_questions("1. UX :: Empty state? :: Prompt\n- Scope :: Edit? :: Inline :: in row\nJust a question?", g, o)
    assert [(q["group"], q["default"]) for q in qs] == [("UX", "Prompt"), ("Scope", "Inline :: in row"), ("Other", "")]


# ---------- the loop ----------

def test_full_loop():
    cfg, f, eng = setup()
    lb = cfg["github"]["labels"]

    eng.kickoff(7)
    assert labels(f) == [lb["active"]]
    assert "Refinement: #7" in f.thread[0]["text"] and "1. Which fields?" in f.thread[1]["text"]
    system, task, tool = f.calls[-1]
    assert "requirements refiner" in system and "Use your refine-kickoff skill" in task
    assert "Users add habits." in task and tool["name"] == "kickoff"
    eng.kickoff(7)  # duplicate trigger ignored
    assert len(f.thread) == 2

    n = len(f.calls)
    eng.sync()  # no replies: Claude not called
    assert len(f.calls) == n and len(f.thread) == 2

    f.say(DEV, "1: name only, no emoji")
    f.say(PO, "1: we need emoji. rest ok")
    f.next_answer = {"action": "follow_up", "slack_message": "Q1 conflict: emoji or not?"}
    eng.sync()
    assert f.thread[-1]["text"] == "Q1 conflict: emoji or not?"
    assert "[Sara (dev)] 1: name only" in f.calls[-1][1] and f.calls[-1][2]["name"] == "next_step"

    f.say(DEV, "ok, emoji optional")
    final = f"## Summary\nHabits CRUD.\n\n## Refinement trace\n- {cfg['messages']['github']['approved_pending']}"
    f.next_answer = {"action": "propose", "final_requirement": final,
                     "slack_message": ":clipboard: *PROPOSED FINAL REQUIREMENT* - #7\nSummary: habits CRUD\n"
                                      "React :white_check_mark: to approve, or reply with changes."}
    eng.sync()
    prop_ts = f.thread[-1]["ts"]
    assert f.thread[-1]["text"].count("PROPOSED FINAL REQUIREMENT") == 1  # Claude's copy stripped
    assert "Summary: habits CRUD" in f.thread[-1]["text"] and f"<!-- proposal: {prop_ts} -->" in f.comments[-1]

    f.reactions[prop_ts] = [{"name": "white_check_mark", "users": [DEV]}]  # not the approver
    eng.sync()
    assert labels(f) == [lb["active"]]

    f.say(PO, "add: max 20 habits")  # change request -> Claude
    f.next_answer = {"action": "propose", "slack_message": "Summary v2", "final_requirement": final + "\n- max 20"}
    eng.sync()
    assert "Summary v2" in f.thread[-1]["text"]

    f.say(DEV, "approved")  # approval-like reply from a non-approver: not an approval
    f.next_answer = {"action": "wait"}
    eng.sync()
    assert labels(f) == [lb["active"]]
    f.thread.pop()

    f.say(PO, ":white_check_mark:")  # approver replies ✅
    n = len(f.calls)
    eng.sync()
    assert len(f.calls) == n, "approval must not go through Claude"
    assert labels(f) == [lb["ready"]]
    assert f.issue["body"].startswith("## Summary") and "max 20" in f.issue["body"]
    assert "Approved by: Imad (PO) on" in f.issue["body"] and "Users add habits." in f.issue["body"]
    assert f.comments[-1].startswith("✅ Approved by Imad (PO)") and "ready for dev" in f.thread[-1]["text"]


def test_approval_replies():
    _, _, eng = setup()
    for text in [":white_check_mark:", "✅", "Approved!", "lgtm 👍", "ok go"]:
        assert eng.approve_reply.match(text), text
    for text in ["ok, but change 3", "approved but add X", "not approved"]:
        assert not eng.approve_reply.match(text), text


def test_stalled_thread():
    cfg, f, eng = setup()
    eng.kickoff(7)
    f.clock += 4 * 86400
    eng.sync()
    assert normalize(f.thread[-1]["text"]) == normalize(cfg["messages"]["slack"]["nudge"])
    f.clock += 4 * 86400
    eng.sync()
    assert cfg["github"]["labels"]["blocked"] in labels(f)
    f.say(PO, "rest ok")
    f.next_answer = {"action": "follow_up", "slack_message": "One more: max habits?"}
    eng.sync()
    assert cfg["github"]["labels"]["blocked"] not in labels(f)


def test_rerefine_approved_issue():
    cfg, f, eng = setup()
    lb, g = cfg["github"]["labels"], cfg["messages"]["github"]
    f.issue["body"] = (f"## Summary\nv1\n\n---\n<details><summary>{g['original_request']}</summary>\n\n"
                       "Users add habits.\n\n</details>")
    f.issue["labels"] = [{"name": lb["ready"]}, {"name": lb["needs"]}]
    eng.kickoff(7)
    assert labels(f) == [lb["active"]]  # ready-for-dev cleared
    f.say(PO, "rest ok")
    f.next_answer = {"action": "propose", "final_requirement": "## Summary\nv2", "slack_message": "v2"}
    eng.sync()
    f.say(PO, "approved")
    eng.sync()
    body = f.issue["body"]
    assert body.startswith("## Summary\nv2") and "v1" not in body
    assert body.count("<details>") == 1 and "Users add habits." in body  # first request kept once


def test_reopened_issue_ignores_old_proposal():
    cfg, f, eng = setup()
    eng.kickoff(7)
    f.comments.append("<!-- proposal: 1.0 -->\nold\n<!-- body-start -->\nOLD\n<!-- body-end -->")
    f.say(PO, "approved")
    f.next_answer = {"action": "follow_up", "slack_message": "Which questions?"}
    eng.sync()
    assert cfg["github"]["labels"]["ready"] not in labels(f)  # old proposal not written back


if __name__ == "__main__":
    tests = [(k, v) for k, v in dict(globals()).items() if k.startswith("test_") and callable(v)]
    for name, fn in tests:
        fn()
        print("ok ", name)
    print(f"\nAll {len(tests)} tests passed.")
