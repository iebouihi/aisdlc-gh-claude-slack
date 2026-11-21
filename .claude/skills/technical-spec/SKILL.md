---
name: technical-spec
description: The exact format of a feature's technical spec (design/issue-<n>/technical-spec.md) - approach, technical decisions, modules and files, data and storage, state and components, acceptance criteria traceability, test plan, risks and open questions. Use when writing or checking a technical design.
---

# Technical spec format

One file per designed issue: `design/issue-<n>/technical-spec.md`. It is the developer agent's
build plan: it says **how**, the issue says **what**. Write it in this structure:

```markdown
---
issue: <n>
title: <issue title without [REQ]>
specs: [<module/capability>, ...]          # living specs this design implements
decisions: [TD<n>, ...]                    # technical decisions added or relied on
mockup: mockup.html                        # or: none
status: proposed                           # the merged PR makes it the agreed design
updated: <YYYY-MM-DD>
---
# Technical design: #<n> <title>

## Approach
<3–6 sentences: the shape of the solution and why this way, not another>

## Technical decisions
| ID | Decision | Reason | Status |
|---|---|---|---|
| TD<n> | <choice later work must respect> | <one line> | new / existing / supersedes TD<m> |

## Modules and files
| Module (code map) | File | Change |
|---|---|---|
| Habit domain | `src/lib/habits.ts` | add `foo(habit, today)`: pure, returns … |
| Habit UI | `src/components/HabitList.tsx` | render `<Foo>` in the Today view |

## Impact on existing features
| Feature (spec) | Impact (from the issue) | Modules / components touched | Existing tests to update or keep |
|---|---|---|---|
| `habits/weekly-overview` | changes (AC5) | `WeekView.tsx`, `week.ts` | `WeekView.test.tsx` cell tests → AC5 |
| `habits/habit-streaks` | keeps working | none (reads the same check-ins) | `streak.test.ts`, `e2e/regression` unchanged |

## Data and storage
- <new key or optional field, type, example value; how old data is read; what is corrupted>
- or: "No stored data; computed from …"

## State and components
- <who owns which state, its lifetime (render / session / stored), props passed down>
- <component tree for the new UI, one line per component>

## Acceptance criteria → design
| AC | Design element | Test (where) |
|---|---|---|
| AC1 | `foo()` in `src/lib/habits.ts` | unit, `habits.test.ts` |
| AC2 | empty state in `<Foo>` (mockup: state "Empty") | component, `HabitList.foo.test.tsx` |

## UI
- Mockup: `mockup.html`, states: <list>. Texts shown are the real ones.
- Accessibility: <roles, labels, focus moves, announcements>

## Risks and trade-offs
- <what could go wrong, what this design gives up>

## Open questions
- <question> - recommended: <option> (or "None")
```

Rules:
- Every acceptance criterion from the issue appears in the traceability table.
- Every row of the issue's "Impact on existing features" appears in the impact table, with the
  code and the existing tests it touches; mark a mockup frame for each `changes` row with UI.
- Name real files and functions from the code map; mark new ones as new.
- Spec decisions are referenced by ID (`habits/habit-management` D3), never restated differently.
- Code snippets only for signatures and data shapes, never full implementations.
