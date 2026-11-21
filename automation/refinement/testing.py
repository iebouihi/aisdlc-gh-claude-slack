"""Test phase: the tester agent tests an open developer or fix pull request; a person approves.

  developer/fix PR opened (dev-agent.yml, bug-flow.yml call test-agent.yml), or `test` label
               -> in-test; the tester agent (.claude/agents/tester.md, Claude Code GitHub Action,
                  test-feature skill) writes Playwright tests for the acceptance criteria, runs
                  the regression suite and writes a report
  report       -> posted on the issue and the PR, summary in Slack; test-review; commit status
                  QA = pending (pass) or failure (fail, blocked)
  qa-approved  -> a person approves: in-review, QA status = success, ready to merge
Merging the PR closes the issue as before (Delivery.pr_merged).
"""
from pathlib import Path

from .catalog import read_markdown
from .delivery import Delivery

TEST_REPORT_MARK = "<!-- test-report -->"


class Testing(Delivery):
    def __init__(self, cfg, github, slack, **kw):
        super().__init__(cfg, github, slack, **kw)
        self.tl = self.tz["labels"]

    def code_pr(self, n):
        """The open developer or fix pull request of an issue, or None."""
        owner = self.cfg["github"]["repo"].split("/")[0]
        for prefix in (self.dv["branch_prefix"], self.cfg["bugs"]["branch_prefix"]):
            prs = self.gh("GET", f"/pulls?head={owner}:{prefix}{n}&state=open") or []
            if prs:
                return prs[0]
        return None

    def fields(self, issue, run_url="", pr=None, **extra):
        return {"number": issue["number"], "title": issue["title"], "run_url": run_url,
                "pr_url": pr["html_url"] if pr else "", "pr_number": pr["number"] if pr else "",
                "branch": pr["head"]["ref"] if pr else "", "trigger": self.tl["trigger"],
                "approved": self.tl["approved"], "context": self.tz["status_context"], **extra}

    def set_status(self, pr, state, key, run_url=""):
        sha = pr["head"].get("sha") or self.gh("GET", f"/pulls/{pr['number']}")["head"]["sha"]
        self.gh("POST", f"/statuses/{sha}", json={
            "state": state, "context": self.tz["status_context"],
            "description": self.gh_text[key][:140], **({"target_url": run_url} if run_url else {})})

    # ---------- start: decide what this event means ----------

    def test_start(self, n, label, run_url):
        """`label` is empty when the developer or fix workflow calls the test phase directly."""
        issue = self.gh("GET", f"/issues/{n}")
        if issue["state"] != "open" or (label and label not in self.labels_of(issue)):
            return {"go": "false"}
        if label == self.tl["approved"]:
            self.approve(issue, run_url)
            return {"go": "false"}
        if label and label != self.tl["trigger"]:
            return {"go": "false"}
        g, pr = self.gh_text, self.code_pr(n)
        if not pr:
            if label:
                self.swap_label(n, remove=[self.tl["trigger"]])
                self.comment(n, g["test_no_pr"].format(**self.fields(issue)))
            self.log(f"#{n}: no open code PR")
            return {"go": "false"}
        f = self.fields(issue, run_url, pr)
        self.swap_label(n, remove=[self.tl["trigger"], self.tl["review"], self.tl["approved"], self.dl["review"]],
                        add=[self.tl["active"]])
        self.comment(n, g["test_started"].format(**f))
        self.notify(n, self.slack_text["test_started"].format(**f))
        report = self.tz["report_file"]
        self.log(f"#{n}: tester agent starting on {f['branch']}")
        return {"go": "true", "branch": f["branch"],
                "prompt": self.tz["prompt"].format(number=n, branch=f["branch"], report=report),
                **self.agent_args(self.tz)}

    # ---------- finish: post the report ----------

    def test_finish(self, n, run_url):
        issue, pr = self.gh("GET", f"/issues/{n}"), self.code_pr(n)
        g, s = self.gh_text, self.slack_text
        path = Path(self.root) / self.tz["report_file"]
        report = path.read_text(encoding="utf-8").strip() if path.exists() else ""
        if not report:
            f = self.fields(issue, run_url, pr)
            self.swap_label(n, remove=[self.tl["active"]], add=[self.dl["review"]])
            self.comment(n, g["test_no_report"].format(**f))
            self.notify(n, s["test_no_report"].format(**f))
            self.log(f"#{n}: no test report")
            return
        meta, body = read_markdown(path)
        verdict = str(meta.get("verdict") or "").strip().lower()
        verdict = verdict if verdict in self.tz["verdicts"] else "blocked"
        f = self.fields(issue, run_url, pr, verdict=verdict, summary=str(meta.get("summary") or "").strip(),
                        acceptance=meta.get("acceptance") or "?", regressions=meta.get("regressions", "?"))
        text = "\n\n".join([TEST_REPORT_MARK + "\n" + g["test_report_header"].format(**f),
                            body[:self.tz["max_report_chars"]].strip(), g[f"test_next_{verdict}"].format(**f)])
        posted = self.gh("POST", f"/issues/{n}/comments", json={"body": text}) or {}
        if pr:  # reviewers read it where they merge
            self.gh("POST", f"/issues/{pr['number']}/comments", json={"body": text})
            self.set_status(pr, "pending" if verdict == "pass" else "failure",
                            "status_pending" if verdict == "pass" else "status_failure", run_url)
        f["link"] = posted.get("html_url") or issue["html_url"]
        self.swap_label(n, remove=[self.tl["active"]], add=[self.tl["review"]])
        self.notify(n, s[f"test_report_{verdict}"].format(**f), broadcast=verdict == "pass")
        self.log(f"#{n}: test report posted, verdict {verdict}")

    # ---------- approval ----------

    def approve(self, issue, run_url=""):
        n, pr = issue["number"], self.code_pr(issue["number"])
        f = self.fields(issue, run_url, pr)
        if not pr:
            self.swap_label(n, remove=[self.tl["approved"]])
            self.comment(n, self.gh_text["qa_no_pr"].format(**f))
            self.log(f"#{n}: no code PR to approve")
            return
        self.set_status(pr, "success", "status_success")
        self.swap_label(n, remove=[self.tl["review"], self.tl["active"]], add=[self.dl["review"]])
        self.comment(n, self.gh_text["qa_approved"].format(**f))
        self.notify(n, self.slack_text["qa_approved"].format(**f))
        self.log(f"#{n}: QA approved, PR #{pr['number']}")
