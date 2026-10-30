---
name: tests-from-acceptance-criteria
description: Turn a requirement's acceptance criteria (AC1, AC2, … in Given/When/Then form) into Vitest + Testing Library tests named after their AC IDs, so coverage is traceable. Use when writing or reviewing tests for an issue.
---

# Tests from acceptance criteria

## Naming = traceability
A test that verifies an acceptance criterion starts its name with the criterion ID and issue:

```ts
it("AC3 (#1): an empty name shows an inline error and nothing is saved", async () => { … });
```

Several tests may cover one AC; one test should cover only one AC. Helper or edge-case tests
without an AC ID are fine, but every AC needs at least one named test.

## Where tests go
- **Domain rules** (validation, ordering, storage parsing): unit tests next to the module in
  `src/lib/` (`habits.test.ts`). Fast, no rendering.
- **Behaviour the user sees** (empty state, errors, focus, keyboard): component tests next to
  the component (`HabitList.test.tsx`) with Testing Library.
- **Persistence**: test through the storage adapter; `localStorage` is cleared after each test.

## How to write them
- Given → arrange state (seed the storage adapter, render the component).
- When → act like a user: `userEvent` typing, clicking, pressing Enter/Escape.
- Then → assert what the user perceives: roles, accessible names, text, focus, stored data.
- Query by role and accessible name (`getByRole("button", { name: "Add" })`), not by CSS class
  or test IDs; this also checks accessibility.
- Use the exact values from the criteria (limits, messages, order).

## Done means
Every AC ID from the issue appears in at least one test name, and `npm run check` passes.
List the mapping in the PR description (see `pr-description`).
