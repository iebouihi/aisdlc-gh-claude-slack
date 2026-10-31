"""Offline tests of the bug-fix flow (investigate -> validate -> fix -> merge) with fake GitHub and
Slack, using the real config and agent files. The feature flow is covered by test_refinement.

Run: python -m automation.tests.test_bugs
"""
import json
import tempfile
from pathlib import Path

from automation.refinement import catalog, config
from automation.refinement.bugs import ROOT_CAUSE_MARK, BugFix
from automation.tests.test_refinement import Fake, labels, make_cfg

RUN = "https://github.com/x/y/actions/runs/9"

REPORT = """---
verdict: bug
confidence: high
summary: Reloading drops the icon because parseHabits rejects it.
---
### Reproduction
- Failing test: `src/lib/habits.test.ts` > "BUG #7: icon survives a reload"

### Root cause
`parseHabits` treats a known icon as unknown.

### Fix plan
- Accept catalog icons in `parseHabits`.
"""


def setup(*label_keys, issue_type="Bug"):
    cfg = make_cfg()
    f = Fake(cfg)
    names = {**{f"bug_{k}": v for k, v in cfg["bugs"]["labels"].items()},
             **{f"dev_{k}": v for k, v in cfg["delivery"]["labels"].items()}, **cfg["github"]["labels"]}
    f.issue.update(title="[BUG] Icon lost after reload", body="Steps: add a habit with an icon, reload.",
                   labels=[{"name": names[k]} for k in label_keys],
                   type={"name": issue_type} if issue_type else None)
    root = Path(tempfile.mkdtemp())
    bug = BugFix(cfg, f.gh, f.slack, log=lambda *_: None, root=root)
    return cfg, f, bug, root


