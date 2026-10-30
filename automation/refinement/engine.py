"""The refinement workflow: kick-off, follow each thread, approval, living spec PR, merge.

Instructions come from the agent/skills, texts and settings from config/refinement.yml.
Hidden HTML markers on the issue keep the state between runs.
"""
import base64
import re
import time

from . import specs as spec_store
from .config import ROOT
from .questions import group_in_order, parse_questions

THREAD_MARK = "<!-- slack-thread: {channel}/{ts} -->"
THREAD_RE = re.compile(r"<!-- slack-thread: (\w+)/([\d.]+) -->")
CONTEXT_MARK = "<!-- context: {paths} -->"  # living specs chosen at kick-off
CONTEXT_RE = re.compile(r"<!-- context: ([^>]*?) -->")
PROPOSAL_MARK = "<!-- proposal: {first} {last} -->"  # first and last Slack message of the proposal
PROPOSAL_RE = re.compile(
    r"<!-- proposal: ([\d.]+)(?: ([\d.]+))? -->\s*.*?<!-- body-start -->\n(.*?)\n<!-- body-end -->", re.S)
SPECS_BLOCK = "<!-- specs-start -->\n{blocks}\n<!-- specs-end -->"
SPECS_RE = re.compile(r"<!-- specs-start -->\n(.*?)\n<!-- specs-end -->", re.S)
DAY = 86400


def normalize(text):
    """Lower-case text without :emoji: codes, emoji, markup or punctuation - for comparisons."""
    text = re.sub(r":[a-z0-9_+-]+:", " ", (text or "").lower())
    return " ".join(re.sub(r"[^\w\s]", " ", text).split())


