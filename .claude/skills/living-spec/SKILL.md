---
name: living-spec
description: Format and update rules for the living specs in specs/ - one file per capability describing current behaviour, with stable decision IDs. Use when creating or editing a capability spec, or when checking whether a requirement changes an existing decision.
---

# Living specs

`specs/` describes how the product works **now**, one file per capability, grouped by module:
`specs/<module>/<capability>.md` (lower-case, hyphens). Requirements (issues) are change
requests; when one is approved, the capability specs it touches are edited so they stay true.
`specs/README.md` and `specs/<module>/README.md` are generated indexes; never edit them.

## Capability spec format

```markdown
---
id: <module>/<capability>
title: <Capability name>
module: <module>
summary: <one line: what this capability does today>
entities: [<Entity>, ...]
status: active
issues: [<issue numbers that shaped it>]
updated: <YYYY-MM-DD>
---
# <Capability name>

## Current behaviour
- <how it works today, as short rules a developer and a tester can rely on>

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | <decision> | #<issue> | <thread link> |

## Data
- <entities, fields, storage keys, formats this capability owns>

## Not covered
- <what this capability deliberately does not do>

## History
- <YYYY-MM-DD> #<issue>: <one line on what changed>
```

## Update rules
1. **Current state only.** Rewrite "Current behaviour" and "Data" so they are true after the
   change. History lives in the History list, issues and git, not in the text.
2. **Stable decision IDs.** Never renumber. A new decision gets the next free ID.
3. **Changed decision:** keep its row, strike it through and point to the new one:
   `| ~~D3~~ | ~~old decision~~ → superseded by D7 (#4) | #1 | … |`, then add D7.
   Never leave two live decisions that contradict each other.
4. **One capability per file.** If a requirement adds a new capability, create a new file in
   the closest module; create a new module only if none fits.
5. **Only what matters later:** decisions, rules, data and limits that other requirements or
   code depend on. Detailed acceptance criteria stay in the issue; the spec links the issue.
6. Keep each file under ~150 lines. Entities are singular nouns in PascalCase (`Habit`, `CheckIn`).
7. Add one History line per change and update `updated:` and `issues:`.