def write_report(root, cfg, text=REPORT):
    path = root / cfg["bugs"]["report_file"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def test_bug_agent_files_and_permissions():
    cfg = make_cfg()
    inv = catalog.load_agent(cfg["bugs"]["investigator"]["agent"])
    assert [s.name for s in inv.skills] == ["investigate-bug", "root-cause-report"]
    assert "$issue" in inv.skill("investigate-bug").body and "$report" in inv.skill("investigate-bug").body
    assert catalog.load_skill("fix-bug").body.count("$branch") >= 1
    perms = json.loads((config.ROOT / cfg["bugs"]["investigator"]["settings"]).read_text())["permissions"]
    for blocked in ("Bash(git commit *)", "Bash(git push *)", "Bash(gh pr *)", "Edit(specs/**)", "Edit(.github/**)"):
        assert blocked in perms["deny"], blocked
    assert "Write(.agent/**)" in perms["allow"]
    template = (config.ROOT / ".github" / "ISSUE_TEMPLATE" / "bug-report.yml").read_text()
    assert f"type: {cfg['bugs']['type']}" in template


def test_need_fix_on_a_non_bug_issue_is_refused():
    cfg, f, bug, _ = setup("bug_trigger", issue_type="Feature")
    out = bug.bug_start(7, cfg["bugs"]["labels"]["trigger"], RUN)
    assert out["go"] == "false" and labels(f) == [] and "only on issues of type" in f.comments[-1]
    assert not f.thread  # nothing in Slack


def test_other_labels_do_nothing():
    cfg, f, bug, _ = setup("bug_trigger")
    assert bug.bug_start(7, "documentation", RUN)["go"] == "false"
    assert labels(f) == [cfg["bugs"]["labels"]["trigger"]] and not f.comments and not f.thread


def test_need_fix_starts_the_investigation_and_announces_it():
    cfg, f, bug, _ = setup("bug_trigger")
    out = bug.bug_start(7, cfg["bugs"]["labels"]["trigger"], RUN)
    assert out["go"] == "true" and out["mode"] == "investigate"
    assert out["prompt"] == f"/investigate-bug 7 {cfg['bugs']['report_file']}"
    assert out["claude_args"].startswith("--agent bug-investigator ")
    assert out["settings"] == cfg["bugs"]["investigator"]["settings"]
    assert labels(f) == [cfg["bugs"]["labels"]["analyzing"]]
    assert len(f.thread) == 1 and "being analyzed" in f.thread[0]["text"]  # status only, no questions
    assert "<!-- slack-thread: C1/" in f.comments[-1]


def test_report_posted_and_waits_for_validation():
    cfg, f, bug, root = setup("bug_trigger")
    bug.bug_start(7, cfg["bugs"]["labels"]["trigger"], RUN)
    write_report(root, cfg)
    bug.bug_finish(7, "investigate", RUN)
    assert labels(f) == [cfg["bugs"]["labels"]["proposed"]]
    comment = f.comments[-1]
    assert comment.startswith(ROOT_CAUSE_MARK) and "Verdict: **bug**" in comment and "Confidence: **high**" in comment
    assert "### Root cause" in comment and "verdict: bug" not in comment  # frontmatter not shown
    assert f"`{cfg['bugs']['labels']['approved']}`" in comment
    assert "Root cause ready" in f.thread[-1]["text"] and "parseHabits rejects it" in f.thread[-1]["text"]


def test_verdicts_route_to_the_right_state():
    for verdict, key in [("spec-gap", "spec_gap"), ("not-a-bug", "not_a_bug"), ("needs-info", "needs_info"),
                         ("cannot-reproduce", "needs_info"), ("whatever", "proposed")]:
        cfg, f, bug, root = setup("bug_analyzing")
        write_report(root, cfg, REPORT.replace("verdict: bug", f"verdict: {verdict}"))
        bug.bug_finish(7, "investigate", RUN)
        assert labels(f) == [cfg["bugs"]["labels"][key]], (verdict, labels(f))


def test_missing_report_is_reported():
    cfg, f, bug, _ = setup("bug_analyzing")
    bug.bug_finish(7, "investigate", RUN)
    assert labels(f) == [] and RUN in f.comments[-1] and "no report" in f.thread[-1]["text"]


def test_reinvestigation_replaces_the_state_and_reuses_the_thread():
    cfg, f, bug, _ = setup("bug_needs_info", "bug_trigger")
    f.comments.append("<!-- slack-thread: C1/100.000001 -->")
    bug.bug_start(7, cfg["bugs"]["labels"]["trigger"], RUN)
    assert labels(f) == [cfg["bugs"]["labels"]["analyzing"]]
    assert "analyzed again" in f.thread[-1]["text"]


def test_fix_requires_a_validated_analysis():
    cfg, f, bug, _ = setup("bug_approved")  # approved without a proposal
    out = bug.bug_start(7, cfg["bugs"]["labels"]["approved"], RUN)
    assert out["go"] == "false" and labels(f) == [] and "only after a root-cause analysis" in f.comments[-1]


def test_validation_starts_the_fix_with_the_developer_agent():
    cfg, f, bug, _ = setup("bug_proposed", "bug_approved")
    out = bug.bug_start(7, cfg["bugs"]["labels"]["approved"], RUN)
    assert out["go"] == "true" and out["mode"] == "fix" and out["branch"] == "fix/issue-7"
    assert out["prompt"] == "/fix-bug 7 fix/issue-7"
    assert out["claude_args"].startswith(f"--agent {cfg['delivery']['agent']} ")
    assert out["settings"] == cfg["delivery"]["settings"]
    assert labels(f) == [cfg["delivery"]["labels"]["active"]]


def test_fix_pr_review_and_merge_close_the_bug():
    cfg, f, bug, _ = setup("dev_active")
    f.comments.append("<!-- slack-thread: C1/100.000001 -->")
    f.pulls[400] = {"number": 400, "html_url": "https://github.com/x/y/pull/400", "merged": False,
                    "head": {"ref": "fix/issue-7"}}
    bug.bug_finish(7, "fix", RUN)
    assert labels(f) == [cfg["delivery"]["labels"]["review"]]
    assert "Fix ready for review" in f.thread[-1]["text"] and "pull/400" in f.thread[-1]["text"]
    f.pulls[400]["merged"] = True
    f.branches["fix/issue-7"] = {}
    bug.pr_merged(400)
    assert labels(f) == [cfg["delivery"]["labels"]["done"]] and f.issue["state"] == "closed"
    assert "is fixed" in f.thread[-1]["text"] and "fix/issue-7" not in f.branches


def test_fix_without_code_goes_back_to_validation():
    cfg, f, bug, _ = setup("dev_active")
    bug.bug_finish(7, "fix", RUN)
    assert labels(f) == [cfg["bugs"]["labels"]["proposed"]] and "without pushing a fix" in f.thread[-1]["text"]


def test_fix_branch_handed_over_when_pr_not_allowed():
    cfg, f, bug, _ = setup("dev_active")
    f.branches["fix/issue-7"] = {"app/x.ts": "fix"}
    f.pr_fails = True
    bug.bug_finish(7, "fix", RUN)
    assert "compare/main...fix/issue-7?expand=1" in f.thread[-1]["text"]


def test_feature_merge_unchanged_through_bugfix():
    """The PR-merged entry point now uses BugFix; feature and spec PRs behave exactly as before."""
    cfg, f, bug, _ = setup("dev_review", issue_type=None)
    f.pulls[200] = {"number": 200, "html_url": "https://github.com/x/y/pull/200", "merged": True,
                    "head": {"ref": "dev/issue-7"}}
    bug.pr_merged(200)
    assert labels(f) == [cfg["delivery"]["labels"]["done"]] and "merged and done" in f.thread[-1]["text"]
    cfg, f, bug, _ = setup("spec_review", issue_type=None)
    f.pulls[300] = {"number": 300, "html_url": "u", "merged": True, "head": {"ref": "spec/issue-7"}}
    bug.pr_merged(300)
    assert labels(f) == [cfg["github"]["labels"]["ready"]] and f.issue["state"] == "open"


if __name__ == "__main__":
    tests = [(k, v) for k, v in dict(globals()).items() if k.startswith("test_") and callable(v)]
    for name, fn in tests:
        fn()
        print("ok ", name)
    print(f"\nAll {len(tests)} tests passed.")
