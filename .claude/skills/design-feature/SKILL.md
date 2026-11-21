---
name: design-feature
description: Technically design an approved requirement (GitHub issue labelled ready-for-design) end to end - read the requirement, specs and technical context, decide the approach, write the technical spec, build the HTML mockup, update the technical decisions summary, open a design pull request. Use when asked to design an issue.
argument-hint: "[issue-number] [branch]"
arguments: [issue, branch]
allowed-tools: Read Write Edit Glob Grep Bash(gh issue view *) Bash(gh pr create *) Bash(gh pr view *) Bash(git *) Bash(ls *) Bash(cat *) Bash(mkdir *)
---

# Design issue #$issue

Work on branch `$branch` (create it from the default branch if it doesn't exist).
If no branch was given, use `design/issue-$issue`. Write only under `design/`.

## 1. Understand
- `gh issue view $issue --comments`: the body is the **approved final requirement**. Note every
  decision, acceptance criterion (AC1, AC2, …) and what is out of scope.
- Read `specs/README.md`, then the living specs listed in the issue's "Living spec" section.
- Read `design/TECHNICAL-DECISIONS.md` (technical choices already made, `TD<n>`) and
  `app/ARCHITECTURE.md` (modules, conventions, `A<n>` decisions).
- Look at the code the feature will touch (modules named in the code map), only what you need.
- Stop if the issue is not ready: no acceptance criteria, or a criterion that contradicts a spec,
  code-map or technical decision you cannot design around. Then write nothing, open no PR, and
  end your run with a short summary of the blocker; the automation reports it.

## 2. Decide the approach
- For each real choice (data shape, where logic lives, state ownership, component split,
  storage, interaction pattern), consider at most 2–3 options and pick one with a one-line reason.
  Follow `design-guidelines`: reuse first, smallest change, no new runtime dependency.
- Only choices that later work must respect become technical decisions (`TD<n>`); routine
  applications of existing conventions don't.

## 3. Write the technical spec
- `design/issue-$issue/technical-spec.md`, in the `technical-spec` format: every AC appears in
  the traceability table; every new or changed module, type, storage field and component is named.

## 4. Build the mockup (when the feature has UI)
- `design/issue-$issue/mockup.html`, following `ui-mockup`: one self-contained page, real tokens,
  every state the acceptance criteria mention. No UI change → no mockup; say so in the spec.

## 5. Update the technical summary
- Follow `technical-summary`: add or supersede `TD<n>` rows in `design/TECHNICAL-DECISIONS.md`,
  update the overview if the technical picture changed, add the issue to `issues:`, set `updated:`.

## 6. Commit, push, open the PR
- Commit with a message like `Design #$issue: <what it designs>`; push `$branch`.
- Open the pull request with `gh pr create --base main --head $branch`, title
  `Design #$issue <issue title without [REQ]>`, body:

```markdown
Designs #$issue (merging makes it ready for development)

## Approach
<3–5 sentences: how it will be built and why this way>

## Technical decisions
- TD<n> <decision> (new | supersedes TD<m>)

## Acceptance criteria → design
| AC | Covered by |
|---|---|
| AC1 | <module / component / state in the spec> |

## Mockup
`design/issue-$issue/mockup.html`: <states shown> (or "No UI change")

## Open questions for the reviewer
- <anything you did not decide, with your recommendation, or "None">
```

- If `gh pr create` fails, leave the branch pushed; the automation opens or links it.

## Changing an existing design PR (review feedback)
When a reviewer asks for changes with `@claude`, apply only what they asked, keep the spec, the
mockup and `TECHNICAL-DECISIONS.md` consistent with each other, push to the same branch, and
reply with what changed.
