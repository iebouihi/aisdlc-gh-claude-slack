"""Offline tests: the whole refinement loop with fake GitHub, Slack and Claude,
using the real agent, skills and config, and living specs in a temporary folder.

Run: python -m automation.tests.test_refinement   (or: pytest automation/tests)
"""
import ast
import base64
import re
import tempfile
import time
from pathlib import Path

from automation.refinement import catalog, config
from automation.refinement import specs as spec_store
from automation.refinement.delivery import Delivery
from automation.refinement.engine import Refinement, normalize
from automation.refinement.questions import parse_questions

PKG = Path(__file__).resolve().parents[1] / "refinement"
BOT, PO, DEV = "UBOT", "UPO", "UDEV"

HABIT_SPEC = """---
id: habits/habit-management
title: Habit management
module: habits
summary: Create, list, edit and delete habits; stored in localStorage.
entities: [Habit]
status: active
issues: [1]
updated: 2026-10-30
---
# Habit management

## Current behaviour
- A habit has a name; names are unique (case-insensitive).

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Habit = name only | #1 | thread |
| ~~D2~~ | ~~Max 20 habits~~ → superseded by D3 (#5) | #1 | thread |
| D3 | No habit limit | #5 | thread |

## Data
- Habit {id, name, createdAt} in localStorage key habits.v1

## Not covered
- Check-ins

## History
- 2026-10-30 #1: created
"""

THEME_SPEC = HABIT_SPEC.replace("habits/habit-management", "settings/theme").replace("module: habits", "module: settings") \
    .replace("Habit management", "Theme").replace("entities: [Habit]", "entities: [Preference]")


def new_spec(path_id, title, extra=""):
    module = path_id.split("/")[0]
    return (f"---\nid: {path_id}\ntitle: {title}\nmodule: {module}\nsummary: {title} today.\n"
            f"entities: [CheckIn]\nstatus: active\nissues: [7]\nupdated: 2026-10-30\n---\n# {title}\n\n"
            f"## Decisions\n| ID | Decision | Since | Source |\n|---|---|---|---|\n| D1 | One check-in per day{extra} | #7 | thread |\n")


def make_cfg(**specs_overrides):
    cfg = config.load(env={"SLACK_CHANNEL_ID": "C1", "SLACK_APPROVER_ID": PO, "GITHUB_REPOSITORY": "x/y"})
    cfg["specs"].update(specs_overrides)
    return cfg


