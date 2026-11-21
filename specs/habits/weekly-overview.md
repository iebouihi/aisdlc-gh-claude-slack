---
id: habits/weekly-overview
title: Weekly overview
module: habits
summary: Read-only view, reached from the app navigation, showing a 7-day window for each habit (done, missed, not scheduled, not active) with a per-habit summary; opens on the last 7 days and can step back through earlier 7-day windows; computed from existing data.
entities: [Habit, CheckIn]
status: active
issues: [4, 27, 61]
updated: 2026-11-21
---
# Weekly overview

## Current behaviour
- Week is an item of the app navigation next to Today and Habits (see `platform/app-navigation`). It is a view on the same page; no new route.
- The default (current) window is today plus the 6 previous local dates, oldest to newest (rolling, not Mon–Sun). Column headers are a short weekday plus the date (e.g. "Mon 3"); today is marked when it is in the window. A month name is added where a window crosses months.
- Above the table, a date range label (e.g. "Oct 20 – Oct 26") and "Previous week" / "Next week" buttons let the user move between rolling 7-day windows, 7 days at a time. "Next week" is disabled on the current window. "Previous week" is disabled on the window containing the earliest habit `createdAt` or earliest check-in. Disabled state is not shown by colour alone.
- The selected window lives in memory only. It resets to the current window on reload and when the user leaves the Week view. It stays unchanged while the user stays in Week; the current window refreshes after a local date change.
- Rows are habits in creation order, including Ended ones, if their schedule overlaps the displayed window. A habit with no overlap (ended before the window or starting after it) is hidden. A habit stored without frequency or dates is Daily from its `createdAt` date, with no end date. Deleted habits are gone with their check-ins.
- If no habit overlaps a past window it shows "No habits in this week" and the navigation stays usable.
- Each cell is one of: done (a check-in exists for that day, even if the habit was not scheduled), missed (scheduled and active, past day, no check-in), not scheduled, not active (before start or after end). In the current window, today scheduled and active with no check-in shows "Not done yet", not missed; "Not done yet" never appears in past windows.
- Each habit shows "x of y scheduled days done" for the displayed window. y counts scheduled and active days in the window up to today; x counts done days among them. If y is 0 it shows "No scheduled days".
- Cells are read-only in every window. Check-in stays in the today list. There is no editing or backfill of past days.
- Computed from `habits:v1` and `checkins:v1`. Nothing new is stored; stored check-ins are never discarded.
- With no habits it shows "No habits yet". If stored data is corrupted or unavailable, the existing non-blocking error is shown and the view is empty. The app never crashes.
- The current window refreshes on next focus or interaction after the local date changes, and right after a check-in is toggled today.
- Accessibility: table semantics with row and column headers, cell labels like "Run, Mon 3: done", status by icon plus text (never colour alone), visible focus, WCAG 2.1 AA contrast. The navigation buttons are keyboard operable (Tab, Enter or Space) with clear labels, and a change of range is announced to screen readers.
- Layout: a grid usable from 320px with no horizontal scroll; habit names wrap.
- Navigation does not change the URL path and does not reload the page.
- Uses the device's local date; a changed clock is accepted.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Weekly overview is in scope as a read-only view; supersedes `habits/daily-check-in` D1 (history views are separate). Streaks, reminders, backfill and editing past days stay excluded. | #4 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793539129437529?thread_ts=1793539129.437529&cid=C0CDNGE90V7) |
| ~~D2~~ | ~~"Week" section or tab on the home page; no new route.~~ → superseded by D11 (#27) | #4 | same thread |
| D3 | Default (current) window: today plus the 6 previous local dates, oldest to newest. Earlier windows are reached with D12. | #4 | same thread |
| D4 | Cell states: done, missed, not scheduled, not active; today unchecked is "Not done yet", not missed. | #4 | same thread |
| D5 | Habits listed in creation order, including Ended ones, only if their schedule overlaps the window. | #4 | same thread |
| D6 | A check-in on an unscheduled day is shown as done; stored check-ins are never discarded. | #4 | same thread |
| D7 | Summary "x of y scheduled days done", y = scheduled and active days up to today; if y is 0, "No scheduled days". | #4 | same thread |
| D8 | Read-only; cells are not interactive; check-in stays in the today list. | #4 | same thread |
| D9 | No new stored data; computed from `habits:v1` and `checkins:v1`; no migration. | #4 | same thread |
| D10 | Headers "Mon 3" with today marked; grid from 320px, no horizontal scroll; empty and error states reuse the existing ones; accessible labels, icon plus text, table semantics, AA contrast; refresh on next focus or interaction and after a check-in toggle; local date, changed clock accepted. | #4 | same thread |
| D11 | Week is a nav item next to Today and Habits (`platform/app-navigation`); still one page with no new route. | #27 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793564182896619?thread_ts=1793564182.896619&cid=C0CDNGE90V7) |
| D12 | Users can step back to earlier rolling 7-day windows (shifted 7 days at a time; calendar weeks excluded) with "Previous week" / "Next week" buttons and a visible date range label, placed above the table inside Week. "Next" is disabled on the current window; "Previous" stops at the window containing the earliest habit `createdAt` or earliest check-in. | #61 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1795285731524609?thread_ts=1795285731.524609&cid=C0CDNGE90V7) |
| D13 | Past windows use the same cell and summary rules as D4–D7; "Not done yet" appears only for today. Only existing habits overlapping the window are listed (D5); deleted habits are gone with their check-ins. | #61 | same thread |
| D14 | A window with no overlapping habit shows "No habits in this week"; navigation stays usable. | #61 | same thread |
| D15 | The selected window is kept in memory only: it resets to the current window on reload and when leaving Week, stays while in Week, and the current window refreshes after a date change. No new storage (D9 holds). | #61 | same thread |
| D16 | The table layout is unchanged for past windows (headers "Mon 3", today marked only when in view), with the date range heading above it and a month name where the window crosses months. | #61 | same thread |
| D17 | The navigation buttons are keyboard operable with visible focus and clear labels; disabled state not by colour alone; the range change is announced; usable from 320px with no horizontal scroll; AA contrast. | #61 | same thread |
| D18 | Navigation stays on the same page: no new route and no URL change (`platform/app-navigation` D2). Past days stay read-only (D8 holds); the Progress charts get no past-period navigation. | #61 | same thread |

## Data
- Owns no data. Reads `Habit` from `habits:v1` (schedule fields as in `habits/habit-management`) and `CheckIn` from `checkins:v1` (as in `habits/daily-check-in`).
- The selected window lives only in memory; it is not stored.

## Not covered
- Editing or backfilling past days; tapping a cell to check in.
- Streaks and reminders.
- Calendar-week (Mon–Sun) view.
- Jumping to an arbitrary date, custom ranges, remembering the selected window after reload.
- Past-period navigation in the Progress charts (see `habits/habit-progress-chart`).
- New stored data, export and import.
- Protection against a changed device clock.
- Navigation behaviour when there are no habits at all (only the existing "No habits yet" state).
- Reaching schedule days of a habit that start before its `createdAt`.

## History
- 2026-11-01 #4: Created the capability (read-only 7-day overview per habit; supersedes `habits/daily-check-in` D1).
- 2026-11-01 #27: Week became an item of the app navigation (D11); superseded D2 (section or tab). Behaviour otherwise unchanged.
- 2026-11-21 #61: Added navigation through earlier rolling 7-day windows (D12 to D18); D3 now describes the default window only.
