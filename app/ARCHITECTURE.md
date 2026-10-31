---
updated: 2026-10-31
issues: [1, 7, 12, 15]
---
# good-habit-tracker: code map

Living context for anyone changing the code, people and agents alike. Keep it true: every PR
that changes structure, a convention or a module updates this file (see the `code-map` skill).
*What* the product does lives in `specs/`; this file says *where* and *how* it is built.

## Stack
- Next.js (App Router) with **static export** (`output: "export"`): plain HTML/JS, no server,
  no API routes, no server actions. Everything runs in the browser.
- React, TypeScript (strict). No state library; React state and small custom hooks.
- Tests: Vitest + Testing Library (jsdom). `npm run check` = lint + typecheck + tests + build.
- Tooling: ESLint (`eslint-config-next`), Prettier (`npm run format`), Node 26 (`.nvmrc` = `26`, `engines.node` = `26.x`).
- Styling: a global stylesheet with CSS variables (`src/app/globals.css`), light and dark, plus
  CSS Modules per page/component (`*.module.css`). No Tailwind or UI library.

## Structure
| Path | What lives there |
|---|---|
| `src/app/` | routes (`page.tsx`), the root layout and global styles |
| `src/components/` | UI components, one per file (`HabitList.tsx`), with a colocated test |
| `src/lib/` | domain logic as pure functions and the storage adapter; no React |

## Modules
| Module | Files | Spec |
|---|---|---|
| App shell | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/page.module.css` | platform/app-foundation |
| Storage helper | `src/lib/storage.ts` (`readJson`, `writeJson`, `HABITS_KEY` = `habits:v1`; return a `StorageResult`) | platform/app-foundation |
| Habit domain | `src/lib/habits.ts` (`validateName`, `parseHabits`, `addHabit`, `updateHabit`, `removeHabit`; pure) and `src/lib/icons.ts` (24-emoji `ICON_CATALOG`, `iconEmoji` with default fallback) | habits/habit-management |
| Schedule domain | `src/lib/schedule.ts` (`Frequency`, `Schedule`, `validateSchedule`, `parseFrequency`, `isLocalDate`, `toLocalDate`, `summarize`, `hasEnded`, error texts; pure). `Habit` has required `frequency` and `startDate` in memory, optional `endDate` | habits/habit-management |
| Habit UI | `src/components/HabitList.tsx` (state, storage wiring, add form, inline edit, focus), `ScheduleFields.tsx` (frequency radios, weekday checkboxes, date inputs, draft helpers), `IconPicker.tsx`, `DeleteDialog.tsx`, `HabitList.module.css`; rendered by `src/app/page.tsx` | habits/habit-management |
| Setup checks | `src/lib/project-setup.test.ts` (config and dependency rules) | platform/app-foundation |

## Conventions
- **Domain logic is pure** and lives in `src/lib/` (validation, sorting, IDs, dates), tested
  without rendering. Components stay thin.
- **Browser storage only through one adapter** in `src/lib/` (versioned key, safe parse, never
  throws to the UI). Components never touch `localStorage` directly. Static export means no
  `window` at build time: read storage in effects or client components, never during render on
  the server.
- **Tests are traceability:** a test that verifies an acceptance criterion starts its name with
  the criterion ID and the issue: `it("AC3 (#1): empty name shows an inline error", ...)`.
- **Accessibility is not optional:** labelled controls, keyboard operation, visible focus,
  errors announced (`role="alert"` or `aria-describedby`), WCAG AA contrast.
- **Storage is read in an effect** (`HabitList`), and the list renders nothing until `loaded`, so
  there is no empty-state flash and the static build never touches `localStorage`.
- **Focus moves through `pendingFocus` + `data-focus` attributes:** an action stores a selector,
  and an effect focuses it after the next render.
- **Stored data is validated in `parseHabits`:** a malformed entry means corrupted (`null`); an
  unknown `icon` is dropped silently. Corrupted data is only overwritten on the next save.
- **Dates are local `"YYYY-MM-DD"` strings**, compared as strings; "today" is `toLocalDate(new Date())`,
  never UTC. Weekdays are numbered like `Date.getDay` (0 = Sunday) and shown Monday first.
- **Legacy habits are normalised in `parseHabits`** (missing frequency/startDate → Daily from the
  local `createdAt` date); no migration is written until the next save. A present but malformed
  schedule field is corrupted.
- **Edit validation compares with the stored habit** (`validateSchedule(…, today, previous)`): the
  past-date rule applies only to a changed start or end date. The add form's start date is set in
  the load effect, so the static build never contains a build-time date.
- **Modals are hand-written** (`DeleteDialog`: focus trap, Escape), not native `<dialog>`.
- Client components start with `"use client"` only where they need state or effects.
- Runtime dependencies are only `next`, `react`, `react-dom` (enforced by a test).
- No new runtime dependency without a reason in the PR description.

## Decisions
| ID | Decision | Since |
|---|---|---|
| A1 | Static export; no backend | foundation |
| A2 | Domain logic pure in `src/lib/`, storage behind one adapter | foundation |
| A3 | Vitest + Testing Library; tests named after acceptance criteria | foundation |
| A4 | TypeScript 5.9 (strict) until Next.js supports the native TypeScript 7 compiler | foundation |
| A5 | One Node version (26) everywhere: `.nvmrc`, `engines`, CI, Vercel. Vercel deploys `main` and PR previews with default settings; no `vercel.json` | #12 |