class Fake:
    def __init__(self, cfg):
        lb = cfg["github"]["labels"]
        self.issue = {"number": 7, "title": "[REQ] Daily check-in", "state": "open",
                      "html_url": "https://github.com/x/y/issues/7", "body": "Users check habits off daily.",
                      "labels": [{"name": lb["needs"]}]}
        self.comments, self.thread, self.reactions, self.calls = [], [], {}, []
        self.branches, self.files, self.pulls, self.broadcasts = {}, {}, {}, []
        self.next_answer, self.selection, self.pr_fails = None, [], False
        self.clock = time.time() - 3600

    # --- GitHub ---
    def gh(self, method, path, missing_ok=False, **kw):
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
        if method == "GET" and path.startswith("/git/ref/heads/"):
            b = path.split("/git/ref/heads/")[1]
            if b == "main" or b in self.branches:
                return {"object": {"sha": "base-sha"}}
            assert missing_ok
            return None
        if method == "DELETE" and path.startswith("/git/refs/heads/"):
            b = path.split("/git/refs/heads/")[1]
            if b not in self.branches:  # like GitHub: 422 "Reference does not exist"
                raise RuntimeError("422 Reference does not exist")
            self.branches.pop(b); return None
        if method == "POST" and path == "/git/refs":
            self.branches[kw["json"]["ref"].split("refs/heads/")[1]] = {}; return {}
        if method == "GET" and path.startswith("/contents/"):
            p, branch = path[len("/contents/"):].split("?ref=")
            assert missing_ok
            return {"sha": "s"} if p in self.branches.get(branch, {}) else None
        if method == "PUT" and path.startswith("/contents/"):
            body = kw["json"]
            self.branches[body["branch"]][path[len("/contents/"):]] = base64.b64decode(body["content"]).decode()
            return {}
        if method == "POST" and path == "/pulls":
            if self.pr_fails:
                raise RuntimeError("403 GitHub Actions is not permitted to create pull requests")
            num = 100 + len(self.pulls)
            self.pulls[num] = {"number": num, "html_url": f"https://github.com/x/y/pull/{num}", "merged": False,
                               "head": {"ref": kw["json"]["head"]}, "title": kw["json"]["title"]}
            return self.pulls[num]
        if method == "GET" and path.startswith("/pulls?head="):
            head = path.split("head=")[1].split("&")[0].split(":")[1]
            return [p for p in self.pulls.values() if p["head"]["ref"] == head and not p.get("merged")]
        if method == "GET" and path.startswith("/pulls/"):
            return self.pulls[int(path.rsplit("/", 1)[1])]
        raise AssertionError(f"unexpected GitHub call {method} {path}")

    # --- Slack ---
    def say(self, user, text):
        self.clock += 1
        m = {"ts": f"{self.clock:.6f}", "user": user, "text": text}
        if user == BOT:
            m["bot_id"] = "B1"
        self.thread.append(m)
        return m["ts"]

    def slack(self, method, **p):
        if method == "chat.postMessage":
            if p.get("reply_broadcast"):
                self.broadcasts.append(p["text"])
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

    # --- Claude ---
    def claude(self, system, task, tool):
        self.calls.append((system, task, tool))
        if tool["name"] == "select_context":
            pick = self.selection.pop(0) if self.selection else ""
            return {"selected": pick}
        if tool["name"] == "kickoff":
            return {"restatement": "Users check habits off once a day.",
                    "questions": "Scope :: Which fields? :: Date only.\nData :: Storage? :: localStorage.\n"
                                 "UX :: Empty state? :: Prompt."}
        return self.next_answer


def setup(spec_files=None, **specs_overrides):
    cfg = make_cfg(**specs_overrides)
    f = Fake(cfg)
    root = Path(tempfile.mkdtemp())
    for path, content in (spec_files or {}).items():
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_text(content)
    agent = catalog.load_agent(cfg["claude"]["agent"])
    eng = Refinement(cfg, agent, f.gh, f.slack, f.claude, log=lambda *_: None, now=lambda: f.clock, root=root)
    return cfg, f, eng


def labels(f):
    return sorted(l["name"] for l in f.issue["labels"])


def tools_called(f):
    return [c[2]["name"] for c in f.calls]


def propose(f, final="## Summary\nCheck-ins.\n\n## Refinement trace\n- Approved by: (pending)", specs="", slack="Summary: check-ins"):
    f.next_answer = {"action": "propose", "final_requirement": final, "slack_message": slack, "spec_updates": specs}


# ---------- the agent and skills are the instructions ----------

def test_agent_and_skills_load_as_claude_code_files():
    cfg = make_cfg()
    agent = catalog.load_agent(cfg["claude"]["agent"])
    assert agent.name == "requirements-refiner" and agent.description
    assert [s.name for s in agent.skills] == \
        ["impact-analysis", "refine-kickoff", "refine-thread", "requirement-format", "living-spec"]
    for step, conf in cfg["claude"]["steps"].items():
        skill = agent.skill(conf["skill"])
        assert skill.description and skill.tool and skill.tool["input_schema"]["type"] == "object", step
        for used in conf["uses"]:
            agent.skill(used)
    analyst = catalog.load_agent("impact-analyst")
    assert [s.name for s in analyst.skills] == ["impact-analysis", "living-spec"]
    system = agent.system_prompt(arguments="7")
    assert "$ARGUMENTS" not in system and "gh issue view 7" in system


