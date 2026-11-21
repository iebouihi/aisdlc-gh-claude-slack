"""Design: start the designer agent on a refined issue, report its design PR, or skip the step.

Triggered by labels on issues labelled ready-for-design (config: github.labels.ready_design):
  design       -> under-design; the designer agent (.claude/agents/designer.md, Claude Code GitHub
                  Action, design-feature skill) writes the technical spec, the HTML mockup and the
                  technical decisions summary in design/, and opens a PR (design-review)
  skip-design  -> straight to ready-for-dev
Merging the design PR makes the issue ready-for-dev (Delivery.design_merged).

Review remarks from Slack (run by the sync job): while the design PR is open (design-review),
replies in the issue's Slack thread that mention Claude are posted on the issue, the issue goes
back to under-design, and the designer runs again on the same branch (workflow_dispatch, mode
revise). When it is done, the thread hears what changed and the issue is in design-review again.
"""
import re
from datetime import datetime

from .delivery import Delivery

REMARKS_MARK = "<!-- design-remarks: {ts} -->"  # last Slack remark handed to the designer
REMARKS_RE = re.compile(r"<!-- design-remarks: ([\d.]+) -->")
MENTION_RE = re.compile(r"<@(\w+)(?:\|[^>]*)?>")


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

    # ---------- review remarks from Slack (sync job) ----------

    def design_pr(self, n):
        owner = self.cfg["github"]["repo"].split("/")[0]
        prs = self.gh("GET", f"/pulls?head={owner}:{self.design_branch(n)}&state=open") or []
        return prs[0] if prs else None

    def remarks(self):
        """Hand new Slack remarks on open designs to the designer agent."""
        bot = self.slack("auth.test")["user_id"]
        issues = self.gh("GET", f"/issues?labels={self.zl['review']}&state=open&per_page=100")
        self.log(f"{len(issues)} design(s) in review")
        for issue in issues:
            try:
                self.issue_remarks(issue, bot)
            except Exception as e:  # one broken issue must not stop the others
                self.log(f"::error title=Design remarks failed for #{issue['number']}::{type(e).__name__}: {e}"
                         .replace("\n", " "))

    def issue_remarks(self, issue, bot):
        n, rm = issue["number"], self.dz["remarks"]
        comments = self.gh("GET", f"/issues/{n}/comments?per_page=100")
        thread, pr = self.thread_of(comments), self.design_pr(n)
        if not thread or not pr:
            self.log(f"#{n}: no thread or open design PR")
            return
        channel, root, _ = thread
        # remarks count from the design PR on, and only once
        since = max([datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00")).timestamp()]
                    + [float(ts) for c in comments for ts in REMARKS_RE.findall(c["body"])])
        trigger = re.compile(rm["trigger"])
        msgs = self.slack("conversations.replies", channel=channel, ts=root, limit=200)["messages"]
        new = sorted((m for m in msgs if float(m["ts"]) > since and m.get("user") != bot and "bot_id" not in m
                      and (f"<@{bot}" in m.get("text", "") or trigger.search(m.get("text", "")))),
                     key=lambda m: float(m["ts"]))
        if not new:
            return
        g, s = self.gh_text, self.slack_text
        for m in new:  # signatures some Slack clients append
            for pattern in self.ignore_text:
                m["text"] = pattern.sub("", m.get("text", "")).strip()
        clean = [MENTION_RE.sub(lambda u: "" if u.group(1) == bot else f"@{self.user_name(u.group(1))}",
                                m.get("text", "")).strip() for m in new]
        lines = [g["design_remark"].format(name=self.user_name(m.get("user", "?")),
                                           text=text.replace("\n", "\n> ")) for m, text in zip(new, clean)]
        names = ", ".join(dict.fromkeys(self.user_name(m.get("user", "?")) for m in new))
        f = {"number": n, "title": issue["title"], "pr_url": pr["html_url"], "pr_number": pr["number"],
             "count": len(new), "names": names, "link": self.permalink(channel, new[-1]["ts"]),
             "remarks": "\n\n".join(lines)}
        self.comment(n, REMARKS_MARK.format(ts=new[-1]["ts"]) + "\n" + g["design_remarks"].format(**f))
        self.swap_label(n, remove=[self.zl["review"]], add=[self.zl["active"]])
        try:
            self.gh("POST", f"/actions/workflows/{rm['workflow']}/dispatches",
                    json={"ref": self.cfg["github"]["base_branch"], "inputs": {"issue": str(n), "mode": "revise"}})
        except Exception:  # the remarks stay recorded; put the issue back in review
            self.swap_label(n, remove=[self.zl["active"]], add=[self.zl["review"]])
            raise
        self.post(s["design_remarks_received"].format(**f), thread_ts=root)
        self.log(f"#{n}: {len(new)} remark(s) sent to the designer")

    def revise_start(self, n, run_url):
        """The revise run started by remarks: prepare the designer on the existing design branch."""
        issue, branch = self.gh("GET", f"/issues/{n}"), self.design_branch(n)
        if issue["state"] != "open" or self.zl["active"] not in self.labels_of(issue) or not self.branch_exists(branch):
            self.log(f"#{n}: nothing to revise")
            return {"go": "false"}
        before = self.gh("GET", f"/git/ref/heads/{branch}")["object"]["sha"]
        prompt = self.dz["remarks"]["prompt"].format(number=n, branch=branch)
        return {"go": "true", "mode": "revise", "branch": branch, "before": before, "prompt": " ".join(prompt.split()),
                **self.agent_args(self.dz)}

    def revise_finish(self, n, run_url, before):
        issue, branch = self.gh("GET", f"/issues/{n}"), self.design_branch(n)
        pr = self.design_pr(n)
        after = (self.gh("GET", f"/git/ref/heads/{branch}", missing_ok=True) or {}).get("object", {}).get("sha")
        self.swap_label(n, remove=[self.zl["active"]], add=[self.zl["review"]])
        f = {"number": n, "title": issue["title"], "run_url": run_url, "pr_url": pr["html_url"] if pr else "",
             "pr_number": pr["number"] if pr else "", "mockup": self.mockup(n, branch) if after else ""}
        kind = "design_updated" if after and after != before else "design_unchanged"
        self.comment(n, self.gh_text[kind].format(**f))
        self.notify(n, self.slack_text[kind].format(**f))
        self.log(f"#{n}: revise done, {kind}")

    # ---------- @claude on a pull request: which agent answers ----------

    def agent_for_branch(self, branch):
        """The designer answers on design branches, the developer everywhere else."""
        conf = self.dz if (branch or "").startswith(self.dz["branch_prefix"]) else self.dv
        return self.agent_args(conf)
