"""Offline tests of token usage monitoring: parsing (API responses, Claude Code execution files),
cost, the CSV per issue on the metrics branch and the issue comment table.

Run: python -m automation.tests.test_usage
"""
import csv
import io
import json
import tempfile
from pathlib import Path
from types import SimpleNamespace

from automation.refinement import usage
from automation.refinement.usage import USAGE_MARK, UsageLog
from automation.tests.test_refinement import Fake, make_cfg, setup

PRICES = {"claude-sonnet-5-5": {"input": 2.0, "output": 10.0, "cache_write": 2.5, "cache_read": 0.1}}
CSV = "token-usage/issue-7-daily-check-in.csv"


def execution_file(messages, jsonl=False):
    path = Path(tempfile.mkdtemp()) / "execution.json"
    path.write_text("\n".join(json.dumps(m) for m in messages) if jsonl else json.dumps(messages))
    return path


def rows_of(f, path=CSV):
    return list(csv.DictReader(io.StringIO(f.branches["metrics"][path])))


def usage_comments(f):
    return [c for c in f.comments if c.startswith(USAGE_MARK)]


def test_api_usage_is_priced_from_the_config():
    u = usage.from_api({"input_tokens": 1_000_000, "output_tokens": 100_000, "cache_creation_input_tokens": 0,
                        "cache_read_input_tokens": 2_000_000}, "claude-sonnet-5-5", "refinement", "thread", PRICES)
    assert (u.input_tokens, u.output_tokens, u.cache_read_tokens, u.total_tokens) == (1_000_000, 100_000, 2_000_000, 3_100_000)
    assert abs(u.cost_usd - (2.0 + 1.0 + 0.2)) < 1e-9
    assert usage.from_api({}, "unknown-model", "refinement", "thread", PRICES).cost_usd is None


def test_execution_file_gives_one_row_per_model_with_its_cost():
    path = execution_file([
        {"type": "system", "subtype": "init"},
        {"type": "assistant", "message": {"model": "claude-sonnet-5-5"}},
        {"type": "result", "total_cost_usd": 0.91, "usage": {"input_tokens": 10},
         "modelUsage": {
             "claude-sonnet-5-5": {"inputTokens": 1200, "outputTokens": 8000, "cacheReadInputTokens": 400000,
                                   "cacheCreationInputTokens": 30000, "costUSD": 0.87},
             "claude-haiku-5-5": {"inputTokens": 500, "outputTokens": 100, "costUSD": 0.04}}}])
    rows = usage.from_execution_file(path, "development", "implement", PRICES)
    assert [r.model for r in rows] == ["claude-sonnet-5-5", "claude-haiku-5-5"]
    assert rows[0].total_tokens == 1200 + 8000 + 400000 + 30000 and rows[0].cost_usd == 0.87
    assert {r.phase for r in rows} == {"development"} and {r.step for r in rows} == {"implement"}


def test_execution_file_without_per_model_usage_uses_the_totals():
    path = execution_file([{"type": "assistant", "message": {"model": "claude-sonnet-5-5"}},
                           {"type": "result", "total_cost_usd": 0.5,
                            "usage": {"input_tokens": 100, "output_tokens": 50}}], jsonl=True)
    [row] = usage.from_execution_file(path, "test", "test", PRICES)
    assert (row.model, row.total_tokens, row.cost_usd) == ("claude-sonnet-5-5", 150, 0.5)
    assert usage.from_execution_file(execution_file([{"type": "system"}]), "test", "test", PRICES) == []


def test_slug_drops_the_req_prefix():
    assert usage.slug("[REQ] Daily check-in, with streaks!", 3) == "daily-check-in"
    assert usage.slug("", 3) == "issue"


