---
name: fix-bug
description: Fix a validated bug (issue of type Bug with an approved root-cause analysis) in app/ - regression test first, smallest fix from the validated plan, check, code map pitfall if needed, pull request. Use when a bug's fix has been approved.
argument-hint: "[issue-number] [branch]"
arguments: [issue, branch]
allowed-tools: Read Write Edit Glob Grep Bash(gh issue view *) Bash(gh pr create *) Bash(gh pr view *) Bash(git *) Bash(npm *) Bash(npx *) Bash(ls *) Bash(cat *)
---

# Fix bug #$issue

Work on branch `$branch` (create it from the default branch). If no branch was given, use
`fix/issue-$issue`.

## 1. Read what was validated
- `gh issue view $issue --comments`. The latest comment headed **Root-cause analysis** is what a
  person validated: its root cause, fix plan and test plan are your scope. Later comments may
  refine it; follow them.
- Read the specs and `app/ARCHITECTURE.md` sections the analysis cites.

## 2. Regression test first
- Add the reproduction test from the analysis (refine it if needed), named
  `BUG #$issue: <what goes wrong>`, next to the code it covers.
- Run it and confirm it **fails** before you change any production code.

## 3. Smallest fix
- Change only what the fix plan names. No refactoring, no unrelated improvements, no new
  features, no new dependencies.
- If the plan turns out to be wrong or incomplete (the cause is elsewhere, or the fix would change
  a spec decision), don't improvise a bigger change: stop, open the PR with what you have (or no
  code) and explain under "Questions for the reviewer".

## 4. Verify
- The regression test now passes; in `app/`: `npm run check` passes (lint, types, all tests, build).

## 5. Living context
- If the root cause is a pattern others could repeat (a pitfall), add one line to a **Pitfalls**
  section in `app/ARCHITECTURE.md` (create the section if missing) and update its frontmatter
  (`issues:`, `updated:`), following `code-map`. Otherwise leave the code map alone.

## 6. Commit, push, open the PR
- Commit `Fix #$issue: <what it fixes>`; push `$branch`.
- `gh pr create --base main --head $branch` with title `Fix #$issue: <issue title without [BUG]>`
  and this body:

~~~markdown
Fixes #$issue

## Root cause
<one or two sentences, from the validated analysis>

## Fix
<what changed and why it is the smallest safe change>

## Regression test
- `<file>` › "BUG #$issue: …" (failed before the fix, passes now)

## Spec decisions honoured
- <decision IDs the fix restores>

## How to verify
- `cd app && npm ci && npm run check`
- Manual: <the reproduction steps, now behaving as expected>

## Questions for the reviewer
- <or "None">
~~~

If `gh pr create` fails, leave the branch pushed; the automation opens or links the PR.