def test_each_step_loads_only_its_skills():
    cfg = make_cfg()
    agent = catalog.load_agent(cfg["claude"]["agent"])
    full = agent.system_prompt()
    select = agent.system_prompt(only=["impact-analysis"])
    thread = agent.system_prompt(only=["refine-thread", "requirement-format", "living-spec"])
    assert "# Impact analysis" in select and "# Living specs" not in select and "# Final requirement" not in select
    assert "# Decide the next step" in thread and "# Impact analysis" not in thread
    assert len(select) < len(thread) < len(full)


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
    allowed = {"number", "title", "url", "restatement", "group", "index", "question", "default", "body", "link",
               "approver", "date", "product", "groups", "issue", "thread_link", "transcript", "tool", "specs",
               "context", "limit", "level", "files", "pr_url", "pr_number", "branch", "compare_url", "ready",
               "module", "count", "entities", "titles", "id", "summary", "file", "decisions", "issues", "path",
               "content", "run_url", "trigger"}
    texts = [v for section in (cfg["messages"]["slack"], cfg["messages"]["github"], cfg["tasks"],
                               cfg["specs"]["generated"]) for v in section.values()]
    for t in texts:
        unknown = set(re.findall(r"{(\w+)}", t)) - allowed
        assert not unknown, (t, unknown)


# ---------- spec store ----------

def test_spec_store_validation_and_indexes():
    cfg = make_cfg()
    sp = cfg["specs"]
    good = spec_store.parse_updates(
        f"=== FILE: specs/tracking/check-in.md ===\n{new_spec('tracking/check-in', 'Check-in')}=== END FILE ===",
        sp["file_pattern"], sp["required_fields"])
    assert [u.path for u in good] == ["specs/tracking/check-in.md"]
    for bad in ["=== FILE: ../etc/passwd.md ===\n---\nid: x\n---\n=== END FILE ===",
                "=== FILE: specs/README.md ===\n# x\n=== END FILE ===",
                f"=== FILE: specs/tracking/check-in.md ===\n{new_spec('tracking/other', 'X')}=== END FILE ===",
                "=== FILE: specs/tracking/check-in.md ===\n---\nid: tracking/check-in\n---\nbody\n=== END FILE ==="]:
        try:
            spec_store.parse_updates(bad, sp["file_pattern"], sp["required_fields"])
            raise AssertionError(f"accepted: {bad[:40]}")
        except ValueError:
            pass
    _, _, eng = setup({"specs/habits/habit-management.md": HABIT_SPEC})
    specs = eng.load_specs()
    files = spec_store.generated_files(spec_store.merge(specs, good), sp["generated"], "app")
    assert set(files) == {"specs/README.md", "specs/habits/README.md", "specs/tracking/README.md"}
    assert "decisions: 2" in files["specs/habits/README.md"]  # struck-through D2 not counted
    assert "[tracking](tracking/README.md)" in files["specs/README.md"]


# ---------- context selection ----------

def test_kickoff_uses_selected_specs_as_context():
    cfg, f, eng = setup({"specs/habits/habit-management.md": HABIT_SPEC, "specs/settings/theme.md": THEME_SPEC})
    f.selection = ["habits/habit-management :: check-ins reference Habit.id\nnot/a-spec :: hallucinated"]
    eng.kickoff(7)
    assert tools_called(f) == ["select_context", "kickoff"]
    select_task, kickoff_task = f.calls[0][1], f.calls[1][1]
    assert "habits/habit-management | Habit management" in select_task and "settings/theme" in select_task
    assert "Habit = name only" in kickoff_task and "# Theme" not in kickoff_task  # only the chosen spec
    assert "`specs/habits/habit-management.md`" in f.thread[0]["text"]
    assert "<!-- context: specs/habits/habit-management.md -->" in f.comments[-1]
    # the thread step gets the same specs, re-read fresh
    f.say(PO, "rest ok")
    f.next_answer = {"action": "wait"}
    eng.sync()
    assert "Habit = name only" in f.calls[-1][1] and f.calls[-1][2]["name"] == "next_step"