def test_first_record_creates_the_metrics_branch_csv_and_comment():
    cfg = make_cfg()
    f = Fake(cfg)
    f.issue["title"] = "[REQ] Daily check-in"
    log = UsageLog(cfg, f.gh, log=lambda *_: None)
    log.record(7, [usage.Usage("refinement", "kickoff", "claude-sonnet-5-5", 3000, 800, 0, 12000, 0.0148,
                               "2026-11-22 10:00", "https://github.com/x/y/actions/runs/1")])
    trees = [j for p, j in f.git_objects if p == "/git/trees"]
    commits = [j for p, j in f.git_objects if p == "/git/commits"]
    assert trees[0]["tree"][0]["path"] == "README.md" and commits[0]["parents"] == []  # orphan branch
    [row] = rows_of(f)
    assert row["phase"] == "refinement" and row["step"] == "kickoff" and row["total_tokens"] == "15800"
    assert row["cost_usd"] == "0.0148" and row["run_url"].endswith("/runs/1")
    [comment] = usage_comments(f)
    assert "| Date (UTC) | Phase | Step |" in comment and "| refinement | kickoff | `claude-sonnet-5-5` |" in comment
    assert "15,800" in comment and "$0.01" in comment and "blob/metrics/" + CSV in comment


def test_later_records_append_and_edit_the_same_comment():
    cfg = make_cfg()
    f = Fake(cfg)
    f.issue["title"] = "[REQ] Daily check-in"
    log = UsageLog(cfg, f.gh, log=lambda *_: None)
    log.record(7, [usage.Usage("refinement", "kickoff", "claude-sonnet-5-5", 100, 100, cost_usd=0.01)])
    f.issue["title"] = "Renamed title"  # keeps its file
    log.record(7, [usage.Usage("development", "implement", "claude-sonnet-5-5", 1000, 2000, cost_usd=0.5),
                   usage.Usage("development", "implement", "claude-haiku-5-5", 10, 10, cost_usd=0.001)])
    assert [r["phase"] for r in rows_of(f)] == ["refinement", "development", "development"]
    assert list(f.branches["metrics"]) == [CSV]
    [comment] = usage_comments(f)
    assert comment.count("| development | implement |") == 2
    assert "Total: 3,220 tokens · $0.51" in comment and "refinement 200 ($0.01)" in comment
    assert "development 3,020 ($0.50)" in comment


def test_recording_never_breaks_the_phase():
    cfg = make_cfg()
    warnings = []
    def broken(*_a, **_k):
        raise RuntimeError("500 GitHub is down")
    UsageLog(cfg, broken, log=warnings.append).record(7, [usage.Usage("test", "test", "m", 1, 1)])
    assert warnings and "Token usage not recorded for #7" in warnings[0]


def test_refinement_steps_record_their_api_usage():
    cfg, f, eng = setup()

    class ClaudeWithUsage:
        def __init__(self):
            self.last_usage = []

        def __call__(self, system, task, tool):
            self.last_usage = [  # a first call without the tool, then the retry
                ("claude-sonnet-5-5", SimpleNamespace(input_tokens=5000, output_tokens=0,
                                                      cache_creation_input_tokens=20000, cache_read_input_tokens=0)),
                ("claude-sonnet-5-5", SimpleNamespace(input_tokens=200, output_tokens=900,
                                                      cache_creation_input_tokens=0, cache_read_input_tokens=20000))]
            return f.claude(system, task, tool)

    eng.claude = ClaudeWithUsage()
    eng.kickoff(7)
    kickoff = [r for r in rows_of(f, next(iter(f.branches["metrics"]))) if r["step"] == "kickoff"]
    assert len(kickoff) == 1 and kickoff[0]["phase"] == "refinement"  # both calls in one row
    assert kickoff[0]["total_tokens"] == str(5000 + 20000 + 200 + 900 + 20000)
    assert usage_comments(f) and eng.claude.last_usage == []


if __name__ == "__main__":
    tests = [(k, v) for k, v in dict(globals()).items() if k.startswith("test_") and callable(v)]
    for name, fn in tests:
        fn()
        print("ok ", name)
    print(f"\nAll {len(tests)} tests passed.")
