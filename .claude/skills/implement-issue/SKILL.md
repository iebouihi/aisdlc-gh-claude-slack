---
name: implement-issue
description: Implement an approved requirement (GitHub issue labelled ready-for-dev) in app/ end to end - read the requirement and living specs, plan, build, test every acceptance criterion, update the code map, open a pull request. Use when asked to implement an issue.
argument-hint: "[issue-number] [branch]"
arguments: [issue, branch]
allowed-tools: Read Write Edit Glob Grep Bash(gh issue view *) Bash(gh pr create *) Bash(gh pr view *) Bash(git *) Bash(npm *) Bash(npx *) Bash(ls *) Bash(cat *)
---

# Implement issue #$issue

Work on branch `$branch` (create it from the default branch if it doesn't exist).
If no branch was given, use `dev/issue-$issue`.

## 1. Understand
- `gh issue view $issue`: the body is the **approved final requirement**. Note every decision,
  acceptance criterion (AC1, AC2, …), and what is out of scope.
- Read `specs/README.md`, then the living specs listed in the issue's "Living spec" section.
- Read the approved design, when it exists: `design/issue-$issue/technical-spec.md` (approach,
  modules and files, data, state, AC → design table, test plan) and `design/issue-$issue/mockup.html`
  (layout, states, exact texts, roles and labels). The design was reviewed and merged: build it,
  don't redesign it. No design folder means the design step was skipped; design it yourself, small.
- Read `design/TECHNICAL-DECISIONS.md` (`TD<n>`) and `app/ARCHITECTURE.md` (stack, structure,
  conventions, `A<n>` decisions).
- Stop if the issue is not ready: no acceptance criteria, or a criterion that contradicts a
  spec, design, technical or code-map decision. Then make no changes, open no PR, and end your run with a short
  summary of the blocker; the automation reports it on the issue and in Slack.

## 1b. Impact on existing features
The issue's **"Impact on existing features"** table is part of the requirement:
- `changes` rows: update that existing feature to the new behaviour (its AC), and update the
  existing tests that assert the old behaviour, unit and end-to-end (`app/e2e/`): change the
  assertion to the new AC and rename the test (`AC5 (#$issue): …`). Never delete such a test
  without replacing it.
- `keeps working` rows: don't change that behaviour. Run its existing tests; if one fails, your
  change caused a regression: fix your code, not the test (see `regression-guard`).
- A behaviour change you need that is **not** in the table: don't make it; stop and ask in the PR.

## 2. Plan (keep it short, put it in the PR later)
- Start from the technical spec's "Modules and files" and "Acceptance criteria → design" tables;
  otherwise decide which files you'll add or change, in which module (`src/lib`, `src/components`,
  `src/app`).
- Which acceptance criteria each part covers, and which impacted existing features (and tests)
  each part changes.

## 3. Build in small steps
- Domain logic first, as pure functions in `src/lib/` with unit tests.
- Then components and wiring, with component tests.
- Follow `tests-from-acceptance-criteria`: every AC has at least one test whose name starts
  with `AC<n> (#$issue):`.
- Respect every spec decision and every `TD<n>`. Match the mockup's structure, states and texts.
  No features beyond the requirement.

## 4. Verify
- In `app/`: `npm ci` (first time) then `npm run check`. Fix until it passes.
- Then the end-to-end regression suite: `npm run build && npm run e2e` (if the Playwright browser
  is missing: `npx playwright install chromium`). Failures follow `regression-guard`. The tester
  agent adds end-to-end tests for your acceptance criteria after you open the PR.
- Re-read the acceptance criteria and tick each one off against a test.

## 5. Update the living context
- Follow `code-map`: update `app/ARCHITECTURE.md` (modules table, new conventions or decisions,
  `issues:` and `updated:` in the frontmatter).

## 6. Commit, push, open the PR
- Commit with a message like `#$issue: <what it does>`; push `$branch`.
- Open the pull request with `gh pr create --base main --head $branch` and a body that follows
  `pr-description` (title: `#$issue <issue title without [REQ]>`).
- If `gh pr create` fails, leave the branch pushed; the automation opens or links it.

## Changing an existing PR (review feedback)
When a reviewer asks for changes with `@claude`, apply only what they asked, keep tests and the
code map in sync, run `npm run check`, push to the same branch, and reply with what changed.
