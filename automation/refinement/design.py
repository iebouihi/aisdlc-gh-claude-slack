"""Design: start the designer agent on a refined issue, report its design PR, or skip the step.

Triggered by labels on issues labelled ready-for-design (config: github.labels.ready_design):
  design       -> under-design; the designer agent (.claude/agents/designer.md, Claude Code GitHub
                  Action, design-feature skill) writes the technical spec, the HTML mockup and the
                  technical decisions summary in design/, and opens a PR (design-review)
  skip-design  -> straight to ready-for-dev
Merging the design PR makes the issue ready-for-dev (Delivery.design_merged).
"""
from .delivery import Delivery


class Design(Delivery):
    def __init__(self, cfg, github, slack, **kw):
        super().__init__(cfg, github, slack, **kw)
        self.zl = self.dz["labels"]

    def design_branch(self, n):
        return f"{self.dz['branch_prefix']}{n}"

    # ---------- start: decide what this label event means ----------

    def design_start(self, n, label, run_url):
        issue = self.gh("GET", f"/issues/{n}")
        if issue["state"] != "open" or label not in self.labels_of(issue):
            return {"go": "false"}
        if label == self.zl["trigger"]:
            return self.start_design(issue, run_url)
        if label == self.zl["skip"]:
            self.skip(issue)
        return {"go": "false"}

    def start_design(self, issue, run_url):
        n, g, s = issue["number"], self.gh_text, self.slack_text
        ready = self.labels["ready_design"]
        if ready not in self.labels_of(issue):
            self.swap_label(n, remove=[self.zl["trigger"]])
            self.comment(n, g["design_not_ready"].format(ready=ready, trigger=self.zl["trigger"]))
            self.log(f"#{n}: not ready, designer not started")
            return {"go": "false"}
        branch = self.design_branch(n)
        f = {"number": n, "title": issue["title"], "branch": branch, "run_url": run_url}
        self.swap_label(n, remove=[self.zl["trigger"], ready], add=[self.zl["active"]])
        self.comment(n, g["design_started"].format(**f))
        self.notify(n, s["design_started"].format(**f))
        self.log(f"#{n}: designer agent starting on {branch}")
        return {"go": "true", "branch": branch,
                "prompt": self.dz["prompt"].format(number=n, branch=branch), **self.agent_args(self.dz)}

    def skip(self, issue):
        n, g, s = issue["number"], self.gh_text, self.slack_text
        ready = self.labels["ready_design"]
        if ready not in self.labels_of(issue):
            self.swap_label(n, remove=[self.zl["skip"]])
            self.comment(n, g["skip_not_ready"].format(ready=ready, skip=self.zl["skip"]))
            self.log(f"#{n}: not ready for design, skip ignored")
            return
        f = {"number": n, "title": issue["title"], "trigger": self.dl["trigger"]}
        self.swap_label(n, remove=[self.zl["skip"], ready], add=[self.labels["ready"]])
        self.comment(n, g["design_skipped"].format(**f))
        self.notify(n, s["design_skipped"].format(**f))
        self.log(f"#{n}: design skipped, ready for dev")

    # ---------- finish ----------

    def design_finish(self, n, run_url):
        branch = self.design_branch(n)
        self.finish(n, run_url, kind="design", branch=branch, fallback=self.labels["ready_design"],
                    active=self.zl["active"], review=self.zl["review"],
                    extra={"mockup": self.mockup(n, branch) if self.branch_exists(branch) else ""})

    # ---------- @claude on a pull request: which agent answers ----------

    def agent_for_branch(self, branch):
        """The designer answers on design branches, the developer everywhere else."""
        conf = self.dz if (branch or "").startswith(self.dz["branch_prefix"]) else self.dv
        return self.agent_args(conf)
