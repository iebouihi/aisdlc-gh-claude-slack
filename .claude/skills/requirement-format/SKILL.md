---
name: requirement-format
description: The exact format of a final, approved requirement (GitHub issue body) - summary, user story, decisions, Given/When/Then acceptance criteria, impact on existing features, out of scope, risks and refinement trace. Use whenever writing or checking a final requirement.
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

## Impact on existing features
| Feature (living spec) | Impact | What changes / what must keep working | ACs · decisions |
|---|---|---|---|
| `habits/weekly-overview` | changes | Week cells also show the mood of the day | AC5 · D4 → D9 |
| `habits/habit-streaks` | keeps working | streaks are counted exactly as before when moods are stored | AC7 |

## Out of scope
- <what this issue explicitly does not cover>

## Open risks / follow-ups
- <known risk or follow-up requirement>

## Living spec
- <specs/<module>/<capability>.md>: created | updated (<decision IDs added or superseded>)

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

## Impact on existing features: rules
This section tells the designer, the developer and the tester which existing features the change
touches, so they update them on purpose and protect the rest. Fill it from the related living
specs you were given and the thread.
- One row per existing capability the change touches: it shares a screen, stored data, computed
  values or a flow with the new behaviour. Use the spec id (`module/capability`).
- **Impact** is one of:
  - `changes`: existing behaviour changes. Say how, link the AC that defines the new behaviour,
    and the spec decision superseded (`D4 → D9`). The developer updates that feature and the
    existing tests that assert the old behaviour; the tester treats those tests as intended changes.
  - `keeps working`: behaviour must stay exactly as it is (regression scope). Say what must not
    change. For the important ones add a regression AC ("Given moods are stored, when … then the
    streak is unchanged"), so it is tested on purpose.
- Every `changes` row needs an explicit decision in the thread (changing an existing decision
  needs a yes), an AC and a living spec update.
- No existing feature affected: write "None: no existing feature is affected." and say why in
  one line (e.g. a new, separate screen with its own data).
