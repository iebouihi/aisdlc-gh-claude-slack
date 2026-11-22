"""Token usage: every Claude call, per issue and per phase.

Each call is recorded in two places:
  - a table in one comment on the issue (edited in place, totals per phase), and
  - a CSV file per issue, `token-usage/issue-<n>-<title-slug>.csv`, on a dedicated branch
    (config usage.branch, `metrics`) so main never gets bot commits.
Sources:
  - refinement steps (select, kickoff, thread): the `usage` of each Messages API response,
    priced with config usage.prices (an estimate at list price);
  - agent runs (designer, developer, tester, investigator, @claude): the result message of
    Claude Code's execution file (claude-code-action output `execution_file`), with its own cost.
Recording never stops the workflow: errors are logged as warnings.
"""
import base64
import csv
import io
import json
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

USAGE_MARK = "<!-- token-usage -->"


@dataclass
class Usage:
    phase: str
    step: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_write_tokens: int = 0
    cache_read_tokens: int = 0
    cost_usd: float | None = None
    date: str = ""
    run_url: str = ""

    @property
    def total_tokens(self):
        return self.input_tokens + self.output_tokens + self.cache_write_tokens + self.cache_read_tokens

    def row(self):
        d = asdict(self)
        d["total_tokens"] = self.total_tokens
        d["cost_usd"] = "" if self.cost_usd is None else f"{self.cost_usd:.4f}"
        return d


COLUMNS = ["date", "phase", "step", "model", "input_tokens", "output_tokens", "cache_write_tokens",
           "cache_read_tokens", "total_tokens", "cost_usd", "run_url"]


def run_url():
    """The current GitHub Actions run, or "" outside Actions."""
    server, repo, run = (os.environ.get(k) for k in ("GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"))
    return f"{server}/{repo}/actions/runs/{run}" if server and repo and run else ""


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")


def price(model, u, prices):
    """Estimated cost in USD from list prices per million tokens (None when the model is unknown)."""
    p = prices.get(model) or prices.get("default")
    if not p:
        return None
    return (u.input_tokens * p["input"] + u.output_tokens * p["output"]
            + u.cache_write_tokens * p["cache_write"] + u.cache_read_tokens * p["cache_read"]) / 1_000_000


def from_api(usage, model, phase, step, prices):
    """A Messages API response's `usage` (object or dict)."""
    get = (lambda k: usage.get(k)) if isinstance(usage, dict) else (lambda k: getattr(usage, k, None))
    u = Usage(phase, step, model, int(get("input_tokens") or 0), int(get("output_tokens") or 0),
              int(get("cache_creation_input_tokens") or 0), int(get("cache_read_input_tokens") or 0),
              date=now(), run_url=run_url())
    u.cost_usd = price(model, u, prices)
    return u


def add(a, b):
    """Two calls of one step (e.g. a retry) as one row."""
    a.input_tokens += b.input_tokens
    a.output_tokens += b.output_tokens
    a.cache_write_tokens += b.cache_write_tokens
    a.cache_read_tokens += b.cache_read_tokens
    a.cost_usd = None if a.cost_usd is None or b.cost_usd is None else a.cost_usd + b.cost_usd
    return a


def from_execution_file(path, phase, step, prices):
    """Claude Code's execution file (JSON array or JSON lines of messages) -> one Usage per model."""
    text = Path(path).read_text(encoding="utf-8").strip()
    try:
        messages = json.loads(text)
        messages = messages if isinstance(messages, list) else [messages]
    except json.JSONDecodeError:
        messages = [json.loads(line) for line in text.splitlines() if line.strip().startswith("{")]
    results = [m for m in messages if isinstance(m, dict) and m.get("type") == "result"]
    if not results:
        return []
    result, stamp, url = results[-1], now(), run_url()
    per_model = result.get("modelUsage") or result.get("model_usage") or {}
    if per_model:
        rows = []
        for model, m in per_model.items():
            u = Usage(phase, step, model, int(m.get("inputTokens") or 0), int(m.get("outputTokens") or 0),
                      int(m.get("cacheCreationInputTokens") or 0), int(m.get("cacheReadInputTokens") or 0),
                      date=stamp, run_url=url)
            cost = m.get("costUSD")
            u.cost_usd = float(cost) if cost is not None else price(model, u, prices)
            rows.append(u)
        return rows
    usage = result.get("usage") or {}
    model = next((m.get("message", {}).get("model") for m in messages
                  if isinstance(m, dict) and m.get("type") == "assistant"), None) or "claude-code"
    u = from_api(usage, model, phase, step, prices)
    if result.get("total_cost_usd") is not None:
        u.cost_usd = float(result["total_cost_usd"])
    return [u]


def slug(title, max_words):
    words = re.sub(r"^\s*\[[^\]]*\]\s*", "", title or "").lower()
    words = re.findall(r"[a-z0-9]+", words)[:max_words]
    return "-".join(words) or "issue"


def read_csv(text):
    return list(csv.DictReader(io.StringIO(text))) if text.strip() else []


def write_csv(rows):
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=COLUMNS, extrasaction="ignore", lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    return out.getvalue()


def fmt_int(value):
    try:
        return f"{int(value):,}"
    except (TypeError, ValueError):
        return "?"


def fmt_cost(value):
    try:
        return f"${float(value):.2f}"
    except (TypeError, ValueError):
        return "n/a"


