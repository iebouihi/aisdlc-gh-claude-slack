---
id: habits/habit-budget
title: Habit budget
module: habits
summary: Shows, for each habit with a budget, how much was spent in the current week or month (cost × check-ins) against the budget, and what is left or over; computed from existing data.
entities: [Habit, CheckIn]
status: active
issues: [33]
updated: 2026-11-02
---
# Habit budget

## Current behaviour
- A habit can have an optional cost (fixed amount per check-in) and an optional budget (amount + period "Weekly" or "Monthly"). The fields are set in the add and inline edit forms (see `habits/habit-management`). A budget without a cost is not allowed.
- Only the current period is shown: Weekly = the calendar week Mon–Sun, Monthly = the calendar month, using the device's local date.
- Spent = the habit's cost × the number of its check-ins dated in the current period. The cost used is always the current cost; changing it recomputes the period, and no cost history is stored.
- The habit row on the Habits list shows spent of budget and the amount left, e.g. "12 of 50 spent, 38 left" (amounts with 2 decimals, in the device's locale format, no currency symbol).
- When spent is higher than the budget, the row shows "Over budget by X" (X = spent − budget) with an icon and text, never colour alone. Checking in is never blocked.
- The summary is only on the Habits list row. The Week view and the Today list do not change.
- Computed from `habits:v1` and `checkins:v1`. Nothing new is stored beyond the `cost` and `budget` fields of the Habit.
- Habits without a budget show no summary.
- If stored data is corrupted or unavailable, the existing non-blocking error is shown and the list is empty (see `habits/habit-management`). The app never crashes.
- Accessibility: the summary is readable by screen readers, and the layout is usable from 320px with no horizontal scroll.
- Uses the device's local date; a changed clock is accepted.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Budget = a spending limit per habit, one period per habit: "Weekly" (Mon–Sun) or "Monthly" (calendar month), local date; one budget per habit, no global budget | #33 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793612645519089?thread_ts=1793612645.519089&cid=C0CDNGE90V7) |
| D2 | Cost is a fixed amount per check-in; spent = cost × check-ins in the current period, recomputed with the current cost | #33 | same thread |
| D3 | Row shows spent of budget and the amount left for the current period, e.g. "12 of 50 spent, 38 left" | #33 | same thread |
| D4 | Over budget shows "Over budget by X" with icon and text; check-in is never blocked | #33 | same thread |
| D5 | No currency symbol: plain amounts with 2 decimals in the device's locale format | #33 | same thread |
| D6 | Only the current period; no past periods, charts, reminders, alerts or export; summary only in the Habits list row, Week view unchanged | #33 | same thread |

## Data
- Owns no data. Reads `cost` and `budget` ({amount, period}) from `Habit` in `habits:v1` (as in `habits/habit-management`) and `CheckIn` from `checkins:v1` (as in `habits/daily-check-in`).

## Not covered
- Past periods, charts, reports, reminders, alerts and export.
- A global budget across habits.
- Currency symbols or currency selection.
- Cost history (each check-in keeping its own cost).
- Blocking check-ins when over budget.
- Budget information in the Week view or the Today list.
- Whether Ended habits show the summary, and whether a cost without a budget is displayed.
- Protection against a changed device clock.

## History
- 2026-11-02 #33: Created the capability (current-period spend against a weekly or monthly budget, over-budget display).
