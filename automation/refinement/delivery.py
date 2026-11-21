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

    def agent_args(self, conf=None):
        """CLI arguments and settings for the Claude Code GitHub Action, from config."""
        conf = conf or self.dv
        args = f"--agent {shlex.quote(conf['agent'])} --model {shlex.quote(conf['model'])} " \
               f"--max-turns {int(conf['max_turns'])}"
        return {"claude_args": args, "settings": conf["settings"]}

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

    def finish(self, n, run_url, kind="dev", branch=None, fallback=None, active=None, review=None, extra=None):
        """After the agent: link its PR (or open one, or hand over the branch), or report no code.

        `kind` picks the texts (dev_* for features, fix_* for bug fixes, design_* for designs);
        `fallback` is the label the issue returns to when the agent pushed nothing; `active` and
        `review` are the state labels of the run (default: the delivery ones); `extra` adds text fields.
        """
        issue = self.gh("GET", f"/issues/{n}")
        g, s = self.gh_text, self.slack_text
        branch = branch or self.branch(n)
        fallback = fallback or self.labels["ready"]
        active, review = active or self.dl["active"], review or self.dl["review"]
        base = self.cfg["github"]["base_branch"]
        owner = self.cfg["github"]["repo"].split("/")[0]
        fields = {"number": n, "title": issue["title"], "branch": branch, "run_url": run_url,
                  "ready": fallback, **(extra or {})}

        prs = self.gh("GET", f"/pulls?head={owner}:{branch}&state=open") or []
        if not prs and self.branch_exists(branch):
            try:
                prs = [self.gh("POST", "/pulls", json={
                    "title": g[f"{kind}_pr_title"].format(**fields), "head": branch, "base": base,
                    "body": g[f"{kind}_pr_body"].format(**fields)})]
            except Exception as e:  # Actions not allowed to open PRs: hand over the branch
                self.log(f"::warning::{kind} PR not opened: {e}")
                compare = issue["html_url"].split("/issues/")[0] + f"/compare/{base}...{branch}?expand=1"
                self.comment(n, g[f"{kind}_branch"].format(compare_url=compare, **fields))
                self.swap_label(n, remove=[active], add=[review])
                self.notify(n, s[f"{kind}_branch"].format(compare_url=compare, **fields), broadcast=True)
                return {"review": "true"}
        if prs:
            pr = prs[0]
            self.comment(n, g[f"{kind}_pr"].format(pr_url=pr["html_url"]))
            self.swap_label(n, remove=[active], add=[review])
            self.notify(n, s[f"{kind}_pr"].format(pr_url=pr["html_url"], pr_number=pr["number"], **fields),
                        broadcast=True)
            self.log(f"#{n}: in review, PR #{pr['number']}")
            return {"review": "true"}
        self.comment(n, g[f"{kind}_no_changes"].format(**fields))
        self.swap_label(n, remove=[active], add=[fallback])
        self.notify(n, s[f"{kind}_no_changes"].format(**fields))
        self.log(f"#{n}: agent pushed no code")
        return {"review": "false"}

    # ---------- merged ----------

    def merge_kinds(self):
        """Branch prefix -> text kind of the code PRs this class closes on merge."""
        return {self.dv["branch_prefix"]: "dev"}

    def mockup(self, n, branch):
        """The Slack mockup link for an issue's design on a branch, or "" when it has no mockup."""
        dz = self.dz
        path = dz["mockup_file"].format(dir=dz["dir"], number=n)
        if not self.gh("GET", f"/contents/{path}?ref={branch}", missing_ok=True):
            return ""
        url = dz["preview_url"].format(repo=self.cfg["github"]["repo"], branch=branch, path=path)
        return self.slack_text["design_mockup"].format(mockup_url=url)

    def design_merged(self, pr):
        """A merged design PR makes its issue ready for development."""
        ref, dl = pr["head"]["ref"], self.dz["labels"]
        n = int(ref[len(self.dz["branch_prefix"]):])
        issue = self.gh("GET", f"/issues/{n}")
        if dl["review"] not in self.labels_of(issue) and dl["active"] not in self.labels_of(issue):
            self.log(f"#{n}: no design review pending, skipped")
            return
        base = self.cfg["github"]["base_branch"]
        fields = {"number": n, "title": issue["title"], "pr_url": pr["html_url"], "pr_number": pr["number"],
                  "trigger": self.dl["trigger"], "mockup": self.mockup(n, base)}
        self.swap_label(n, remove=[dl["review"], dl["active"]], add=[self.labels["ready"]])
        self.comment(n, self.gh_text["design_done"].format(**fields))
        self.notify(n, self.slack_text["design_done"].format(**fields))
        if self.branch_exists(ref):
            self.gh("DELETE", f"/git/refs/heads/{ref}")
        self.log(f"#{n}: design merged, ready for dev")

    def pr_merged(self, pr_number):
        """A merged PR: living spec -> ready for design; design -> ready for dev; code PR -> done and closed."""
        pr = self.gh("GET", f"/pulls/{pr_number}")
        ref = pr["head"]["ref"]
        if not pr.get("merged"):
            return
        if ref.startswith(self.sp["branch_prefix"]):
            return self.spec_merged(pr_number)
        if ref.startswith(self.dz["branch_prefix"]):
            return self.design_merged(pr)
        match = next(((p, k) for p, k in self.merge_kinds().items() if ref.startswith(p)), None)
        if not match:
            self.log(f"PR #{pr_number}: not an automation branch, skipped")
            return
        prefix, kind = match
        n = int(ref[len(prefix):])
        issue = self.gh("GET", f"/issues/{n}")
        self.swap_label(n, remove=[self.dl["review"], self.dl["active"], self.tz["labels"]["active"],
                                   self.tz["labels"]["review"]], add=[self.dl["done"]])
        self.comment(n, self.gh_text[f"{kind}_done"].format(pr_url=pr["html_url"]))
        if issue["state"] == "open":
            self.gh("PATCH", f"/issues/{n}", json={"state": "closed", "state_reason": "completed"})
        self.notify(n, self.slack_text[f"{kind}_done"].format(number=n, title=issue["title"], pr_url=pr["html_url"],
                                                               pr_number=pr["number"]))
        if self.branch_exists(ref):
            self.gh("DELETE", f"/git/refs/heads/{ref}")
        self.log(f"#{n}: done")
