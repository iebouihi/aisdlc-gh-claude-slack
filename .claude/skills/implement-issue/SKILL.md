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
- Read `app/ARCHITECTURE.md` (stack, structure, conventions, decisions).
- Stop if the issue is not ready: no acceptance criteria, or a criterion that contradicts a
  spec or code-map decision. Then make no changes, open no PR, and end your run with a short
  summary of the blocker; the automation reports it on the issue and in Slack.

## 2. Plan (keep it short, put it in the PR later)
- Which files you'll add or change, in which module (`src/lib`, `src/components`, `src/app`).
- Which acceptance criteria each part covers.

## 3. Build in small steps
- Domain logic first, as pure functions in `src/lib/` with unit tests.
- Then components and wiring, with component tests.
- Follow `tests-from-acceptance-criteria`: every AC has at least one test whose name starts
  with `AC<n> (#$issue):`.
- Respect every spec decision. No features beyond the requirement.

## 4. Verify
- In `app/`: `npm ci` (first time) then `npm run check`. Fix until it passes.
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
