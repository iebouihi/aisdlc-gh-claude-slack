---
id: habits/habit-progress-chart
title: Habit progress chart
module: habits
summary: Read-only "Progress" view, reached from the app navigation, charting done versus expected check-ins overall (as bars or as a line) and per habit for the last 7 or 30 days; computed from existing data.
entities: [Habit, CheckIn]
status: active
issues: [36, 43]
updated: 2026-11-09
---
# Habit progress chart

## Current behaviour
- Progress is an item of the app navigation next to Today, Habits and Week (see `platform/app-navigation`). It is a view on the same page; no new route. The Week view is unchanged.
- The period is selectable: "Last 7 days" (default) or "Last 30 days". Both are rolling: today plus the 6 (or 29) previous local dates. Longer history is not offered.
- Expected, per habit = number of days in the period on which the habit is scheduled and active (started, not ended), up to and including today. Today counts as expected even when not yet checked and is labelled "not done yet".
- Done, per habit = check-ins in the period on expected days. A check-in on an unscheduled or not active day stays stored but is not counted, so done never exceeds expected.
- The view shows one overall chart at the top, with an overall figure "x of y done" and a percentage (sum of done over sum of expected).
- The overall chart can be shown as "Bars" (default) or "Line", chosen with a two-option toggle "Bars | Line" next to the period selector. Bars: for each day of the period, a paired bar "done" vs "expected" across all habits. Line: two lines over the period, "done" and "expected", one point per day, with the same numbers as the bars.
- A day with no expected habits is plotted as 0 expected and 0 done in the line chart, with no gap; the data table shows 0 and 0.
- The toggle marks the selected option by more than colour, exposes `aria-pressed`, is keyboard operable and has a visible focus. The choice is not stored: it resets to Bars on each load and is kept while the period or the nav view is switched in the same session.
- Below the overall chart, each habit (creation order) with expected days shows one progress bar, "x of y done" and a percentage. The Bars | Line choice does not affect these.
- A habit with no expected days in the period but whose schedule overlaps it shows "No scheduled days", has no bar and is left out of the overall total. A habit with no overlap with the period (ended before it or starting after today) is hidden.
- Habits stored without frequency or dates are treated as in `habits/habit-management` (Daily from `createdAt`, no end date).
- Charts are plain SVG/CSS, with no charting library and no network calls.
- Accessibility: every chart (bars and line) has a text alternative and an equivalent data table; done and expected are told apart by pattern, line style, markers or label, never by colour alone; WCAG 2.1 AA contrast in light and dark themes; visible focus.
- Layout: usable from 320px with no horizontal scroll, including the line chart over 30 points; habit names wrap.
- With no habits it shows "No habits yet". If stored data is corrupted or unavailable, the existing non-blocking error is shown and the charts are empty. The app never crashes.
- The view refreshes on the next focus or interaction after the local date changes, and right after a check-in is toggled today.
- Read-only: no editing of past days; check-in stays in the today list. Uses the device's local date; a changed clock is accepted.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Progress is a new nav item on the same page, no new route; the Week view stays unchanged (`habits/weekly-overview` D8 and D11 untouched). | #36 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793636280694309?thread_ts=1793636280.694309&cid=C0CDNGE90V7) |
| D2 | One overall chart plus one chart per habit. | #36 | same thread |
| D3 | Selectable period: last 7 days (default) or last 30 days, rolling, ending today; longer history excluded. | #36 | same thread |
| D4 | Streaks, goals/targets, reminders, export and editing past days are excluded. | #36 | same thread |
| D5 | Expected = scheduled and active days in the period, up to and including today (same as `habits/weekly-overview` D7 "y"). | #36 | same thread |
| D6 | Done = check-ins in the period on expected days; a check-in on an unscheduled day is stored but not counted, so done never exceeds expected. | #36 | same thread |
| D7 | Today counts as expected even if not yet checked ("not done yet"). | #36 | same thread |
| D8 | No expected days: "No scheduled days", no bar, left out of the overall total; habits with no overlap with the period are hidden. | #36 | same thread |
| D9 | No new stored data; computed from `habits:v1` and `checkins:v1`; no migration. | #36 | same thread |
| D10 | Figures shown as "x of y done" and a percentage, in addition to the chart. | #36 | same thread |
| ~~D11~~ | ~~Overall: paired done/expected bars per day. Per habit: a single progress bar. Plain SVG/CSS.~~ → superseded by D17 (#43) | #36 | same thread |
| D12 | Text alternative and data table; pattern or label, never colour alone; AA contrast; usable from 320px with no horizontal scroll. | #36 | same thread |
| D13 | Empty and error states reuse the existing ones ("No habits yet"; non-blocking error with empty charts). | #36 | same thread |
| D14 | Refresh on next focus or interaction after the local date changes, and right after a check-in toggle. | #36 | same thread |
| D15 | No third-party charting dependency; no network calls. | #36 | same thread |
| D16 | Target user: the single app user who wants to see at a glance whether they keep to their habit schedule, to stay motivated. | #36 | same thread |
| D17 | The overall chart can be shown as paired done/expected bars (default) or as a line chart; per habit stays a single progress bar. Plain SVG/CSS. Replaces D11. | #43 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1794218730883409?thread_ts=1794218730.883409&cid=C0CDNGE90V7) |
| D18 | The Bars/Line choice applies to the overall chart only. Only bar and line are offered, over the existing 7 and 30 day periods; pie, area, stacked, tooltips, zoom and custom ranges are excluded. | #43 | same thread |
| D19 | The line chart plots two lines per day, "done" and "expected", with the bars' numbers; a day with no expected habits is plotted as 0 and 0, with no gap. | #43 | same thread |
| D20 | The chart type is not remembered after reload (resets to Bars); it is kept during the session when switching period or nav view. No new storage, D9 holds. | #43 | same thread |
| D21 | A two-option toggle "Bars \| Line" next to the period selector; selected option marked by more than colour, `aria-pressed`, keyboard operable, visible focus. | #43 | same thread |
| D22 | The line chart follows D12: text alternative, same data table, line style and markers or labels (never colour alone), AA contrast in light and dark themes. | #43 | same thread |
| D23 | The line chart is plain SVG (D15), usable from 320px with no horizontal scroll, and 30 points stay readable. | #43 | same thread |

## Data
- Owns no data. Reads `Habit` from `habits:v1` (schedule fields as in `habits/habit-management`) and `CheckIn` from `checkins:v1` (as in `habits/daily-check-in`).
- The Bars/Line choice lives only in memory for the session; it is not stored.

## Not covered
- Streaks, goals/targets, reminders.
- Editing or backfilling past days.
- History longer than 30 days, custom date ranges, calendar-week or month navigation.
- New stored data, export and import.
- Third-party charting libraries.
- Other chart types (pie, area, stacked), tooltips, zoom.
- A line chart for the per-habit charts.
- Remembering the chart type after reload.
- Protection against a changed device clock.
- Percentage rounding rule and the habit order beyond creation order (not decided).

## History
- 2026-11-02 #36: Created the capability (read-only Progress view charting done vs expected, overall and per habit, 7 or 30 days).
- 2026-11-09 #43: Overall chart can be shown as Bars (default) or Line via a "Bars | Line" toggle (D17 to D23); superseded D11.
