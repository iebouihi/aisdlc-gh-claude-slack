---
name: pr-description
description: Write the description of a pull request that implements an issue - summary, acceptance criteria coverage, decisions honoured, code map changes, how to verify, questions for the reviewer. Use when opening or updating a developer pull request.
---

# Pull request description

Reviewers should be able to judge the PR from this description plus the diff. Use this
structure, in GitHub Markdown:

```markdown
Closes #<issue>

## Summary
<2–3 sentences: what the user can now do, and how it is built>

## Acceptance criteria
| AC | Covered by | Status |
|---|---|---|
| AC1 | `HabitList.test.tsx` › "AC1 (#1): …" | ✅ |
| AC2 | `habits.test.ts` › "AC2 (#1): …" | ✅ |

## Spec decisions honoured
- `habits/habit-management` D3 (trimmed, 1–60 chars): `validateName` in `src/lib/habits.ts`

## Code map
- <rows added or changed in app/ARCHITECTURE.md, and any architecture decision (A<n>)>

## How to verify
- `cd app && npm ci && npm run check`
- Manual: `npm run dev`, then <2–4 steps that exercise the main flow>

## Questions for the reviewer
- <anything ambiguous you did not decide, or "None">
```

Rules:
- Every AC from the issue appears in the table; mark ⚠️ with a reason if not fully covered.
- Mention every new runtime dependency and why.
- Keep it factual; no marketing language.