def test_two_stage_selection_when_index_is_large():
    cfg, f, eng = setup({"specs/habits/habit-management.md": HABIT_SPEC, "specs/settings/theme.md": THEME_SPEC},
                        index_chars=10)
    f.selection = ["habits :: same entity", "habits/habit-management :: Habit.id"]
    eng.kickoff(7)
    assert tools_called(f) == ["select_context", "select_context", "kickoff"]
    assert "habits | 1 capabilities" in f.calls[0][1]  # modules first
    assert "habits/habit-management" in f.calls[1][1] and "settings/theme" not in f.calls[1][1]


def test_no_specs_means_no_selection_call():
    cfg, f, eng = setup()
    eng.kickoff(7)
    assert tools_called(f) == ["kickoff"]
    assert cfg["specs"]["generated"]["context_none"] in f.calls[0][1]


def test_context_budget_is_enforced():
    cfg, f, eng = setup({"specs/habits/habit-management.md": HABIT_SPEC, "specs/settings/theme.md": THEME_SPEC},
                        context_chars=len(HABIT_SPEC) + 100)
    text = eng.context_text(["specs/habits/habit-management.md", "specs/settings/theme.md"])
    assert "# Habit management" in text and "# Theme" not in text


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

def test_full_loop_with_living_spec_pr():
    cfg, f, eng = setup({"specs/habits/habit-management.md": HABIT_SPEC})
    lb = cfg["github"]["labels"]
    f.selection = ["habits/habit-management :: Habit.id"]
    eng.kickoff(7)
    assert labels(f) == [lb["active"]]
    eng.kickoff(7)  # duplicate trigger ignored
    assert len(f.thread) == 2

    n = len(f.calls)
    eng.sync()  # no replies: Claude not called
    assert len(f.calls) == n

    f.say(DEV, "1: date only")
    f.say(PO, "1: date and time. rest ok")
    f.next_answer = {"action": "follow_up", "slack_message": "Q1 conflict: date or date+time?"}
    eng.sync()
    assert f.thread[-1]["text"] == "Q1 conflict: date or date+time?"

    f.say(DEV, "date only is fine")
    edited = HABIT_SPEC.replace("## History", "## History\n- 2026-10-30 #7: Habit.id used by check-ins")
    blocks = (f"=== FILE: specs/tracking/check-in.md ===\n{new_spec('tracking/check-in', 'Check-in')}=== END FILE ===\n"
              f"=== FILE: specs/habits/habit-management.md ===\n{edited}=== END FILE ===")
    propose(f, specs=blocks, slack=":clipboard: *PROPOSED FINAL REQUIREMENT*\nSummary: check-ins\n*Living spec changes*\n• new tracking/check-in")
    eng.sync()
    prop = f.thread[-1]["text"]
    assert prop.count("PROPOSED FINAL REQUIREMENT") == 1 and "Living spec changes" in prop
    assert "<!-- specs-start -->" in f.comments[-1]

    f.reactions[f.thread[-1]["ts"]] = [{"name": "white_check_mark", "users": [DEV]}]  # not the approver
    eng.sync()
    assert labels(f) == [lb["active"]]

    f.say(PO, "approved")
    n = len(f.calls)
    eng.sync()
    assert len(f.calls) == n, "approval must not go through Claude"
    # issue body final, but not ready yet: spec PR first
    assert f.issue["body"].startswith("## Summary\nCheck-ins.") and "Approved by: Imad (PO) on" in f.issue["body"]
    assert labels(f) == [lb["spec_review"]]
    branch = cfg["specs"]["branch_prefix"] + "7"
    committed = f.branches[branch]
    assert set(committed) == {"specs/tracking/check-in.md", "specs/habits/habit-management.md", "specs/README.md",
                              "specs/habits/README.md", "specs/tracking/README.md"}
    assert "Habit.id used by check-ins" in committed["specs/habits/habit-management.md"]
    pr = f.pulls[100]
    assert pr["head"]["ref"] == branch and "Living spec" in pr["title"]
    assert any(pr["html_url"] in c for c in f.comments)
    assert f.broadcasts and "Living spec update" in f.broadcasts[-1] and pr["html_url"] in f.broadcasts[-1]

    pr["merged"] = True
    eng.spec_merged(100)
    assert labels(f) == [lb["ready"]] and "ready for dev" in f.thread[-1]["text"]
    assert branch not in f.branches  # spec branch cleaned up


