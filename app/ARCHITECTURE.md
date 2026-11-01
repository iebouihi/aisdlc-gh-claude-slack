---
updated: 2026-11-01
issues: [1, 2, 3, 4, 7, 12, 15, 24]
---

# good-habit-tracker: code map

Living context for anyone changing the code, people and agents alike. Keep it true: every PR
that changes structure, a convention or a module updates this file (see the `code-map` skill).
_What_ the product does lives in `specs/`; this file says _where_ and _how_ it is built.

## Stack

- Next.js (App Router) with **static export** (`output: "export"`): plain HTML/JS, no server,
  no API routes, no server actions. Everything runs in the browser.
- React, TypeScript (strict). No state library; React state and small custom hooks.
- Tests: Vitest + Testing Library (jsdom). `npm run check` = lint + typecheck + tests + build.
- Tooling: ESLint (`eslint-config-next`), Prettier (`npm run format`), Node 26 (`.nvmrc` = `26`, `engines.node` = `26.x`).
- Styling: a global stylesheet with CSS variables (`src/app/globals.css`), light and dark, plus
  CSS Modules per page/component (`*.module.css`). No Tailwind or UI library.

## Structure

| Path              | What lives there                                                     |
| ----------------- | -------------------------------------------------------------------- |
| `src/app/`        | routes (`page.tsx`), the root layout and global styles               |
| `src/components/` | UI components, one per file (`HabitList.tsx`), with a colocated test |
| `src/lib/`        | domain logic as pure functions and the storage adapter; no React     |

## Modules

| Module          | Files                                                                                                                                                                                                                                                                                                                                                                   | Spec                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| App shell       | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/page.module.css`                                                                                                                                                                                                                                                                                                     | platform/app-foundation                        |
| Storage helper  | `src/lib/storage.ts` (`readJson`, `writeJson`, `HABITS_KEY` = `habits:v1`, `CHECKINS_KEY` = `checkins:v1`; return a `StorageResult`)                                                                                                                                                                                                                                    | platform/app-foundation                        |
| Habit domain    | `src/lib/habits.ts` (`validateName`, `parseHabits`, `addHabit`, `updateHabit`, `removeHabit`; pure) and `src/lib/icons.ts` (24-emoji `ICON_CATALOG`, `iconEmoji` with default fallback)                                                                                                                                                                                 | habits/habit-management                        |
| Schedule domain | `src/lib/schedule.ts` (`Frequency`, `Schedule`, `validateSchedule`, `parseFrequency`, `isLocalDate`, `toLocalDate`, `summarize`, `hasEnded`, error texts; pure). `Habit` has required `frequency` and `startDate` in memory, optional `endDate`                                                                                                                         | habits/habit-management                        |
| Check-in domain | `src/lib/checkins.ts` (`CheckIn`, `todayStatus`, `parseCheckins`, `isChecked`, `toggleCheckIn`, `removeCheckInsFor`, `todaySummary`; pure)                                                                                                                                                                                                                              | habits/daily-check-in                          |
| Habit UI        | `src/components/HabitList.tsx` (state, storage wiring, add form, inline edit, focus), `ScheduleFields.tsx` (frequency radios, weekday checkboxes, date inputs, draft helpers), `IconPicker.tsx`, `DeleteDialog.tsx`, `HabitList.module.css`; rendered by `src/app/page.tsx`. `HabitList` also owns check-in state, the row checkbox and the "x of y done today" summary | habits/habit-management, habits/daily-check-in |
| Streaks         | `src/lib/streak.ts` (`currentStreak`, `streakText`, `NO_STREAK_TEXT`; pure) and `StreakLine` in `HabitList.tsx` (icon + text under each today-list row; no new storage)                                                                                                                                                                                                 | habits/habit-streaks                           |
| Weekly overview | `src/lib/week.ts` (`weekWindow`, `cellState`, `weekRows`, `summaryText`; pure) and `src/components/WeekView.tsx` + `WeekView.module.css` (read-only table, rendered by `HabitList` in a "Week" section below the today list; no new storage)                                                                                                                            | habits/weekly-overview                         |
| Badges          | `src/lib/badges.ts` (`BADGES`, `bestStreak`, `awardBadges`, `newBadgeIds`, `parseBadges`; pure) and `src/components/Badges.tsx` + `Badges.module.css` (read-only groups, rendered by `HabitList` in a "Badges" section below the Week section). Stored in `badges:v1` (`BADGES_KEY`)                                                                                    | habits/discipline-badges                       |
| Setup checks    | `src/lib/project-setup.test.ts` (config and dependency rules)                                                                                                                                                                                                                                                                                                           | platform/app-foundation                        |

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
- **Check-ins are `{habitId, date}` entries in `checkins:v1`**, separate from `habits:v1`. `HabitList` keeps `today` in state (empty until mounted) and refreshes it on window focus, `visibilitychange` and any pointerdown/keydown; toggles always use that `today`. Corrupted check-ins start empty and are not overwritten until a save; deleting a habit removes its entries. If habits storage already shows an error, the check-in error is not shown twice.
- **The Week view is computed, never stored:** `weekRows(habits, checkins, today)` derives cells from `habits:v1` and `checkins:v1` using `HabitList`'s `today`, so it follows toggles and date changes. A check-in always shows as done; it counts in "x of y" only on scheduled, active days. Cell state is an icon plus visually hidden text (`<habit>, <weekday> <day>: <state>`).
- **Streaks are computed, never stored:** `currentStreak(habit, checkins, today)` walks back from today (or the end date) to the start date counting checked scheduled days; unscheduled days are skipped, an unchecked today is neither counted nor breaking. Shown only in the today list, and hidden when `checkins:v1` is in error. The row text has a visually hidden "Run: " prefix (class `visuallyHidden`).
- **Badges are a fixed set in code; only the earned ones are stored** (`badges:v1` = `[{badgeId, earnedAt}]`, one per badge, never removed). `awardBadges` uses `bestStreak` (longest past or current run of a single habit, same counting as `currentStreak`) and runs on load and after each toggle, dating new badges `today`. "New" labels live in `HabitList` state only, so they vanish on the next load. Corrupted badges: error alert (only if no other storage alert), all Locked, nothing written until a toggle earns a badge. Badges render as `role="group"` blocks (not a list) with the "New" label as `aria-live="polite"`, so they don't collide with the habit list's `listitem` and `status` queries.
- **Modals are hand-written** (`DeleteDialog`: focus trap, Escape), not native `<dialog>`.
- Client components start with `"use client"` only where they need state or effects.
- Runtime dependencies are only `next`, `react`, `react-dom` (enforced by a test).
- No new runtime dependency without a reason in the PR description.

## Decisions

| ID  | Decision                                                                                                                                         | Since      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| A1  | Static export; no backend                                                                                                                        | foundation |
| A2  | Domain logic pure in `src/lib/`, storage behind one adapter                                                                                      | foundation |
| A3  | Vitest + Testing Library; tests named after acceptance criteria                                                                                  | foundation |
| A4  | TypeScript 5.9 (strict) until Next.js supports the native TypeScript 7 compiler                                                                  | foundation |
| A5  | One Node version (26) everywhere: `.nvmrc`, `engines`, CI, Vercel. Vercel deploys `main` and PR previews with default settings; no `vercel.json` | #12        |
