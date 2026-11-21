---
name: technical-summary
description: Keep design/TECHNICAL-DECISIONS.md (the living summary of technical choices - overview, patterns and TD decisions with stable IDs) true after every design. Use whenever a design makes, relies on or supersedes a technical decision.
---

# The living technical summary

`design/TECHNICAL-DECISIONS.md` is the short, current answer to "how do we build things here, and
what has already been decided?". Designers read it before designing, developers before building,
investigators before diagnosing. It is to technical choices what `specs/` is to behaviour.

| File | Answers |
|---|---|
| `specs/` | what the product does (behaviour, decisions `D<n>`) |
| `design/TECHNICAL-DECISIONS.md` | how features are designed (technical choices `TD<n>`) |
| `app/ARCHITECTURE.md` | where the code is and its conventions (code map, `A<n>`) |
| `design/issue-<n>/` | the full design of one feature (technical spec + mockup) |

## Update it in every design PR
- **New decision**: add a row with the next free `TD<n>`, the decision in one line, the reason,
  the area (data, state, UI, structure, testing…) and the issue (`#<n>`, linking the technical spec).
- **Superseded decision**: strike the old row (`~~TD2~~ → TD7`) and add the new one. Never edit a
  decision's meaning in place. Call the change out in the PR.
- **Overview and patterns**: update only when the technical picture changed (a new storage key, a
  new cross-cutting pattern). Keep each item one line.
- **Designs**: add the issue to the designs list with its spec path and mockup.
- Frontmatter: append the issue number to `issues:`, set `updated:`.

## Rules
- Current state only; history is in git and in the PRs. Keep it under ~150 lines: link to the
  technical specs, don't copy them.
- Decision IDs are stable and never reused.
- Don't repeat the code map or the specs; reference them (`A2`, `habits/daily-check-in` D4).