class UsageLog:
    """Writes usage rows to the issue's CSV (metrics branch) and its token usage comment."""

    def __init__(self, cfg, gh, log=print):
        self.cfg, self.gh, self.log = cfg, gh, log
        self.u = cfg["usage"]
        self.text = cfg["messages"]["github"]

    def record(self, number, usages):
        if not self.u.get("enabled", True) or not usages:
            return
        try:
            issue = self.gh("GET", f"/issues/{number}")
            path, rows = self.append_csv(issue, [u.row() for u in usages])
            self.update_comment(issue, path, rows)
            total = sum(u.total_tokens for u in usages)
            self.log(f"#{number}: {total} tokens recorded ({usages[0].phase}/{usages[0].step})")
        except Exception as e:  # monitoring must never break a phase
            self.log(f"::warning title=Token usage not recorded for #{number}::{type(e).__name__}: {e}"
                     .replace("\n", " "))

    # ---------- CSV on the metrics branch ----------

    def ensure_branch(self):
        branch = self.u["branch"]
        if self.gh("GET", f"/git/ref/heads/{branch}", missing_ok=True):
            return
        # an orphan branch with only a README: no copy of the code next to the metrics
        readme = self.u["readme"].format(dir=self.u["dir"], branch=branch)
        tree = self.gh("POST", "/git/trees", json={"tree": [
            {"path": "README.md", "mode": "100644", "type": "blob", "content": readme}]})
        commit = self.gh("POST", "/git/commits", json={"message": self.u["commit_init"], "tree": tree["sha"],
                                                       "parents": []})
        self.gh("POST", "/git/refs", json={"ref": f"refs/heads/{branch}", "sha": commit["sha"]})

    def csv_path(self, issue):
        """The issue's existing CSV (found by number, so a renamed issue keeps its file) or a new name."""
        d, n = self.u["dir"], issue["number"]
        listing = self.gh("GET", f"/contents/{d}?ref={self.u['branch']}", missing_ok=True) or []
        for entry in listing if isinstance(listing, list) else []:
            if entry.get("name", "").startswith(f"issue-{n}-") and entry["name"].endswith(".csv"):
                return entry["path"]
        return f"{d}/" + self.u["file"].format(number=n, slug=slug(issue["title"], self.u["slug_max_words"]))

    def append_csv(self, issue, new_rows):
        self.ensure_branch()
        branch, path = self.u["branch"], self.csv_path(issue)
        for attempt in range(2):  # two runs may write the same file: re-read and retry once
            current = self.gh("GET", f"/contents/{path}?ref={branch}", missing_ok=True)
            old = base64.b64decode(current["content"]).decode() if current and current.get("content") else ""
            rows = read_csv(old) + new_rows
            body = {"message": self.u["commit"].format(number=issue["number"], step=new_rows[0]["step"],
                                                       phase=new_rows[0]["phase"]),
                    "branch": branch, "content": base64.b64encode(write_csv(rows).encode()).decode()}
            if current:
                body["sha"] = current["sha"]
            try:
                self.gh("PUT", f"/contents/{path}", json=body)
                return path, rows
            except RuntimeError as e:
                if attempt or not re.search(r"\b(409|422)\b", str(e)):
                    raise
        return path, rows

    # ---------- the issue comment ----------

    def update_comment(self, issue, path, rows):
        n, g = issue["number"], self.text
        repo, branch = self.cfg["github"]["repo"], self.u["branch"]
        csv_url = f"https://github.com/{repo}/blob/{branch}/{path}"
        lines = [USAGE_MARK, g["usage_header"].format(file=path.rsplit("/", 1)[-1], csv_url=csv_url), "",
                 "| " + " | ".join(self.u["table_headers"]) + " |", "|" + "---|" * len(self.u["table_headers"])]
        for r in rows:
            run = f"[run]({r['run_url']})" if r.get("run_url") else ""
            lines.append("| " + " | ".join([
                r.get("date", ""), r.get("phase", ""), r.get("step", ""), f"`{r.get('model', '')}`",
                fmt_int(r.get("input_tokens")), fmt_int(r.get("output_tokens")),
                fmt_int(r.get("cache_write_tokens")), fmt_int(r.get("cache_read_tokens")),
                fmt_int(r.get("total_tokens")), fmt_cost(r.get("cost_usd")), run]) + " |")
        phases = {}
        for r in rows:
            t = phases.setdefault(r.get("phase", ""), [0, 0.0, True])
            t[0] += int(r.get("total_tokens") or 0)
            if r.get("cost_usd") not in (None, ""):
                t[1] += float(r["cost_usd"])
            else:
                t[2] = False
        per_phase = " · ".join(f"{p} {fmt_int(t[0])} ({fmt_cost(t[1]) if t[2] else 'n/a'})"
                               for p, t in phases.items())
        tokens = sum(t[0] for t in phases.values())
        cost = sum(t[1] for t in phases.values())
        lines += ["", g["usage_total"].format(tokens=fmt_int(tokens), cost=fmt_cost(cost), phases=per_phase),
                  "", g["usage_note"]]
        body = "\n".join(lines)
        comments = self.gh("GET", f"/issues/{n}/comments?per_page=100") or []
        mine = next((c for c in comments if c.get("body", "").startswith(USAGE_MARK)), None)
        if mine:
            self.gh("PATCH", f"/issues/comments/{mine['id']}", json={"body": body})
        else:
            self.gh("POST", f"/issues/{n}/comments", json={"body": body})