class Refinement:
    def __init__(self, cfg, agent, github, slack, claude, log=print, now=time.time, root=ROOT):
        self.cfg, self.agent, self.gh, self.slack, self.claude = cfg, agent, github, slack, claude
        self.log, self.now, self.root = log, now, root
        self.labels = cfg["github"]["labels"]
        self.channel = cfg["slack"]["channel_id"]
        self.approver = cfg["slack"]["approver_id"]
        ref = cfg["refinement"]
        self.groups, self.other = ref["question_groups"], ref["other_group"]
        self.nudge_after = ref["nudge_after_days"] * DAY
        self.approve_reactions = set(ref["approval"]["reactions"])
        words = sorted(ref["approval"]["reply_words"], key=len, reverse=True)
        self.approve_reply = re.compile(r"^\s*(?:(?:" + "|".join(map(re.escape, words)) + r")[\s.!,]*)+$", re.I)
        self.strip_lines = [re.compile(p) for p in ref.get("proposal_strip_lines", [])]
        self.slack_text, self.gh_text = cfg["messages"]["slack"], cfg["messages"]["github"]
        self.max_chars = cfg["slack"]["max_message_chars"]
        self.ignore_text = [re.compile(p, re.S) for p in cfg["slack"].get("ignore_text_patterns", [])]
        self.sp = cfg["specs"]
        self._names = {}

    # ---------- shared helpers ----------

    def ask(self, step, number, **data):
        conf = self.cfg["claude"]["steps"][step]
        skill = self.agent.skill(conf["skill"])
        system = self.agent.system_prompt(arguments=number, only=[conf["skill"]] + list(conf.get("uses", [])))
        task = self.cfg["tasks"][step].format(product=self.cfg["product"]["description"].strip(), **data)
        return self.claude(system, task, skill.tool)

    def issue_text(self, issue):
        return f"Issue #{issue['number']}: {issue['title']}\nURL: {issue['html_url']}\n\n{issue.get('body') or ''}"

    def post(self, text, thread_ts=None, broadcast=False):
        """Post text, split at line breaks into messages under Slack's size limit. Returns every ts."""
        parts, current = [], ""
        for line in text.split("\n"):
            while len(line) > self.max_chars:  # a single over-long line: hard split
                parts += [current] if current else []
                current, parts = "", parts + [line[:self.max_chars]]
                line = line[self.max_chars:]
            if current and len(current) + 1 + len(line) > self.max_chars:
                parts.append(current)
                current = line
            else:
                current = f"{current}\n{line}" if current else line
        parts.append(current)
        stamps = []
        for part in parts:
            params = {"channel": self.channel, "text": part, "unfurl_links": "false"}
            if thread_ts:
                params["thread_ts"] = thread_ts
                if broadcast:
                    params["reply_broadcast"] = "true"
            stamps.append(self.slack("chat.postMessage", **params)["ts"])
        return stamps

    def permalink(self, channel, ts):
        return self.slack("chat.getPermalink", channel=channel, message_ts=ts)["permalink"]

    def user_name(self, uid):
        if uid not in self._names:
            try:
                u = self.slack("users.info", user=uid)["user"]
                self._names[uid] = u.get("real_name") or u.get("name") or uid
            except Exception:
                self._names[uid] = uid
        return self._names[uid]

    def comment(self, n, body):
        self.gh("POST", f"/issues/{n}/comments", json={"body": body})

    def swap_label(self, n, remove=(), add=()):
        for name in remove:
            self.gh("DELETE", f"/issues/{n}/labels/{name}")
        if add:
            self.gh("POST", f"/issues/{n}/labels", json={"labels": list(add)})

    @staticmethod
    def labels_of(issue):
        return {lbl["name"] for lbl in issue["labels"]}

    def thread_of(self, comments):
        """(channel, root ts, context spec paths) of the latest refinement thread, or None."""
        for c in reversed(comments):
            m = THREAD_RE.search(c["body"])
            if m:
                ctx = CONTEXT_RE.search(c["body"])
                paths = [p for p in (ctx.group(1).split(",") if ctx else []) if p.strip()]
                return m.group(1), m.group(2), [p.strip() for p in paths]
        return None

    # ---------- living spec context ----------

    def load_specs(self):
        return spec_store.load(self.root, self.sp["dir"])

    def pick(self, issue, level, index, limit, known):
        """Ask the impact-analysis skill to pick ids from an index; keep only known ids."""
        out = self.ask("select", issue["number"], issue=self.issue_text(issue), index=index, limit=limit,
                       level=self.cfg["tasks"][f"level_{level}"])
        chosen = []
        for line in str(out.get("selected") or "").splitlines():
            key = line.split("::")[0].strip().strip("`*- ")
            if key in known and key not in chosen:
                chosen.append(key)
        return chosen[:limit]

    def select_context(self, issue):
        """Two-stage selection keeps each call small however many specs exist."""
        specs, texts = self.load_specs(), self.sp["generated"]
        if not specs:
            return []
        if len(spec_store.spec_index(specs, texts)) > self.sp["index_chars"]:
            grouped = spec_store.modules(specs)
            mods = self.pick(issue, "modules", spec_store.module_index(specs, texts), self.sp["max_specs"], grouped)
            specs = [s for m in mods for s in grouped[m]]
            if not specs:
                return []
        by_id = {s.id: s for s in specs}
        ids = self.pick(issue, "specs", spec_store.spec_index(specs, texts), self.sp["max_specs"], by_id)
        return [by_id[i].path for i in ids]

    def context_text(self, paths):
        """Current content of the chosen specs, within the character budget."""
        by_path = {s.path: s for s in self.load_specs()}
        parts, used = [], 0
        for p in paths:
            if p in by_path:
                block = self.sp["generated"]["context_spec"].format(path=p, content=by_path[p].content.strip())
                if used + len(block) > self.sp["context_chars"]:
                    break
                parts.append(block)
                used += len(block)
        return "\n\n".join(parts) or self.sp["generated"]["context_none"]

    # ---------- kick-off ----------

    def kickoff(self, n):
        issue = self.gh("GET", f"/issues/{n}")
        if self.labels["needs"] not in self.labels_of(issue) or issue["state"] != "open":
            self.log(f"#{n}: not labelled {self.labels['needs']} or closed, skipped")
            return
        related = self.select_context(issue)
        out = self.ask("kickoff", n, issue=self.issue_text(issue), groups=", ".join(self.groups),
                       context=self.context_text(related))
        questions = parse_questions(out.get("questions"), self.groups, self.other)
        if not questions:
            raise RuntimeError(f"no usable questions returned: {str(out.get('questions'))[:300]}")

        # build everything before posting, so a failure never leaves a half-finished thread
        t = self.slack_text
        fields = {"number": n, "title": issue["title"], "url": issue["html_url"]}
        lines, index = [t["questions_header"].format(**fields)], 0
        for group, qs in group_in_order(questions, self.groups, self.other):
            lines += ["", t["question_group"].format(group=group)]
            for q in qs:
                index += 1
                line = t["question"].format(index=index, question=q["question"])
                lines.append(line + (t["question_default"].format(default=q["default"]) if q["default"] else ""))
        lines += ["", t["questions_footer"].format(**fields)]
        restatement = out.get("restatement", "").strip()
        if related:
            restatement += "\n\n" + t["related_specs"].format(specs=", ".join(f"`{p}`" for p in related))

        root = self.post(t["kickoff"].format(restatement=restatement, **fields))[0]
        self.post("\n".join(lines), thread_ts=root)
        self.comment(n, self.gh_text["thread_started"].format(link=self.permalink(self.channel, root))
                     + "\n\n" + THREAD_MARK.format(channel=self.channel, ts=root)
                     + "\n" + CONTEXT_MARK.format(paths=",".join(related)))
        stale = [self.labels[k] for k in ("needs", "ready", "blocked", "spec_review")
                 if self.labels[k] in self.labels_of(issue)]
        self.swap_label(n, remove=stale, add=[self.labels["active"]])
        self.log(f"#{n}: kicked off, thread {root}, context {related}")

    # ---------- follow the threads ----------

    def sync(self):
        bot = self.slack("auth.test")["user_id"]
        issues = self.gh("GET", f"/issues?labels={self.labels['active']}&state=open&per_page=100")
        self.log(f"{len(issues)} issue(s) in refinement")
        for issue in issues:
            try:
                self.sync_issue(issue, bot)
            except Exception as e:  # one broken issue must not stop the others
                self.log(f"::error title=Sync failed for #{issue['number']}::{type(e).__name__}: {e}".replace("\n", " "))

    def sync_issue(self, issue, bot):
        n = issue["number"]
        comments = self.gh("GET", f"/issues/{n}/comments?per_page=100")
        thread = self.thread_of(comments)
        if not thread:
            self.log(f"#{n}: no Slack thread recorded, skipped")
            return
        channel, root, related = thread
        msgs = self.slack("conversations.replies", channel=channel, ts=root, limit=200)["messages"]

        def is_bot(m):
            return m.get("user") == bot or "bot_id" in m

        msgs = sorted(msgs, key=lambda m: float(m["ts"]))
        for m in msgs:
            for pattern in self.ignore_text:
                m["text"] = pattern.sub("", m.get("text", "")).strip()
        last_bot = max((float(m["ts"]) for m in msgs if is_bot(m)), default=0.0)
        new_human = [m for m in msgs if not is_bot(m) and float(m["ts"]) > last_bot]
        proposals = [(first, body, c["body"]) for c in comments for first, _last, body in PROPOSAL_RE.findall(c["body"])
                     if float(first) > float(root)]  # only this thread's proposals
        proposal = proposals[-1] if proposals else None

        if proposal:
            # a long proposal spans several consecutive bot messages; they all belong to it
            parts = []
            for m in (m for m in msgs if float(m["ts"]) >= float(proposal[0])):
                if not is_bot(m):
                    break
                parts.append(m["ts"])
            if parts and float(parts[-1]) >= last_bot:  # the proposal is Claude's latest word
                approved = new_human and all(m.get("user") == self.approver
                                             and self.approve_reply.match(m.get("text", "")) for m in new_human)
                if not new_human:
                    approved = any(self.approved_by_reaction(channel, ts) for ts in parts)
                    if not approved:
                        self.log(f"#{n}: proposal waiting for approval")
                        return
                if approved:
                    blocks = SPECS_RE.search(proposal[2])
                    return self.write_back(issue, channel, root, proposal[1], blocks.group(1) if blocks else "")
                # replies asking for changes -> Claude below

        if not new_human:
            return self.nudge_or_block(issue, msgs, root)

        if self.labels["blocked"] in self.labels_of(issue):
            self.swap_label(n, remove=[self.labels["blocked"]])
        transcript = "\n\n".join(
            f"[{'Claude' if is_bot(m) else self.user_name(m.get('user', '?'))}] {m.get('text', '')}" for m in msgs)
        link = self.permalink(channel, root)
        out = self.ask("thread", n, issue=self.issue_text(issue), thread_link=link, transcript=transcript,
                       context=self.context_text(related), date=time.strftime("%Y-%m-%d"))

        action = out.get("action")
        if action == "follow_up" and out.get("slack_message"):
            self.post(out["slack_message"], thread_ts=root)
            self.log(f"#{n}: follow-up posted")
        elif action == "propose" and out.get("final_requirement"):
            updates = spec_store.parse_updates(out.get("spec_updates"), self.sp["file_pattern"],
                                               self.sp["required_fields"])  # invalid -> error, retried next run
            body = self.clean_proposal(out.get("slack_message") or out["final_requirement"])
            stamps = self.post(self.slack_text["proposal"].format(body=body), thread_ts=root)
            g = self.gh_text
            text = (PROPOSAL_MARK.format(first=stamps[0], last=stamps[-1]) + "\n"
                    + g["proposal_posted"].format(link=self.permalink(channel, stamps[0]))
                    + f"\n\n<details><summary>{g['proposal_details']}</summary>\n\n"
                    + f"<!-- body-start -->\n{out['final_requirement']}\n<!-- body-end -->\n\n</details>")
            if updates:
                text += (f"\n\n<details><summary>{g['proposal_specs']}</summary>\n\n"
                         + SPECS_BLOCK.format(blocks=spec_store.to_blocks(updates)) + "\n\n</details>")
            self.comment(n, text)
            self.log(f"#{n}: proposal posted ({len(updates)} spec file(s))")
        else:
            self.log(f"#{n}: waiting")

    def approved_by_reaction(self, channel, ts):
        reacts = self.slack("reactions.get", channel=channel, timestamp=ts).get("message", {}).get("reactions", [])
        return any(r["name"] in self.approve_reactions and self.approver in r.get("users", []) for r in reacts)

    def clean_proposal(self, text):
        keep = [line for line in text.strip().splitlines()
                if not any(p.search(normalize(line)) for p in self.strip_lines)]
        return "\n".join(keep).strip()

    def nudge_or_block(self, issue, msgs, root):
        n, last = issue["number"], msgs[-1]
        if self.now() - float(last["ts"]) < self.nudge_after or self.labels["blocked"] in self.labels_of(issue):
            return
        if normalize(last.get("text")) == normalize(self.slack_text["nudge"]):
            self.swap_label(n, add=[self.labels["blocked"]])
            self.post(self.slack_text["blocked"].format(number=n), thread_ts=root)
            self.log(f"#{n}: blocked")
        else:
            self.post(self.slack_text["nudge"].format(number=n), thread_ts=root)
            self.log(f"#{n}: nudged")

    # ---------- approval -> issue + living spec ----------

    def write_back(self, issue, channel, root, final, spec_blocks):
        n, original = issue["number"], issue.get("body") or ""
        approver = self.user_name(self.approver)
        g, labels = self.gh_text, self.labels
        final = final.replace(g["approved_pending"],
                              g["approved_by"].format(approver=approver, date=time.strftime("%Y-%m-%d")))
        summary = f"<summary>{g['original_request']}</summary>"
        kept = re.search(r"<details>" + re.escape(summary) + r".*?</details>", original, re.S)
        # re-refined issue: keep the very first request; otherwise the current body is the original
        block = kept.group(0) if kept else f"<details>{summary}\n\n{original}\n\n</details>"
        self.gh("PATCH", f"/issues/{n}", json={"body": final + f"\n\n---\n{block}"})
        thread_link = self.permalink(channel, root)
        self.comment(n, g["approved"].format(approver=approver, link=thread_link))

        updates = spec_store.parse_updates(spec_blocks, self.sp["file_pattern"], self.sp["required_fields"])
        if not updates:  # nothing lasting to record: ready right away
            self.swap_label(n, remove=[labels["active"], labels["blocked"]], add=[labels["ready"]])
            self.post(self.slack_text["done"].format(number=n, url=issue["html_url"]), thread_ts=root)
            self.log(f"#{n}: approved, no spec change, ready")
            return
        self.publish_spec(issue, root, updates, approver, thread_link)

    def publish_spec(self, issue, root, updates, approver, thread_link):
        """Commit the spec changes + regenerated indexes on a branch and open a PR for review."""
        n, g, base = issue["number"], self.gh_text, self.cfg["github"]["base_branch"]
        branch = f"{self.sp['branch_prefix']}{n}"
        merged = spec_store.merge(self.load_specs(), updates)
        files = {u.path: u.content for u in updates}
        files.update(spec_store.generated_files(merged, self.sp["generated"], self.cfg["product"]["name"],
                                                self.sp["dir"]))
        message = g["spec_commit"].format(number=n, title=issue["title"])

        head = self.gh("GET", f"/git/ref/heads/{base}")["object"]["sha"]
        self.gh("DELETE", f"/git/refs/heads/{branch}")  # re-approval replaces an older spec branch
        self.gh("POST", "/git/refs", json={"ref": f"refs/heads/{branch}", "sha": head})
        for path, content in files.items():
            current = self.gh("GET", f"/contents/{path}?ref={branch}", missing_ok=True)
            body = {"message": message, "branch": branch,
                    "content": base64.b64encode(content.encode()).decode()}
            if current:
                body["sha"] = current["sha"]
            self.gh("PUT", f"/contents/{path}", json=body)

        names = ", ".join(f"`{u.path}`" for u in updates)
        fields = {"number": n, "title": issue["title"], "approver": approver, "files": names,
                  "ready": self.labels["ready"]}
        try:
            pr = self.gh("POST", "/pulls", json={
                "title": g["spec_pr_title"].format(**fields), "head": branch, "base": base,
                "body": g["spec_pr_body"].format(thread_link=thread_link,
                                                 **{**fields, "files": "\n".join(f"- `{p}`" for p in files)})})
            self.comment(n, g["spec_pr_opened"].format(pr_url=pr["html_url"], **fields))
            slack_msg = self.slack_text["spec_pr"].format(pr_url=pr["html_url"], pr_number=pr["number"], **fields)
        except Exception as e:  # e.g. Actions not allowed to open pull requests: hand over the branch
            self.log(f"::warning::spec PR not opened: {e}; pushed {branch}")
            compare = issue["html_url"].split("/issues/")[0] + f"/compare/{base}...{branch}?expand=1"
            self.comment(n, g["spec_branch_pushed"].format(branch=branch, compare_url=compare, **fields))
            slack_msg = self.slack_text["spec_branch"].format(branch=branch, compare_url=compare, **fields)
        self.swap_label(n, remove=[self.labels["active"], self.labels["blocked"]], add=[self.labels["spec_review"]])
        self.post(slack_msg, thread_ts=root, broadcast=self.cfg["slack"].get("broadcast_spec_pr", False))
        self.log(f"#{n}: approved, spec review on {branch}")

    def spec_merged(self, pr_number):
        """A merged spec PR makes its issue ready for development."""
        pr = self.gh("GET", f"/pulls/{pr_number}")
        ref = pr["head"]["ref"]
        if not pr.get("merged") or not ref.startswith(self.sp["branch_prefix"]):
            self.log(f"PR #{pr_number}: not a merged spec PR, skipped")
            return
        n = int(ref[len(self.sp["branch_prefix"]):])
        issue = self.gh("GET", f"/issues/{n}")
        if self.labels["spec_review"] not in self.labels_of(issue):
            self.log(f"#{n}: no spec review pending, skipped")
            return
        self.swap_label(n, remove=[self.labels["spec_review"]], add=[self.labels["ready"]])
        self.comment(n, self.gh_text["spec_merged"].format(pr_url=pr["html_url"]))
        thread = self.thread_of(self.gh("GET", f"/issues/{n}/comments?per_page=100"))
        if thread:
            self.post(self.slack_text["done"].format(number=n, url=issue["html_url"]), thread_ts=thread[1])
        self.gh("DELETE", f"/git/refs/heads/{ref}")
        self.log(f"#{n}: spec merged, ready for dev")
