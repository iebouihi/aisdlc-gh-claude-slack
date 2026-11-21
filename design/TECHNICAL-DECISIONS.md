---
updated: 2026-11-21
issues: [53]
---

# good-habit-tracker: technical decisions

Living summary of the technical choices every design and build respects. Kept true by each design
pull request (see the `technical-summary` skill). _What_ the product does: `specs/`. _Where_ the
code is: `app/ARCHITECTURE.md`. _How a feature is built_: its design in `design/issue-<n>/`.

## Overview

- **Platform:** Next.js static export, React + TypeScript strict; no backend, no login, no server
  code (A1). Runtime dependencies: `next`, `react`, `react-dom` only.
- **Layers:** pure domain functions in `src/lib/` → thin client components in `src/components/`
  → one page `src/app/page.tsx`. `HabitList` owns the data state and the current view (A2).
- **Data:** browser `localStorage` behind one adapter (`src/lib/storage.ts`), one versioned key
  per entity: `habits:v1`, `checkins:v1`, `badges:v1`, `profile:v1`, plus `mood:v1` once #53 is built.
- **UI:** CSS Modules + design tokens (`src/app/tokens.css`); hand-built components, SVG charts
  and dialogs; no UI or chart library.
- **Quality:** Vitest + Testing Library; tests named after acceptance criteria (A3);
  `npm run check` in CI on every PR.

## Decisions

| ID | Decision | Reason | Area | Since |
|---|---|---|---|---|
| TD1 | Derived values (streaks, week cells, progress, budget spend, reminders) are computed from stored data on render, never stored | one source of truth, no migrations | data | existing |
| TD2 | New data goes in an optional field of an existing entry when it belongs to it; a new entity gets its own `<name>:v1` key | old data stays readable without migration | data | existing |
| TD3 | Stored data is validated when parsed: unknown optional values are dropped, malformed ones mark the store corrupted and nothing is overwritten until the next save | the app never crashes or silently loses data | data | existing |
| TD4 | Views are in-page state in `HabitList` (`today`, `week`, `progress`, `habits`), not routes | static export, no state lost on view switch | state | existing |
| TD5 | Dates are local `YYYY-MM-DD` strings; "today" and time come from state refreshed on focus and interaction | correct across midnight and time zones | state | existing |
| TD6 | Visuals are hand-built (SVG/CSS) with a visually hidden data table | no runtime dependency, accessible | UI | existing |
| TD7 | Every UI value comes from design tokens; no colour literal outside `tokens.css` | one look, enforced by a test | UI | existing |
| TD8 | Each designed feature has a technical spec and, when it has UI, a self-contained HTML mockup in `design/issue-<n>/`, merged before development starts | reviewable design, buildable without guessing | process | this file |
| TD9 | The mood day is a day offset (0–5) in `HabitList` session state, mapped to a date with `today` | stays correct across midnight (TD5) | state | #53 |
| TD10 | "Scheduled and active on date X" = `todayStatus(habit, X) === "checkable"`, also for past dates | one rule for schedule logic | domain | #53 |
| TD11 | Correlation insights are pure functions in `src/lib/mood.ts`; thresholds (7 days, 3 / 3, 0.2) are named constants | testable without rendering, one place to change | domain | #53 |

## Designs

| Issue | Technical spec | Mockup |
|---|---|---|
| #53 Mood correlation | [technical-spec](issue-53/technical-spec.md) | [mockup](issue-53/mockup.html) |
