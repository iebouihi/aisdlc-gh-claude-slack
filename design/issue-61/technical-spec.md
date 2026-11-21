---
issue: 61
title: Week view: navigate to previous weeks
specs: [habits/weekly-overview, platform/app-navigation]
decisions: [TD13, TD14, TD15, TD1, TD4, TD5, TD10]
mockup: mockup.html
status: proposed
updated: 2026-11-21
---
# Technical design: #61 Week view: navigate to previous weeks

## Approach
The window logic in `src/lib/week.ts` already derives everything from a `today` string. We generalise it
to take the window's **end date** instead of always using today, so past windows reuse `cellState`,
`weekRows` and `summaryText` (a past date is never `pending`, so it is `missed`). The selected window is
a local `useState` in `WeekView`: `HabitList` renders `WeekView` only while `view === "week"`, so leaving
Week unmounts it and the window resets for free (AC12); a reload resets it too. Navigation is two buttons
plus a live range label above the table. No new storage, route or dependency.

## Technical decisions
| ID | Decision | Reason | Status |
|---|---|---|---|
| TD13 | The selected window is stored as its **end date** (`string` or `null`, `null` = current window) in `WeekView` state. Previous/Next shift it by 7 days; an end date `>= today` counts as `null` | "current" follows `today` across midnight (AC14) while a chosen past window never moves (AC13) | new |
| TD14 | The "Previous" limit is the window containing the earliest of: each habit's `createdAt` (as a local date) and each check-in date, computed on render by `earliestDate()` in `week.ts` | no stored data (TD1); matches D5 | new |
| TD15 | A window change is announced by an `aria-live="polite"` range label; native `<button>`s; the disabled state is shown by `disabled`, a dashed border and muted text, never colour alone | AC4, AC16 | new |
| TD1, TD4, TD5, TD10 | Computed on render; view state in `HabitList`; local date strings; "scheduled and active" rule | relied on | existing |

## Modules and files
| Module (code map) | File | Change |
|---|---|---|
| Weekly overview | `src/lib/week.ts` | `weekWindow(end, today)`: 7 days ending at `end`, `isToday` only when equal to `today` (was `weekWindow(today)`; update callers). New (pure): `shiftDate(date, days)`, `earliestDate(habits, checkins): string \| null`, `windowBounds(end, today, earliest)` returning `{ canPrev, canNext }`, `rangeLabel(days, today)` ("Oct 20 – Oct 26"; ", YYYY" appended when the end year differs from today's), `MONTH_SHORT`. `weekRows(habits, checkins, today, end = today)`: overlap filter becomes `startDate <= end && (endDate undefined or endDate >= first)`; cells keep `cellState(…, today)` |
| Weekly overview | `src/components/WeekView.tsx` | `useState<string \| null>(null)` for the end date; nav bar (Previous week, range label, Next week); caption = range label; month name in a header where the month changes (first column and the change day); "No habits in this week" when habits exist but no row overlaps; nav hidden when there are no habits |
| Weekly overview | `src/components/WeekView.module.css` | new `.nav`, `.navButton` (with `:disabled`, `:focus-visible`), `.range`, `.monthMark` |
| Habit UI | `src/components/HabitList.tsx` | none (same props; already unmounts `WeekView` outside Week) |

## Impact on existing features
| Feature (spec) | Impact | Modules touched | Existing tests |
|---|---|---|---|
| `habits/weekly-overview` | changes: caption "Last 7 days" becomes the date range; month name in headers on month change; `weekWindow` signature | `week.ts`, `WeekView.tsx` | `week.test.ts` (`weekWindow(x)` → `weekWindow(x, x)`); `HabitList.week.test.tsx` only if it asserts the caption |
| `habits/weekly-overview` current-window cells and summaries | keeps working (`end = today`) | same functions | cell and summary tests unchanged |
| `platform/app-navigation` | keeps working (Week stays an in-page view, no URL change) | none | nav tests unchanged |
| `habits/habit-progress-chart` | keeps working (D3 of the issue: no change) | none | progress tests unchanged |
| `habits/daily-check-in`, `habits/habit-management` | keeps working (toggles refresh the current window; deleted habits vanish) | none | unchanged |

## Data and storage
No stored data; computed from `habits:v1` and `checkins:v1`. The window end date lives only in component state. Corrupted or unavailable data is handled by `HabitList` as today (AC18): habits are empty, so `WeekView` shows "No habits yet" and no navigation.

## State and components
- `HabitList` owns `habits`, `checkins`, `today` (refreshed on focus and interaction, TD5) and `view`.
- `WeekView` owns `end` (session lifetime, reset on unmount). Derived on render: `effectiveEnd = end !== null && end < today ? end : today`.
- Tree: `WeekView` → nav (`<button>` Previous week, `<p aria-live="polite">` range, `<button>` Next week) → `<table>` (unchanged apart from caption and month marks) → legend.
- A past window is never clamped silently if data later shrinks; it just renders (Previous may then be disabled).

## Acceptance criteria → design
| AC | Design element | Test (where) |
|---|---|---|
| AC1 | `end = null` → `weekWindow(today, today)`, range label, `canNext` false | component, `HabitList.week-nav.test.tsx` (new) |
| AC2 | Previous: `shiftDate(effectiveEnd, -7)`; headers, cells, summaries derive from it | component, same file |
| AC3 | Next: `shiftDate(+7)`, treated as current at `>= today`; `canNext` | component + unit `week.test.ts` |
| AC4 | `earliestDate`, `windowBounds.canPrev`; disabled button, dashed border (mockup "Earliest window") | unit + component |
| AC5 | `cellState` for a past date → `missed`, never `pending` | unit `week.test.ts` |
| AC6 | `weekRows` + `summaryText` for the window | unit |
| AC7 | `cellState` checks check-ins first → `done` | unit |
| AC8 | overlap filter in `weekRows`, creation order kept | unit + component |
| AC9 | "No habits in this week", nav still rendered (mockup "No habits in window") | component |
| AC10 | `.monthMark` where `MONTH_SHORT` changes; `isToday` only when equal to `today` | component |
| AC11 | cells remain non-interactive `<td>`s | component (click, no check-in) |
| AC12 | `WeekView` unmounts outside Week; local state | component + e2e |
| AC13 | end date stored, not an offset; toggles do not touch it | component |
| AC14 | `end` compared with the refreshed `today` | component (mocked date) |
| AC15 | no router, no storage write | e2e (URL, `localStorage` unchanged) |
| AC16 | native buttons, `aria-live="polite"` label, `:focus-visible` | component + axe e2e |
| AC17 | `table-layout: fixed`, wrapping names, nav wraps (mockup 320px) | e2e mobile |
| AC18 | existing error path | existing test kept |

## UI
- Mockup `mockup.html`, states: current window (Next disabled) · past window with month change · earliest window (Previous disabled) · no habits in window · focus style · 320px width.
- Accessibility: buttons named "Previous week" / "Next week"; the range label is the only live region; the table caption repeats the range as the table name; when a pressed button becomes disabled, focus moves to the other button so it is not lost.

## Risks and trade-offs
- A habit whose `startDate` precedes its `createdAt` may have days beyond the Previous limit (accepted in the issue).
- After midnight on a past window the end date stays, so the window is still correct but may sit closer than 7 days to today.

## Open questions
- Add the year to the range label when the window ends in another year? - recommended: yes (designed so).
- No habits at all: hide navigation and keep "No habits yet" - recommended: yes (designed so).