def test_approval_without_spec_changes_is_ready_at_once():
    cfg, f, eng = setup()
    eng.kickoff(7)
    f.say(PO, "rest ok")
    propose(f)
    eng.sync()
    f.say(PO, ":white_check_mark:")
    eng.sync()
    assert labels(f) == [cfg["github"]["labels"]["ready"]] and not f.pulls


def test_invalid_spec_update_posts_nothing():
    cfg, f, eng = setup()
    eng.kickoff(7)
    f.say(PO, "rest ok")
    propose(f, specs="=== FILE: specs/../../evil.md ===\nx\n=== END FILE ===")
    before = len(f.thread)
    eng.sync()  # error is caught per issue and logged; retried next run
    assert len(f.thread) == before and not any("<!-- proposal" in c for c in f.comments)


def test_pr_not_allowed_falls_back_to_branch_link():
    cfg, f, eng = setup()
    f.pr_fails = True
    eng.kickoff(7)
    f.say(PO, "rest ok")
    propose(f, specs=f"=== FILE: specs/tracking/check-in.md ===\n{new_spec('tracking/check-in', 'Check-in')}=== END FILE ===")
    eng.sync()
    f.say(PO, "approved")
    eng.sync()
    assert labels(f) == [cfg["github"]["labels"]["spec_review"]]
    assert "compare/main...spec/issue-7?expand=1" in f.broadcasts[-1] and "spec/issue-7" in f.branches


def test_spec_push_failure_leaves_issue_untouched_and_retries():
    cfg, f, eng = setup()
    eng.kickoff(7)
    f.say(PO, "rest ok")
    propose(f, specs=f"=== FILE: specs/tracking/check-in.md ===\n{new_spec('tracking/check-in', 'Check-in')}=== END FILE ===")
    eng.sync()
    f.say(PO, "approved")
    body, n_comments = f.issue["body"], len(f.comments)
    real = f.gh

    def failing(method, path, **kw):
        if method == "PUT" and path.startswith("/contents/"):  # fails after the branch was created
            raise RuntimeError("500 boom")
        return real(method, path, **kw)
    eng.gh = failing
    eng.sync()  # error logged, nothing changed on the issue
    assert f.issue["body"] == body and len(f.comments) == n_comments
    assert labels(f) == [cfg["github"]["labels"]["active"]]
    assert "spec/issue-7" in f.branches  # half-done branch left behind
    eng.gh = real
    eng.sync()  # next run replaces the branch and succeeds
    assert labels(f) == [cfg["github"]["labels"]["spec_review"]] and len(f.pulls) == 1
    assert "specs/tracking/check-in.md" in f.branches["spec/issue-7"]
    assert sum(c.startswith("✅ Approved by") for c in f.comments) == 1  # issue updated exactly once


def test_spec_merged_ignores_other_prs():
    cfg, f, eng = setup()
    f.pulls[5] = {"number": 5, "merged": True, "head": {"ref": "feature/x"}, "html_url": "u"}
    eng.spec_merged(5)
    assert labels(f) == [cfg["github"]["labels"]["needs"]]


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


def test_long_proposal_split_and_approved():
    cfg, f, eng = setup()
    eng.kickoff(7)
    f.say(PO, "rest ok")
    long_slack = "\n".join(f"• AC{i}: given a habit, when something happens, then a precise result." for i in range(1, 120))
    propose(f, slack=long_slack)
    eng.sync()
    parts = [m for m in f.thread if m["user"] == BOT][2:]
    assert len(parts) >= 3 and all(len(m["text"]) <= cfg["slack"]["max_message_chars"] for m in parts)
    assert "AC1:" in parts[0]["text"] and "AC119:" in parts[-1]["text"]
    n = len(f.calls)
    eng.sync()  # the extra parts don't count as a new bot message
    assert len(f.calls) == n
    f.reactions[parts[-1]["ts"]] = [{"name": "white_check_mark", "users": [PO]}]  # ✅ on any part
    eng.sync()
    assert labels(f) == [cfg["github"]["labels"]["ready"]]


