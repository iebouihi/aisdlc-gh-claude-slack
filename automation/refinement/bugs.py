"""Bug fixes: investigate (bug-investigator agent), a person validates, fix (developer agent).

Triggered by labels on issues of the configured GitHub issue type (config: bugs.type):
  need-fix      -> Slack "being analyzed", the investigator writes a root-cause report,
                   posted on the issue; state label from the report's verdict
  fix-approved  -> the developer agent fixes it on fix/issue-<n> and opens a PR (in-review)
Merging the fix PR closes the issue (Delivery.pr_merged). Slack gets status only.
"""
from pathlib import Path

from .catalog import read_markdown
from .delivery import Delivery
from .engine import THREAD_MARK

ROOT_CAUSE_MARK = "<!-- root-cause -->"


class BugFix(Delivery):
    def __init__(self, cfg, github, slack, **kw):
        super().__init__(cfg, github, slack, **kw)
        self.bg = cfg["bugs"]
        self.bl = self.bg["labels"]

    def merge_kinds(self):
        return {**super().merge_kinds(), self.bg["branch_prefix"]: "fix"}

    def fix_branch(self, n):
        return f"{self.bg['branch_prefix']}{n}"

    def is_bug(self, issue):
        return ((issue.get("type") or {}).get("name") or "") == self.bg["type"]

    def fields(self, issue, run_url, **extra):
        return {"number": issue["number"], "title": issue["title"], "url": issue["html_url"],
                "run_url": run_url, "type": self.bg["type"], "trigger": self.bl["trigger"],
                "approved": self.bl["approved"], "proposed": self.bl["proposed"],
                "needs_refinement": self.labels["needs"], **extra}

    def state_labels(self, issue):
        """Bug-flow labels currently on the issue (everything a new run replaces)."""
        ours = {self.bl[k] for k in ("trigger", "analyzing", "proposed", "approved", "needs_info",
                                     "spec_gap", "not_a_bug")}
        return [name for name in self.labels_of(issue) if name in ours]

    # ---------- start: decide what this label event means ----------

    def bug_start(self, n, label, run_url):
        issue = self.gh("GET", f"/issues/{n}")
        if issue["state"] != "open" or label not in self.labels_of(issue):
            return {"go": "false", "mode": "none"}
        if label == self.bl["trigger"]:
            return self.start_investigation(issue, run_url)
        if label == self.bl["approved"]:
            return self.start_fix(issue, run_url)
        return {"go": "false", "mode": "none"}

    def start_investigation(self, issue, run_url):
        n, g, s = issue["number"], self.gh_text, self.slack_text
        f = self.fields(issue, run_url)
        if not self.is_bug(issue):
            self.swap_label(n, remove=[self.bl["trigger"]])
            self.comment(n, g["bug_not_bug_type"].format(**f))
            self.log(f"#{n}: not a {self.bg['type']} issue, skipped")
            return {"go": "false", "mode": "none"}
        self.swap_label(n, remove=self.state_labels(issue), add=[self.bl["analyzing"]])
        root = self.thread_root(n)
        text = g["bug_analyzing"].format(**f)
        if root:
            self.post(s["bug_analyzing_again"].format(**f), thread_ts=root)
        else:  # first analysis: one Slack thread per bug, for every later status
            root = self.post(s["bug_analyzing"].format(**f))[0]
            text += "\n\n" + THREAD_MARK.format(channel=self.channel, ts=root)
        self.comment(n, text)
        inv = self.bg["investigator"]
        self.log(f"#{n}: investigation starting")
        return {"go": "true", "mode": "investigate",
                "prompt": inv["prompt"].format(number=n, report=self.bg["report_file"]), **self.agent_args(inv)}

    def start_fix(self, issue, run_url):
        n, g = issue["number"], self.gh_text
        f = self.fields(issue, run_url, branch=self.fix_branch(issue["number"]))
        if not self.is_bug(issue) or self.bl["proposed"] not in self.labels_of(issue):
            self.swap_label(n, remove=[self.bl["approved"]])
            self.comment(n, g["fix_not_validated"].format(**f))
            self.log(f"#{n}: fix not validated, skipped")
            return {"go": "false", "mode": "none"}
        self.swap_label(n, remove=[self.bl["approved"], self.bl["proposed"]], add=[self.dl["active"]])
        self.comment(n, g["fix_started"].format(**f))
        self.notify(n, self.slack_text["fix_started"].format(**f))
        self.log(f"#{n}: fix starting on {f['branch']}")
        return {"go": "true", "mode": "fix", "branch": f["branch"],
                "prompt": self.bg["fixer"]["prompt"].format(number=n, branch=f["branch"]), **self.agent_args()}

    # ---------- finish ----------

    def bug_finish(self, n, mode, run_url):
        if mode == "investigate":
            return self.post_report(n, run_url)
        if mode == "fix":
            return self.finish(n, run_url, kind="fix", branch=self.fix_branch(n), fallback=self.bl["proposed"])

    def post_report(self, n, run_url):
        """Post the investigator's report on the issue; the verdict sets the state label."""
        issue = self.gh("GET", f"/issues/{n}")
        g, s = self.gh_text, self.slack_text
        path = Path(self.root) / self.bg["report_file"]
        report = path.read_text(encoding="utf-8").strip() if path.exists() else ""
        if not report:
            f = self.fields(issue, run_url)
            self.swap_label(n, remove=[self.bl["analyzing"]])
            self.comment(n, g["bug_no_report"].format(**f))
            self.notify(n, s["bug_no_report"].format(**f))
            self.log(f"#{n}: no report")
            return
        meta, body = read_markdown(path)
        verdict = str(meta.get("verdict") or "").strip().lower()
        state = self.bg["verdicts"].get(verdict, "proposed")
        f = self.fields(issue, run_url, verdict=verdict or "?", confidence=meta.get("confidence") or "?",
                        summary=str(meta.get("summary") or "").strip())
        limit = self.bg["max_report_chars"]
        text = "\n\n".join([ROOT_CAUSE_MARK + "\n" + g["bug_report_header"].format(**f),
                            body[:limit].strip(), g[f"bug_next_{state}"].format(**f)])
        posted = self.gh("POST", f"/issues/{n}/comments", json={"body": text}) or {}
        f["link"] = posted.get("html_url") or issue["html_url"]
        self.swap_label(n, remove=[self.bl["analyzing"]], add=[self.bl[state]])
        self.notify(n, s[f"bug_verdict_{state}"].format(**f))
        self.log(f"#{n}: report posted, verdict {verdict or '?'} -> {self.bl[state]}")
