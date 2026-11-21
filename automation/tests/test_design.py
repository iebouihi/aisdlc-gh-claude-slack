"""Offline tests of the design step (ready-for-design -> design or skip-design -> design PR ->
merged -> ready-for-dev) with fake GitHub and Slack, using the real config and agent files.

Run: python -m automation.tests.test_design
"""
import json
import tempfile
from pathlib import Path

from automation.refinement import catalog, config
from automation.refinement.bugs import BugFix
from automation.refinement.design import Design
from automation.tests.test_refinement import BOT, DEV, PO, Fake, labels, make_cfg

RUN = "https://github.com/x/y/actions/runs/9"
THREAD = "<!-- slack-thread: C1/100.000001 -->"
MOCKUP = "design/issue-7/mockup.html"


def setup(*label_keys):
    cfg = make_cfg()
    f = Fake(cfg)
    names = {**{f"design_{k}": v for k, v in cfg["design"]["labels"].items()},
             **{f"dev_{k}": v for k, v in cfg["delivery"]["labels"].items()}, **cfg["github"]["labels"]}
    f.issue["labels"] = [{"name": names[k]} for k in label_keys]
    f.comments.append(THREAD)  # refined issue: status goes to its Slack thread
    d = Design(cfg, f.gh, f.slack, log=lambda *_: None, root=Path(tempfile.mkdtemp()))
    return cfg, f, d


def test_designer_agent_files_and_permissions():
    cfg = make_cfg()
    agent = catalog.load_agent(cfg["design"]["agent"])
    assert agent.name == "designer" and agent.description
    assert [s.name for s in agent.skills] == \
        ["design-feature", "design-guidelines", "technical-spec", "ui-mockup", "technical-summary"]
    body = agent.skill("design-feature").body
    assert "$issue" in body and "$branch" in body and "TECHNICAL-DECISIONS.md" in body
    assert "tokens.css" in agent.skill("ui-mockup").body
    perms = json.loads((config.ROOT / cfg["design"]["settings"]).read_text())["permissions"]
    assert "Edit(design/**)" in perms["allow"] and "Write(design/**)" in perms["allow"]
    for protected in ("app/**", ".github/**", ".claude/**", "specs/**", "config/**", "automation/**"):
        assert f"Edit({protected})" in perms["deny"] and f"Write({protected})" in perms["deny"], protected
    assert "Bash(gh pr merge *)" in perms["deny"]
    for other in (cfg["delivery"]["settings"], cfg["bugs"]["investigator"]["settings"]):
        deny = json.loads((config.ROOT / other).read_text())["permissions"]["deny"]
        assert "Edit(design/**)" in deny and "Write(design/**)" in deny, other
    summary = config.ROOT / cfg["design"]["summary_file"]
    assert summary.exists() and "| TD1 |" in summary.read_text()


def test_developer_reads_the_design():
    dev = catalog.load_agent("developer")
    assert "TECHNICAL-DECISIONS.md" in dev.body and "design/issue-" in dev.skill("implement-issue").body


def test_other_labels_do_nothing():
    cfg, f, d = setup("ready_design")
    assert d.design_start(7, "documentation", RUN) == {"go": "false"}
    assert labels(f) == [cfg["github"]["labels"]["ready_design"]] and f.comments == [THREAD] and not f.thread


def test_design_only_starts_on_ready_for_design_issues():
    cfg, f, d = setup("ready", "design_trigger")  # already ready for dev
    assert d.design_start(7, cfg["design"]["labels"]["trigger"], RUN) == {"go": "false"}
    assert labels(f) == [cfg["github"]["labels"]["ready"]] and "only starts on issues labelled" in f.comments[-1]


def test_design_start_prepares_the_designer_run():
    cfg, f, d = setup("ready_design", "design_trigger")
    out = d.design_start(7, cfg["design"]["labels"]["trigger"], RUN)
    assert out["go"] == "true" and out["branch"] == "design/issue-7"
    assert out["prompt"] == "/design-feature 7 design/issue-7"
    assert out["claude_args"].startswith("--agent designer ") and out["settings"] == cfg["design"]["settings"]
    assert labels(f) == [cfg["design"]["labels"]["active"]]
    assert "Designer agent started" in f.thread[-1]["text"] and RUN in f.thread[-1]["text"]


def test_skip_design_goes_straight_to_ready_for_dev():
    cfg, f, d = setup("ready_design", "design_skip")
    assert d.design_start(7, cfg["design"]["labels"]["skip"], RUN) == {"go": "false"}
    assert labels(f) == [cfg["github"]["labels"]["ready"]]
    assert "skipped" in f.comments[-1] and "ready for dev" in f.thread[-1]["text"]
    assert f"`{cfg['delivery']['labels']['trigger']}`" in f.thread[-1]["text"]


