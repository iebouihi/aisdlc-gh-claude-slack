---
name: investigate-bug
description: Investigate a bug issue end to end without fixing it - read the report and specs, reproduce with a failing test, locate the root cause, classify it (bug, spec gap, not a bug, needs info) and write a root-cause report with a fix plan. Use when an issue of type Bug needs analysis.
argument-hint: "[issue-number] [report-file]"
arguments: [issue, report]
---

# Investigate bug #$issue

Write your report to `$report` (default `.agent/root-cause.md`), following `root-cause-report`.
Never commit, push, open a PR, or change production code.

## 1. Understand the report
- `gh issue view $issue --comments`: what happened, steps, expected behaviour, environment,
  severity, and any earlier root-cause analysis or reporter answers in the comments.
- If a previous analysis exists and someone asked you to re-check something, focus on that.

## 2. Find the expected behaviour
- Read `specs/README.md`, then the capability specs that cover the area (grep entity names).
- Note the exact decision IDs and acceptance criteria that define the expected behaviour.
- Read `app/ARCHITECTURE.md` for where the code lives and known pitfalls.

## 3. Reproduce
- In `app/`: `npm ci`, then write a focused test that reproduces the report, named
  `BUG #$issue: <what goes wrong>` (unit test in `src/lib/` or component test next to the
  component, following the existing test style).
- Run it (`npx vitest run <file>`) and confirm it **fails for the reported reason**.
- If you can't reproduce, try the variations the report suggests (data, order, environment).
  Still nothing: the verdict is `cannot-reproduce` and the report says what information is missing.

## 4. Locate the root cause
- Trace from the failing assertion to the code that produces the wrong result.
- Use `git log -p` / `git blame` on that code to see when and why it was written (which issue).
- Distinguish the root cause from the symptom: explain *why* the code is wrong, not only *where*.

## 5. Classify
| Verdict | When |
|---|---|
| `bug` | the code breaks a spec decision or acceptance criterion |
| `spec-gap` | the specs don't define this behaviour; people must decide it first |
| `not-a-bug` | the code does what the specs say; a change would be a new requirement |
| `needs-info` | the report lacks what you need; list the questions for the reporter |
| `cannot-reproduce` | you followed the steps and the bug didn't appear |

## 6. Plan the fix (verdict `bug` only)
- The smallest change that makes the reproduction test pass without breaking any other test or
  spec decision. Name the files and functions.
- Blast radius: what else uses that code; which tests cover it.
- The regression test to keep (your reproduction test, possibly refined).

## 7. Write the report
Follow `root-cause-report` exactly and write it to `$report`. Include the reproduction test code
in the report (the automation doesn't keep files from this run).
