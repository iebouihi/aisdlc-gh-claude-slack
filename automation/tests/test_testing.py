"""Offline tests of the test phase (code PR open -> tester agent -> report -> qa-approved -> merge)
with fake GitHub and Slack, using the real config and agent files.

Run: python -m automation.tests.test_testing
"""
import json
import tempfile
from pathlib import Path

from automation.refinement import catalog, config
from automation.refinement.bugs import BugFix
from automation.refinement.testing import TEST_REPORT_MARK, Testing
from automation.tests.test_refinement import Fake, labels, make_cfg

RUN = "https://github.com/x/y/actions/runs/9"
THREAD = "<!-- slack-thread: C1/100.000001 -->"

REPORT = """---
verdict: pass
summary: All 4 acceptance criteria pass on desktop and mobile; no regressions.
acceptance: 4/4
regressions: 0
---
### Acceptance criteria
| AC | Test | Desktop | Mobile |
|---|---|---|---|
| AC1 | `issue-7.spec.ts` › "AC1 (#7): …" | ✅ | ✅ |
"""


def setup(*label_keys, pr_branch="dev/issue-7"):
    cfg = make_cfg()
    f = Fake(cfg)
    names = {**{f"test_{k}": v for k, v in cfg["testing"]["labels"].items()},
             **{f"dev_{k}": v for k, v in cfg["delivery"]["labels"].items()}, **cfg["github"]["labels"]}
    f.issue["labels"] = [{"name": names[k]} for k in label_keys]
    f.comments.append(THREAD)
    if pr_branch:
        f.pulls[200] = {"number": 200, "html_url": "https://github.com/x/y/pull/200", "merged": False,
                        "head": {"ref": pr_branch, "sha": "head-sha"}}
    root = Path(tempfile.mkdtemp())
    t = Testing(cfg, f.gh, f.slack, log=lambda *_: None, root=root)
    return cfg, f, t, root


