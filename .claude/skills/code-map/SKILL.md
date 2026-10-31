---
name: code-map
description: Keep app/ARCHITECTURE.md (the living code map - stack, structure, modules, conventions, architecture decisions) true after a code change. Use whenever a change adds or moves a module, introduces a convention or makes an architecture decision.
---

# The living code map

`app/ARCHITECTURE.md` tells the next person or agent *where* and *how* things are built, so they
don't have to read the whole codebase. It is to code what `specs/` is to behaviour.

## Update it when your change
- adds a module (a new file group in `src/lib`, `src/components` or a route): add a row to
  **Modules** with its files and the spec it implements (`habits/habit-management`);
- introduces a convention others must follow (a hook pattern, a storage key format): add it to
  **Conventions**;
- makes an architecture decision (a dependency, a pattern, a trade-off): add a row to
  **Decisions** with the next free `A<n>` ID and the issue number;
- moves or removes something the map mentions: fix the map;
- fixes a bug whose root cause is a pattern others could repeat: add one line to **Pitfalls**
  (create the section if missing) with the bug number.

Always update the frontmatter: append the issue number to `issues:` and set `updated:`.

## Rules
- Current state only; history is in git. Keep it short (under ~120 lines); link, don't copy.
- Never contradict a decision silently: superseding one (`~~A2~~ → A5`) is an architecture
  change and must be called out in the PR description for the reviewer.
- Behaviour belongs in `specs/`, not here. If code reveals that a spec is wrong or incomplete,
  say so in the PR; don't edit `specs/` (that goes through refinement).