def test_skip_design_only_on_ready_for_design_issues():
    cfg, f, d = setup("design_review", "design_skip")  # design already in review
    d.design_start(7, cfg["design"]["labels"]["skip"], RUN)
    assert labels(f) == [cfg["design"]["labels"]["review"]] and "only applies" in f.comments[-1]


def test_design_finish_reports_the_pr_with_the_mockup():
    cfg, f, d = setup("design_active")
    f.branches["design/issue-7"] = {MOCKUP: "<html>", "design/issue-7/technical-spec.md": "spec"}
    d.design_finish(7, RUN)
    pr = f.pulls[100]
    assert pr["head"]["ref"] == "design/issue-7" and pr["title"].startswith("Design #7")
    assert labels(f) == [cfg["design"]["labels"]["review"]]
    text = f.broadcasts[-1]
    assert "Design ready for review" in text and "pull/100" in text
    assert "htmlpreview.github.io/?https://github.com/x/y/blob/design/issue-7/" + MOCKUP in text


def test_design_without_ui_has_no_mockup_link():
    cfg, f, d = setup("design_active")
    f.branches["design/issue-7"] = {"design/issue-7/technical-spec.md": "spec"}
    d.design_finish(7, RUN)
    assert "Design ready for review" in f.broadcasts[-1] and "Open the mockup" not in f.broadcasts[-1]


def test_design_branch_handed_over_when_pr_not_allowed():
    cfg, f, d = setup("design_active")
    f.branches["design/issue-7"] = {MOCKUP: "<html>"}
    f.pr_fails = True
    d.design_finish(7, RUN)
    assert "compare/main...design/issue-7?expand=1" in f.thread[-1]["text"]
    assert labels(f) == [cfg["design"]["labels"]["review"]]


def test_design_without_output_goes_back_to_ready_for_design():
    cfg, f, d = setup("design_active")
    d.design_finish(7, RUN)
    assert labels(f) == [cfg["github"]["labels"]["ready_design"]]
    assert "without pushing a design" in f.thread[-1]["text"] and RUN in f.comments[-1]


def test_merged_design_pr_makes_the_issue_ready_for_dev():
    cfg, f, _ = setup("design_review")
    bug = BugFix(cfg, f.gh, f.slack, log=lambda *_: None)  # the pr-merged entry point
    f.branches["design/issue-7"] = {}
    f.branches["main"] = {MOCKUP: "<html>"}
    f.pulls[200] = {"number": 200, "html_url": "https://github.com/x/y/pull/200", "merged": True,
                    "head": {"ref": "design/issue-7"}}
    bug.pr_merged(200)
    assert labels(f) == [cfg["github"]["labels"]["ready"]] and f.issue["state"] == "open"
    assert "pull/200" in f.comments[-1] and "Design of #7" in f.thread[-1]["text"]
    assert "blob/main/" + MOCKUP in f.thread[-1]["text"] and "design/issue-7" not in f.branches


def test_merged_design_pr_without_pending_review_is_ignored():
    cfg, f, d = setup("ready")
    f.pulls[200] = {"number": 200, "html_url": "u", "merged": True, "head": {"ref": "design/issue-7"}}
    d.pr_merged(200)
    assert labels(f) == [cfg["github"]["labels"]["ready"]] and f.comments == [THREAD]


def test_developer_cannot_start_before_the_design():
    cfg, f, d = setup("ready_design", "dev_trigger")
    assert d.start(7, RUN) == {"go": "false"} and labels(f) == [cfg["github"]["labels"]["ready_design"]]
    hint = f.comments[-1]  # tells people what to do instead
    assert "design comes first" in hint and f"`{cfg['design']['labels']['trigger']}`" in hint
    assert f"`{cfg['design']['labels']['skip']}`" in hint


def test_claude_mentions_use_the_agent_of_the_branch():
    cfg, _, d = setup()
    assert d.agent_for_branch("design/issue-7")["claude_args"].startswith("--agent designer ")
    assert d.agent_for_branch("design/issue-7")["settings"] == cfg["design"]["settings"]
    for branch in ("dev/issue-7", "fix/issue-7", ""):
        assert d.agent_for_branch(branch)["claude_args"].startswith("--agent developer "), branch


# ---------- review remarks from Slack ----------