def write_report(root, cfg, text=REPORT):
    path = root / cfg["testing"]["report_file"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def test_tester_agent_files_and_permissions():
    cfg = make_cfg()
    agent = catalog.load_agent(cfg["testing"]["agent"])
    assert agent.name == "tester" and agent.description
    assert [s.name for s in agent.skills] == \
        ["test-feature", "e2e-from-acceptance-criteria", "regression-guard", "exploratory-testing", "test-report"]
    body = agent.skill("test-feature").body
    assert "$issue" in body and "$branch" in body and "$report" in body and "Impact on existing features" in body
    perms = json.loads((config.ROOT / cfg["testing"]["settings"]).read_text())["permissions"]
    assert "Write(app/e2e/**)" in perms["allow"] and "Write(.agent/**)" in perms["allow"]
    for protected in ("app/src/**", "specs/**", "design/**", ".github/**", ".claude/**", "config/**"):
        assert f"Write({protected})" in perms["deny"] and f"Edit({protected})" in perms["deny"], protected
    assert "Bash(gh pr merge *)" in perms["deny"]
    assert (config.ROOT / "app" / "playwright.config.ts").exists()
    assert list((config.ROOT / "app" / "e2e" / "regression").glob("*.spec.ts"))


def test_test_phase_starts_when_the_code_pr_opens():
    cfg, f, t, _ = setup("dev_review")
    out = t.test_start(7, "", RUN)  # called by the developer workflow: no label
    assert out["go"] == "true" and out["branch"] == "dev/issue-7"
    assert out["prompt"] == f"/test-feature 7 dev/issue-7 {cfg['testing']['report_file']}"
    assert out["claude_args"].startswith("--agent tester ") and out["settings"] == cfg["testing"]["settings"]
    assert labels(f) == [cfg["testing"]["labels"]["active"]]
    assert "Tester agent started" in f.thread[-1]["text"] and "pull/200" in f.thread[-1]["text"]


def test_fix_prs_are_tested_too():
    cfg, f, t, _ = setup("dev_review", pr_branch="fix/issue-7")
    assert t.test_start(7, "", RUN)["branch"] == "fix/issue-7"


def test_nothing_to_test_without_an_open_code_pr():
    cfg, f, t, _ = setup("dev_review", pr_branch=None)
    assert t.test_start(7, "", RUN) == {"go": "false"} and not f.thread
    cfg, f, t, _ = setup("test_trigger", pr_branch=None)
    assert t.test_start(7, cfg["testing"]["labels"]["trigger"], RUN) == {"go": "false"}
    assert labels(f) == [] and "none found" in f.comments[-1]


def test_other_labels_do_nothing():
    cfg, f, t, _ = setup("dev_review")
    assert t.test_start(7, "documentation", RUN) == {"go": "false"}
    assert labels(f) == [cfg["delivery"]["labels"]["review"]] and f.comments == [THREAD]


def test_test_label_retests():
    cfg, f, t, _ = setup("test_review", "test_trigger")
    out = t.test_start(7, cfg["testing"]["labels"]["trigger"], RUN)
    assert out["go"] == "true" and labels(f) == [cfg["testing"]["labels"]["active"]]


def test_passing_report_is_posted_and_waits_for_qa_approval():
    cfg, f, t, root = setup("test_active")
    write_report(root, cfg)
    t.test_finish(7, RUN)
    assert labels(f) == [cfg["testing"]["labels"]["review"]]
    issue_comment = f.comments[-1]
    assert issue_comment.startswith(TEST_REPORT_MARK) and "Verdict: **pass**" in issue_comment
    assert "Acceptance criteria: **4/4**" in issue_comment and "verdict: pass" not in issue_comment
    assert f"`{cfg['testing']['labels']['approved']}`" in issue_comment
    assert f.other_comments[200] == [issue_comment]  # also on the PR
    sha, status = f.statuses[-1]
    assert sha == "head-sha" and status["state"] == "pending" and status["context"] == "QA"
    assert "Tests passed" in f.broadcasts[-1] and "4/4" in f.broadcasts[-1]


def test_failing_report_fails_the_qa_status():
    cfg, f, t, root = setup("test_active")
    write_report(root, cfg, REPORT.replace("verdict: pass", "verdict: fail").replace("regressions: 0", "regressions: 1"))
    t.test_finish(7, RUN)
    assert f.statuses[-1][1]["state"] == "failure" and "Tests failed" in f.thread[-1]["text"]
    assert "@claude" in f.thread[-1]["text"] and labels(f) == [cfg["testing"]["labels"]["review"]]


def test_unknown_verdict_counts_as_blocked():
    cfg, f, t, root = setup("test_active")
    write_report(root, cfg, REPORT.replace("verdict: pass", "verdict: maybe"))
    t.test_finish(7, RUN)
    assert "Verdict: **blocked**" in f.comments[-1] and f.statuses[-1][1]["state"] == "failure"


def test_missing_report_goes_back_to_review():
    cfg, f, t, _ = setup("test_active")
    t.test_finish(7, RUN)
    assert labels(f) == [cfg["delivery"]["labels"]["review"]] and "without a report" in f.thread[-1]["text"]
    assert not f.statuses


def test_qa_approval_sets_the_status_and_readies_the_merge():
    cfg, f, t, _ = setup("test_review", "test_approved")
    assert t.test_start(7, cfg["testing"]["labels"]["approved"], RUN) == {"go": "false"}
    assert f.statuses[-1][1]["state"] == "success"
    assert sorted(labels(f)) == sorted([cfg["delivery"]["labels"]["review"], cfg["testing"]["labels"]["approved"]])
    assert "QA approved" in f.thread[-1]["text"] and "pull/200" in f.thread[-1]["text"]


def test_qa_approval_needs_an_open_code_pr():
    cfg, f, t, _ = setup("test_approved", pr_branch=None)
    t.test_start(7, cfg["testing"]["labels"]["approved"], RUN)
    assert labels(f) == [] and not f.statuses and "none found" in f.comments[-1]


def test_merge_after_qa_closes_the_issue_and_clears_test_labels():
    cfg, f, _, _ = setup("dev_review", "test_approved", "test_review")
    f.pulls[200]["merged"] = True
    BugFix(cfg, f.gh, f.slack, log=lambda *_: None).pr_merged(200)
    assert sorted(labels(f)) == sorted([cfg["delivery"]["labels"]["done"], cfg["testing"]["labels"]["approved"]])
    assert f.issue["state"] == "closed"


def test_developer_finish_tells_the_workflow_to_test():
    cfg, f, t, _ = setup("dev_active")
    assert t.finish(7, RUN) == {"review": "true"}
    cfg, f, t, _ = setup("dev_active", pr_branch=None)
    assert t.finish(7, RUN) == {"review": "false"}


if __name__ == "__main__":
    tests = [(k, v) for k, v in dict(globals()).items() if k.startswith("test_") and callable(v)]
    for name, fn in tests:
        fn()
        print("ok ", name)
    print(f"\nAll {len(tests)} tests passed.")
