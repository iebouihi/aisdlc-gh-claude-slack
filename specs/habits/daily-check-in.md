---
id: habits/daily-check-in
title: Daily check-in
module: habits
summary: Mark a habit as done for today (and undo it) and see which habits are done today, with a progress summary; check-ins stored only in the browser's localStorage.
entities: [CheckIn]
status: active
issues: [2]
updated: 2026-11-01
---
# Daily check-in

## Current behaviour
- Each habit scheduled today (Daily, or today's weekday) and active (started, not ended) has a checkbox-style toggle at the start of its row. The same control marks it done and not done for today.
- Done rows show a check mark, the text "Done" and a distinct style. Status never relies on color alone.
- Habits that cannot be checked today stay in the list with no toggle: dimmed with "Not scheduled today", or "Starts <date>", or "Ended". They are not counted in the summary.
- A summary above the list reads "x of y done today": y = habits scheduled and active today, x = those done. The list keeps creation order; there is no reordering or filtering.
- Only today's date (the device's local date) can be checked. There is no backfill and no future check-in.
- When the local date changes, status refreshes on the next focus or interaction at the latest. Earlier check-ins stay stored and the new day starts as not done.
- Check-ins are linked to the habit by `id`. Editing a habit keeps its check-ins; a check-in made today stays valid even if the schedule is edited afterwards.
- Deleting a habit also deletes its check-ins (see `habits/habit-management` D53).
- The UI updates immediately on toggle, with no toast.
- If `checkins:v1` is corrupted or storage is unavailable at load, a non-blocking error is shown and check-ins start empty. Nothing is overwritten until the user saves a change. The app never crashes.
- If saving fails after load, the same non-blocking error is shown and the change stays visible for the current session.
- Accessibility: native checkbox or toggle button, operable with Space, with the habit name in its accessible name, visible focus, status change announced to screen readers, WCAG 2.1 AA contrast, usable from 320px with no horizontal scroll.
- Several tabs: last write wins.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Scope is today's check-in and status only; history views, streaks and reminders are separate requirements | #2 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793532079551769?thread_ts=1793532079.551769&cid=C0CDNGE90V7) |
| D2 | Only habits scheduled today and active (started, not ended) have a check control; others show "Not scheduled today", "Starts <date>" or "Ended" | #2 | same thread |
| D3 | Only today's date can be checked; no backfill, no future check-ins; backfill is a follow-up requirement | #2 | same thread |
| D4 | The same control toggles done and not done for today | #2 | same thread |
| D5 | Status refreshes when the date changes (on next focus or interaction at the latest); earlier check-ins stay stored | #2 | same thread |
| D6 | Check-ins are linked by habit `id`, kept on edit; a check-in made today stays valid if the schedule is edited later | #2 | same thread |
| D7 | Deleting a habit also deletes its check-ins | #2 | same thread |
| D8 | Stored in localStorage key `checkins:v1` as [{habitId, date "YYYY-MM-DD" local}], at most one entry per habit per date; `habits:v1` unchanged, no migration | #2 | same thread |
| D9 | Corrupted or unreadable data: non-blocking error, empty check-ins, no crash, no overwrite until the user saves; save failure keeps the change for the session | #2 | same thread |
| D10 | Checkbox-style toggle at the start of each row; done shows a check mark, "Done" text and a distinct style; never color alone | #2 | same thread |
| D11 | Summary above the list, e.g. "2 of 4 done today"; no reordering or filtering | #2 | same thread |
| D12 | Habits not scheduled today stay in the list, dimmed, and are not counted in "x of y" | #2 | same thread |
| D13 | Native checkbox or toggle button, Space-operable, habit name in the accessible name, visible focus, announced status change, AA contrast, usable from 320px | #2 | same thread |
| D14 | UI updates immediately on toggle, no toast | #2 | same thread |
| D15 | No export/import or cross-tab syncing; last write wins | #2 | same thread |

## Data
- Entity `CheckIn`: `habitId` (string, the `id` of a Habit) and `date` (local date "YYYY-MM-DD", the device's local date when checked).
- localStorage key `checkins:v1` holds an array of CheckIn, with at most one entry per `habitId` and `date`. Unchecking removes the entry.

## Not covered
- Check-ins for past or future days (backfill).
- History views, streaks and reminders.
- Export and import; cross-tab syncing or merging.
- Reordering or filtering the list by status.
- Toasts or other save feedback.
- Whether a habit checked today but no longer scheduled after an edit counts in "x of y", and whether it can be unchecked.
- The summary text when no habit is scheduled and active today.
- Server-side date checks or protection against a changed device clock.

## History
- 2026-11-01 #2: Created the capability (check a habit done for today, undo, today's status and summary, `checkins:v1`).