def review_setup():
    cfg, f, d = setup("design_review")
    f.comments[0] = "<!-- slack-thread: C1/1000.000001 -->"
    f.pulls[300] = {"number": 300, "html_url": "https://github.com/x/y/pull/300", "merged": False,
                    "head": {"ref": "design/issue-7"}, "created_at": "2001-09-09T02:40:00Z"}  # ts 1000003440
    f.branches["design/issue-7"] = {MOCKUP: "<html>"}
    f.thread[:] = [{"ts": "1000.000001", "user": BOT, "bot_id": "B1", "text": "Refinement"},
                   {"ts": "1000002000.000001", "user": DEV, "text": "@Claude old remark, before the design PR"}]
    f.clock = 1000004000
    return cfg, f, d


def test_slack_remarks_mentioning_claude_start_a_revise_run():
    cfg, f, d = review_setup()
    f.say(PO, "looks good overall")  # no mention: just discussion
    f.say(DEV, f"<@{BOT}> make the mood buttons bigger\nand show the empty state")
    f.say(PO, "@claude use the accent colour for the selected mood")
    d.remarks()
    assert labels(f) == [cfg["design"]["labels"]["active"]]
    assert f.dispatches == [(cfg["design"]["remarks"]["workflow"],
                             {"ref": "main", "inputs": {"issue": "7", "mode": "revise"}})]
    posted = f.comments[-1]
    assert posted.startswith("<!-- design-remarks: ") and "Design remarks from Slack" in posted and "pull/300" in posted
    assert "> **Sara (dev):** make the mood buttons bigger\n> and show the empty state" in posted
    assert "**Imad (PO):** @claude use the accent colour" in posted
    assert "looks good overall" not in posted and "old remark" not in posted and f"<@{BOT}>" not in posted
    assert "2 remark(s)" in f.thread[-1]["text"] and "Sara (dev), Imad (PO)" in f.thread[-1]["text"]


def test_remarks_are_sent_only_once_and_later_ones_count():
    cfg, f, d = review_setup()
    f.say(DEV, "@Claude bigger buttons")
    d.remarks()
    f.issue["labels"] = [{"name": cfg["design"]["labels"]["review"]}]  # the revise run finished
    d.remarks()
    assert len(f.dispatches) == 1  # nothing new
    f.say(PO, "@Claude and a darker border")
    d.remarks()
    assert len(f.dispatches) == 2 and "darker border" in f.comments[-1] and "bigger buttons" not in f.comments[-1]


def test_no_remarks_without_mention_or_open_pr():
    cfg, f, d = review_setup()
    f.say(DEV, "nice mockup")
    d.remarks()
    assert not f.dispatches and labels(f) == [cfg["design"]["labels"]["review"]]
    f.say(DEV, "@Claude change it")
    f.pulls[300]["merged"] = True  # PR no longer open
    d.remarks()
    assert not f.dispatches


def test_failed_dispatch_puts_the_design_back_in_review():
    cfg, f, d = review_setup()
    f.say(DEV, "@Claude change it")
    f.dispatch_fails = True
    d.remarks()  # error logged, other issues would continue
    assert labels(f) == [cfg["design"]["labels"]["review"]] and not f.dispatches


def test_revise_run_updates_the_same_pr_and_reports_in_slack():
    cfg, f, d = review_setup()
    f.say(DEV, "@Claude bigger buttons")
    d.remarks()
    out = d.revise_start(7, RUN)
    assert out["go"] == "true" and out["branch"] == "design/issue-7" and out["before"] == "base-sha"
    assert out["claude_args"].startswith("--agent designer ") and "Design remarks from Slack" in out["prompt"]
    assert "\n" not in out["prompt"]  # one line for the Action input
    f.shas["design/issue-7"] = "new-sha"
    d.revise_finish(7, RUN, out["before"])
    assert labels(f) == [cfg["design"]["labels"]["review"]]
    assert "Design updated" in f.thread[-1]["text"] and "pull/300" in f.thread[-1]["text"]
    assert "Open the mockup" in f.thread[-1]["text"] and RUN in f.comments[-1]


def test_revise_run_without_change_says_so():
    cfg, f, d = review_setup()
    f.issue["labels"] = [{"name": cfg["design"]["labels"]["active"]}]
    out = d.revise_start(7, RUN)
    d.revise_finish(7, RUN, out["before"])
    assert labels(f) == [cfg["design"]["labels"]["review"]] and "without changing the design" in f.thread[-1]["text"]


def test_revise_needs_an_issue_under_design():
    cfg, f, d = review_setup()  # still design-review: nobody asked for a revision
    assert d.revise_start(7, RUN) == {"go": "false"}


def test_designer_knows_about_slack_remarks():
    body = catalog.load_skill("design-feature").body
    assert "Design remarks from Slack" in body


if __name__ == "__main__":
    tests = [(k, v) for k, v in dict(globals()).items() if k.startswith("test_") and callable(v)]
    for name, fn in tests:
        fn()
        print("ok ", name)
    print(f"\nAll {len(tests)} tests passed.")
