---
id: habits/habit-streaks
title: Habit streaks
module: habits
summary: Shows each habit's current streak (consecutive scheduled days completed) next to its row in the today list, computed from habits and check-ins.
entities: [Habit, CheckIn]
status: active
issues: [3]
updated: 2026-11-01
---
# Habit streaks

## Current behaviour
- Each habit row in the today list shows its current streak: an icon plus text such as "3-day streak" ("1-day streak" for one). It is read-only.
- The streak counts consecutive scheduled days on which the habit was checked. Days when the habit is not scheduled neither add to the streak nor break it.
- If today is scheduled but not checked, the streak is counted up to the last scheduled day before today; checking today adds 1 immediately. The streak only breaks when a past scheduled day is missed.
- A check-in on a day when the habit was not scheduled is kept and shown as done in the weekly overview, but does not count toward the streak.
- Only days from the start date to the end date count. Counting goes back with no limit until a missed scheduled day or the start date.
- A streak of 0 shows "No streak yet". An Ended habit shows its final streak with an "Ended" label.
- The streak is computed on the fly from the current schedule (frequency, start date, end date) and the stored check-ins. Editing the schedule or start date recomputes it; check-ins are never discarded, and days scheduled only under the old schedule do not break it. Habits without frequency or dates are treated as Daily from their `createdAt` date.
- The streak is never conveyed by color alone. The row's accessible text includes "Run: 3-day streak". It works from 320px with no horizontal scroll and the text wraps.
- "Today" is the device's local date, refreshed on the next focus or interaction after the date changes. A changed clock is accepted.
- If `checkins:v1` is corrupted or storage is unavailable, the existing non-blocking error is shown, no streaks are shown and the app does not crash.
- The weekly overview does not show streaks and is unchanged.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Streaks are in scope as a read-only number; supersedes the exclusion of streaks in `habits/daily-check-in` D1 and `habits/weekly-overview` D1. Reminders, backfill, editing past days and best streak stay out | #3 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793550058260329?thread_ts=1793550058.260329&cid=C0CDNGE90V7) |
| D2 | Shown next to each habit's row in the today list; the weekly overview does not change | #3 | same thread |
| D3 | Current streak only; best streak is a follow-up | #3 | same thread |
| D4 | Counts consecutive scheduled days; unscheduled days neither add nor break; the unit is "days" | #3 | same thread |
| D5 | Today scheduled but unchecked does not break the streak; checking it adds 1; only a missed past scheduled day breaks it | #3 | same thread |
| D6 | A check-in on an unscheduled day is stored and shown in the weekly overview but does not count | #3 | same thread |
| D7 | Only start-to-end-date days count; Ended habits show their final streak labelled "Ended"; a streak of 0 shows "No streak yet" | #3 | same thread |
| D8 | Always recomputed from the current schedule and stored check-ins; past check-ins are never discarded; days scheduled only under the old schedule do not break it | #3 | same thread |
| D9 | Computed on the fly from `habits:v1` and `checkins:v1`; nothing new is stored; no migration | #3 | same thread |
| D10 | No limit on how far back it counts: until a missed scheduled day or the start date | #3 | same thread |
| D11 | Display is an icon plus "N-day streak" ("1-day streak" for one); not by color alone; updates immediately when today is toggled | #3 | same thread |
| D12 | Accessible text includes "Run: N-day streak"; works from 320px with no horizontal scroll; text wraps | #3 | same thread |
| D13 | Uses the device's local date, refreshed on the next focus or interaction; a changed clock is accepted | #3 | same thread |
| D14 | Corrupted `checkins:v1` or unavailable storage: reuse the existing non-blocking error, show no streaks, never crash | #3 | same thread |
| D15 | Milestones, celebrations and notifications are out of scope | #3 | same thread |

## Data
- No data of its own. The streak is derived from `Habit` (`frequency`, `startDate`, `endDate`, `createdAt`) in `habits:v1` and from the check-ins in `checkins:v1`.

## Not covered
- Best streak and streak history.
- Reminders, notifications, milestones and celebrations.
- Backfilling or editing past days.
- Streaks in the weekly overview.
- Storing the streak and any migration.
- Protection against a changed device clock.

## History
- 2026-11-01 #3: Created the capability (read-only current streak per habit, computed from schedule and check-ins).
