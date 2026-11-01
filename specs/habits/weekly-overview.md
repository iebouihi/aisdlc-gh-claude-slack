---
id: habits/weekly-overview
title: Weekly overview
module: habits
summary: Read-only view on the home page showing the last 7 days for each habit (done, missed, not scheduled, not active) with a per-habit summary; computed from existing data.
entities: [Habit, CheckIn]
status: active
issues: [4]
updated: 2026-11-01
---
# Weekly overview

## Current behaviour
- A "Week" section or tab on the home page, reachable next to the today list. No new route.
- The window is today plus the 6 previous local dates, oldest to newest (rolling, not Mon–Sun). Column headers are a short weekday plus the date (e.g. "Mon 3"); today is marked.
- Rows are habits in creation order, including Ended ones, if their schedule overlaps the window. A habit with no overlap (ended before the window or starting after today) is hidden. A habit stored without frequency or dates is Daily from its `createdAt` date, with no end date.
- Each cell is one of: done (a check-in exists for that day, even if the habit was not scheduled), missed (scheduled and active, past day, no check-in), not scheduled, not active (before start or after end). Today scheduled and active with no check-in shows "Not done yet", not missed.
- Each habit shows "x of y scheduled days done". y counts scheduled and active days up to today; x counts done days among them. If y is 0 it shows "No scheduled days".
- Cells are read-only. Check-in stays in the today list. There is no editing of past days.
- Computed from `habits:v1` and `checkins:v1`. Nothing new is stored; stored check-ins are never discarded.
- With no habits it shows "No habits yet". If stored data is corrupted or unavailable, the existing non-blocking error is shown and the view is empty. The app never crashes.
- The view refreshes on next focus or interaction after the local date changes, and right after a check-in is toggled today.
- Accessibility: table semantics with row and column headers, cell labels like "Run, Mon 3: done", status by icon plus text (never colour alone), visible focus, WCAG 2.1 AA contrast.
- Layout: a grid usable from 320px with no horizontal scroll; habit names wrap.
- Uses the device's local date; a changed clock is accepted.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Weekly overview is in scope as a read-only view; supersedes `habits/daily-check-in` D1 (history views are separate). Streaks, reminders, backfill and editing past days stay excluded. | #4 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793539129437529?thread_ts=1793539129.437529&cid=C0CDNGE90V7) |
| D2 | "Week" section or tab on the home page; no new route. | #4 | same thread |
| D3 | Rolling window: today plus the 6 previous local dates, oldest to newest. | #4 | same thread |
| D4 | Cell states: done, missed, not scheduled, not active; today unchecked is "Not done yet", not missed. | #4 | same thread |
| D5 | Habits listed in creation order, including Ended ones, only if their schedule overlaps the window. | #4 | same thread |
| D6 | A check-in on an unscheduled day is shown as done; stored check-ins are never discarded. | #4 | same thread |
| D7 | Summary "x of y scheduled days done", y = scheduled and active days up to today; if y is 0, "No scheduled days". | #4 | same thread |
| D8 | Read-only; cells are not interactive; check-in stays in the today list. | #4 | same thread |
| D9 | No new stored data; computed from `habits:v1` and `checkins:v1`; no migration. | #4 | same thread |
| D10 | Headers "Mon 3" with today marked; grid from 320px, no horizontal scroll; empty and error states reuse the existing ones; accessible labels, icon plus text, table semantics, AA contrast; refresh on next focus or interaction and after a check-in toggle; local date, changed clock accepted. | #4 | same thread |

## Data
- Owns no data. Reads `Habit` from `habits:v1` (schedule fields as in `habits/habit-management`) and `CheckIn` from `checkins:v1` (as in `habits/daily-check-in`).

## Not covered
- Editing or backfilling past days; tapping a cell to check in.
- Streaks, reminders and history longer than 7 days.
- Calendar-week (Mon–Sun) view and week navigation.
- New stored data, export and import.
- Protection against a changed device clock.

## History
- 2026-11-01 #4: Created the capability (read-only 7-day overview per habit; supersedes `habits/daily-check-in` D1).
