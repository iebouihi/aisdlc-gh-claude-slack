---
name: test-feature
description: Test an issue's open developer or fix pull request end to end - read the requirement, its impact on existing features and the design, write Playwright tests for every acceptance criterion, run the full regression suite with accessibility checks, explore the feature, push the tests and write the test report. Use when asked to test an issue or its pull request.
argument-hint: "[issue-number] [branch] [report-file]"
arguments: [issue, branch, report]
allowed-tools: Read Write Edit Glob Grep Bash(gh issue view *) Bash(gh pr view *) Bash(gh pr diff *) Bash(git *) Bash(npm *) Bash(npx *) Bash(ls *) Bash(cat *) Bash(mkdir *)
---

# Test issue #$issue

Branch: `$branch` (the pull request's branch; check it out: `git fetch origin $branch && git
checkout $branch`). Report file: `$report` (default `.agent/test-report.md`).
Write only under `app/e2e/` and the report file.

## 1. Understand what to test
- `gh issue view $issue --comments`: the acceptance criteria (AC1, AC2, …), the out-of-scope list
  and the **"Impact on existing features"** section (behaviour meant to change, behaviour that
  must keep working). For a bug: the validated root-cause report and its expected behaviour.
- `gh pr view $branch` and `gh pr diff $branch --name-only`: what changed, and which modules
  (map them to capabilities with `app/ARCHITECTURE.md`).
- `design/issue-$issue/technical-spec.md` and `mockup.html` if they exist: states, exact texts,
  roles and labels the UI must have.
- Existing tests in `app/e2e/` (regression suite) and the unit tests named `AC<n> (#$issue)`.

## 2. Plan (keep it short; it goes in the report)
- For each AC: the end-to-end test that proves it, or why a unit test already covers it fully
  (pure logic with no UI effect) - every AC with a user-visible result gets an E2E test.
- For each impacted existing feature: the existing tests that cover it, and any that must change.

## 3. Write the tests
- `app/e2e/features/issue-$issue.spec.ts`, following `e2e-from-acceptance-criteria`.
  A bug gets `BUG #$issue: …` tests instead (`app/e2e/features/bug-$issue.spec.ts`).
- Update existing tests only as `regression-guard` allows.

## 4. Run everything
In `app/`: `npm ci` (if needed), `npm run build`, then `npm run e2e` (desktop + mobile, all
tests, accessibility included). Also `npm test` for the unit tests.
- New test fails → is the test wrong (fix the test) or the code (a finding, keep the test)?
  Check against the requirement, never against the current behaviour.
- Existing test fails → `regression-guard`.
- A test that passes only sometimes → rerun it 3 times (`--repeat-each=3`); report it as flaky.

## 5. Explore
Follow `exploratory-testing` for 10–15 minutes on the feature and its impacted neighbours.

## 6. Push and report
- Commit only `app/e2e/**`: `#$issue: end-to-end tests for AC1–AC<n>`; push to `$branch`.
  Never push to `main`, never merge.
- Write `$report` in the `test-report` format. The verdict is honest: `fail` if any AC is not
  met or any regression is found, even if everything else is green.
- If you cannot test at all (no build, no requirement), still write the report with verdict
  `blocked` and the reason.