def test_signature_and_slack_split_proposal():
    cfg, f, eng = setup()
    eng.kickoff(7)
    first = f.say(BOT, "📋 PROPOSED FINAL REQUIREMENT part 1")
    f.say(BOT, "part 2")
    f.comments.append(f"<!-- proposal: {first} -->\nposted\n<!-- body-start -->\n## Summary\nlive\n<!-- body-end -->")
    f.say(PO, "approved\n*Sent using* Claude")
    eng.sync()
    assert labels(f) == [cfg["github"]["labels"]["ready"]] and f.issue["body"].startswith("## Summary\nlive")


def test_rerefine_approved_issue():
    cfg, f, eng = setup()
    lb, g = cfg["github"]["labels"], cfg["messages"]["github"]
    f.issue["body"] = (f"## Summary\nv1\n\n---\n<details><summary>{g['original_request']}</summary>\n\n"
                       "Users check habits off daily.\n\n</details>")
    f.issue["labels"] = [{"name": lb["ready"]}, {"name": lb["needs"]}]
    eng.kickoff(7)
    assert labels(f) == [lb["active"]]
    f.say(PO, "rest ok")
    propose(f, final="## Summary\nv2")
    eng.sync()
    f.say(PO, "approved")
    eng.sync()
    body = f.issue["body"]
    assert body.startswith("## Summary\nv2") and "v1" not in body
    assert body.count("<details>") == 1 and "Users check habits off daily." in body


def test_reopened_issue_ignores_old_proposal():
    cfg, f, eng = setup()
    eng.kickoff(7)
    f.comments.append("<!-- proposal: 1.0 -->\nold\n<!-- body-start -->\nOLD\n<!-- body-end -->")
    f.say(PO, "approved")
    f.next_answer = {"action": "follow_up", "slack_message": "Which questions?"}
    eng.sync()
    assert cfg["github"]["labels"]["ready"] not in labels(f)


# ---------- delivery: the developer agent ----------

RUN = "https://github.com/x/y/actions/runs/1"


def delivery_setup(*label_keys):
    cfg = make_cfg()
    f = Fake(cfg)
    names = {**cfg["github"]["labels"], **{f"dev_{k}": v for k, v in cfg["delivery"]["labels"].items()}}
    f.issue["labels"] = [{"name": names[k]} for k in label_keys]
    d = Delivery(cfg, f.gh, f.slack, log=lambda *_: None, root=Path(tempfile.mkdtemp()))
    return cfg, f, d


def test_developer_agent_files():
    agent = catalog.load_agent("developer")
    assert [s.name for s in agent.skills] == \
        ["implement-issue", "tests-from-acceptance-criteria", "code-map", "pr-description"]
    impl = agent.skill("implement-issue")
    assert "$issue" in impl.body and "$branch" in impl.body
    import json
    settings = json.loads((config.ROOT / make_cfg()["delivery"]["settings"]).read_text())
    deny = settings["permissions"]["deny"]
    for protected in (".github/**", ".claude/**", "specs/**", "config/**", "automation/**"):
        assert f"Edit({protected})" in deny and f"Write({protected})" in deny, protected
    assert "Edit(app/**)" in settings["permissions"]["allow"]
    assert (config.ROOT / "app" / "ARCHITECTURE.md").exists()


def test_agent_args_come_from_config():
    cfg, _, d = delivery_setup()
    args = d.agent_args()
    assert args["claude_args"].startswith(f"--agent {cfg['delivery']['agent']} --model ")
    assert f"--max-turns {cfg['delivery']['max_turns']}" in args["claude_args"]
    assert args["settings"] == cfg["delivery"]["settings"]


