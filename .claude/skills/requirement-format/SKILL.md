---
name: requirement-format
description: The exact format of a final, approved requirement (GitHub issue body) - summary, user story, decisions, Given/When/Then acceptance criteria, out of scope, risks and refinement trace. Use whenever writing or checking a final requirement.
---

# Final requirement format

Use this structure, in this order, in GitHub Markdown. Keep every section; write "None" if empty.

```markdown
## Summary
<2–3 sentences: who, what, why>

## User story
As a <user>, I want <capability>, so that <benefit>.

## Decisions
| # | Decision | Decided by | Source |
|---|---|---|---|
| D1 | <one decision per row> | <name> (answer / accepted default) | Slack thread |

## Acceptance criteria
- [ ] **AC1** Given <context>, when <action>, then <observable result>.
- [ ] **AC2** ...

## Out of scope
- <what this issue explicitly does not cover>

## Open risks / follow-ups
- <known risk or follow-up requirement>

## Refinement trace
- Slack thread: <link>
- Approved by: (pending)
```

## Rules
- Every decision in the table comes from the thread; nothing invented.
- Each acceptance criterion is testable by a QA engineer without asking anyone: concrete
  values (limits, messages, order), one behaviour per criterion.
- Cover the happy path, validation errors, empty state, persistence and failure cases that the
  decisions imply.
- `Approved by: (pending)` stays as written; the automation fills it in after approval.
