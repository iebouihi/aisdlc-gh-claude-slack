"""Delivery: start the developer agent on a ready issue, report its pull request, close on merge.

The coding itself is done by the Claude Code GitHub Action running the `developer` agent
(.claude/agents/developer.md) with the `implement-issue` skill. This module only prepares the
run, reports the outcome in GitHub and Slack, and moves the labels.
"""
import shlex

from .engine import Refinement


class Delivery(Refinement):
    def __init__(self, cfg, github, slack, **kw):
        super().__init__(cfg, agent=None, github=github, slack=slack, claude=None, **kw)
        self.dv = cfg["delivery"]
        self.dl = self.dv["labels"]

    def branch(self, n):
        return f"{self.dv['branch_prefix']}{n}"

    def agent_args(self):
        """CLI arguments and settings for the Claude Code GitHub Action, from config."""
        args = f"--agent {shlex.quote(self.dv['agent'])} --model {shlex.quote(self.dv['model'])} " \
               f"--max-turns {int(self.dv['max_turns'])}"
        return {"claude_args": args, "settings": self.dv["settings"]}

    def thread_root(self, n):
        thread = self.thread_of(self.gh("GET", f"/issues/{n}/comments?per_page=100"))
        return thread[1] if thread else None

    def notify(self, n, slack_text, broadcast=False):
        root = self.thread_root(n)
        if root:
            self.post(slack_text, thread_ts=root, broadcast=broadcast)
        else:  # issue refined before Slack threads existed: post in the channel
            self.post(slack_text)

    # ---------- start ----------

    def start(self, n, run_url):
        """Decide whether the agent runs; returns the outputs the workflow passes to the Action."""
        issue = self.gh("GET", f"/issues/{n}")
        labels, g = self.labels_of(issue), self.gh_text
        if self.dl["trigger"] not in labels or issue["state"] != "open":
            return {"go": "false"}
        if self.labels["ready"] not in labels:
            self.swap_label(n, remove=[self.dl["trigger"]])
            self.comment(n, g["dev_not_ready"].format(ready=self.labels["ready"], trigger=self.dl["trigger"]))
            self.log(f"#{n}: not ready, agent not started")
            return {"go": "false"}
        branch = self.branch(n)
        self.swap_label(n, remove=[self.dl["trigger"], self.labels["ready"]], add=[self.dl["active"]])
        self.comment(n, g["dev_started"].format(branch=branch, run_url=run_url))
        self.notify(n, self.slack_text["dev_started"].format(number=n, title=issue["title"], branch=branch,
                                                             run_url=run_url))
        self.log(f"#{n}: developer agent starting on {branch}")
        return {"go": "true", "branch": branch,
                "prompt": self.dv["prompt"].format(number=n, branch=branch), **self.agent_args()}

    # ---------- finish ----------

    def finish(self, n, run_url):
        """After the agent: link its PR (or open one, or hand over the branch), or report no code."""
        issue = self.gh("GET", f"/issues/{n}")
        g, s, branch = self.gh_text, self.slack_text, self.branch(n)
        base = self.cfg["github"]["base_branch"]
        owner = self.cfg["github"]["repo"].split("/")[0]
        fields = {"number": n, "title": issue["title"], "branch": branch, "run_url": run_url,
                  "ready": self.labels["ready"]}

        prs = self.gh("GET", f"/pulls?head={owner}:{branch}&state=open") or []
        if not prs and self.branch_exists(branch):
            try:
                prs = [self.gh("POST", "/pulls", json={
                    "title": g["dev_pr_title"].format(**fields), "head": branch, "base": base,
                    "body": g["dev_pr_body"].format(**fields)})]
            except Exception as e:  # Actions not allowed to open PRs: hand over the branch
                self.log(f"::warning::dev PR not opened: {e}")
                compare = issue["html_url"].split("/issues/")[0] + f"/compare/{base}...{branch}?expand=1"
                self.comment(n, g["dev_branch"].format(compare_url=compare, **fields))
                self.swap_label(n, remove=[self.dl["active"]], add=[self.dl["review"]])
                self.notify(n, s["dev_branch"].format(compare_url=compare, **fields), broadcast=True)
                return
        if prs:
            pr = prs[0]
            self.comment(n, g["dev_pr"].format(pr_url=pr["html_url"]))
            self.swap_label(n, remove=[self.dl["active"]], add=[self.dl["review"]])
            self.notify(n, s["dev_pr"].format(pr_url=pr["html_url"], pr_number=pr["number"], **fields),
                        broadcast=True)
            self.log(f"#{n}: in review, PR #{pr['number']}")
            return
        self.comment(n, g["dev_no_changes"].format(**fields))
        self.swap_label(n, remove=[self.dl["active"]], add=[self.labels["ready"]])
        self.notify(n, s["dev_no_changes"].format(**fields))
        self.log(f"#{n}: agent pushed no code")

    # ---------- merged ----------

    def pr_merged(self, pr_number):
        """A merged PR: living spec -> issue ready; developer PR -> issue done and closed."""
        pr = self.gh("GET", f"/pulls/{pr_number}")
        ref = pr["head"]["ref"]
        if not pr.get("merged"):
            return
        if ref.startswith(self.sp["branch_prefix"]):
            return self.spec_merged(pr_number)
        if not ref.startswith(self.dv["branch_prefix"]):
            self.log(f"PR #{pr_number}: not an automation branch, skipped")
            return
        n = int(ref[len(self.dv["branch_prefix"]):])
        issue = self.gh("GET", f"/issues/{n}")
        self.swap_label(n, remove=[self.dl["review"], self.dl["active"]], add=[self.dl["done"]])
        self.comment(n, self.gh_text["dev_done"].format(pr_url=pr["html_url"]))
        if issue["state"] == "open":
            self.gh("PATCH", f"/issues/{n}", json={"state": "closed", "state_reason": "completed"})
        self.notify(n, self.slack_text["dev_done"].format(number=n, title=issue["title"], pr_url=pr["html_url"],
                                                          pr_number=pr["number"]))
        if self.branch_exists(ref):
            self.gh("DELETE", f"/git/refs/heads/{ref}")
        self.log(f"#{n}: done")