def test_dev_start_only_on_ready_issues():
    cfg, f, d = delivery_setup("dev_trigger")  # implement label, but not ready-for-dev
    assert d.start(7, RUN) == {"go": "false"}
    assert labels(f) == [] and "only starts on issues labelled" in f.comments[-1]
    cfg, f, d = delivery_setup("ready")  # some other label event: nothing happens
    assert d.start(7, RUN) == {"go": "false"} and not f.comments


def test_dev_start_prepares_the_run():
    cfg, f, d = delivery_setup("ready", "dev_trigger")
    f.comments.append("<!-- slack-thread: C1/100.000001 -->")
    out = d.start(7, RUN)
    assert out["go"] == "true" and out["branch"] == "dev/issue-7"
    assert out["prompt"] == "/implement-issue 7 dev/issue-7" and "--agent developer" in out["claude_args"]
    assert labels(f) == [cfg["delivery"]["labels"]["active"]]
    assert "Developer agent started" in f.thread[-1]["text"] and RUN in f.thread[-1]["text"]


def test_dev_finish_reports_the_agents_pr():
    cfg, f, d = delivery_setup("dev_active")
    f.comments.append("<!-- slack-thread: C1/100.000001 -->")  # refined issue: reply in its thread
    f.pulls[200] = {"number": 200, "html_url": "https://github.com/x/y/pull/200", "merged": False,
                    "head": {"ref": "dev/issue-7"}}
    d.finish(7, RUN)
    assert labels(f) == [cfg["delivery"]["labels"]["review"]]
    assert "pull/200" in f.comments[-1] and f.broadcasts and "pull/200" in f.broadcasts[-1]


def test_dev_finish_opens_pr_for_pushed_branch_or_hands_it_over():
    cfg, f, d = delivery_setup("dev_active")
    f.branches["dev/issue-7"] = {"app/x.ts": "code"}
    d.finish(7, RUN)
    pr = f.pulls[100]
    assert pr["head"]["ref"] == "dev/issue-7" and labels(f) == [cfg["delivery"]["labels"]["review"]]
    cfg, f, d = delivery_setup("dev_active")
    f.branches["dev/issue-7"] = {"app/x.ts": "code"}
    f.pr_fails = True
    d.finish(7, RUN)
    assert "compare/main...dev/issue-7?expand=1" in f.thread[-1]["text"]  # no thread: posted in channel
    assert labels(f) == [cfg["delivery"]["labels"]["review"]]


def test_dev_finish_without_code_goes_back_to_ready():
    cfg, f, d = delivery_setup("dev_active")
    d.finish(7, RUN)
    assert labels(f) == [cfg["github"]["labels"]["ready"]] and RUN in f.comments[-1]


def test_merged_dev_pr_closes_the_issue():
    cfg, f, d = delivery_setup("dev_review")
    f.branches["dev/issue-7"] = {}
    f.pulls[200] = {"number": 200, "html_url": "https://github.com/x/y/pull/200", "merged": True,
                    "head": {"ref": "dev/issue-7"}}
    d.pr_merged(200)
    assert labels(f) == [cfg["delivery"]["labels"]["done"]] and f.issue["state"] == "closed"
    assert "merged and done" in f.thread[-1]["text"] and "dev/issue-7" not in f.branches


def test_merged_spec_pr_still_marks_ready():
    cfg, f, d = delivery_setup("spec_review")
    f.pulls[300] = {"number": 300, "html_url": "u", "merged": True, "head": {"ref": "spec/issue-7"}}
    d.pr_merged(300)
    assert labels(f) == [cfg["github"]["labels"]["ready"]] and f.issue["state"] == "open"


if __name__ == "__main__":
    tests = [(k, v) for k, v in dict(globals()).items() if k.startswith("test_") and callable(v)]
    for name, fn in tests:
        fn()
        print("ok ", name)
    print(f"\nAll {len(tests)} tests passed.")
