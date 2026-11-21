---
id: habits/mood-correlation
title: Mood correlation
module: habits
summary: Log a daily mood (1–5) with one tap, for today and the 5 previous days, and see which habits tend to go with better mood, labeled as correlation not causation; stored only in the browser's localStorage.
entities: [MoodEntry]
status: active
issues: [53]
updated: 2026-11-21
---
# Mood correlation

## Current behaviour
- Five mood buttons (1 = very low to 5 = very high), each with an emoji and a text label, sit above the habit list next to the "x of y done today" summary. One tap saves the mood, with no confirm step and no toast.
- One mood per day. Tapping another level replaces it. A "Clear" button removes it.
- A day selector (Today, Yesterday, then dates) lets the user log mood for today and the 5 previous days (6 days in total). Older days cannot be set or changed. Check-ins stay today-only (`habits/daily-check-in` D3).
- An "Insights" section under the list shows, per habit, how mood differs between days done and days not done. It always starts with a visible note: "These are patterns in your own data. A link doesn't mean a habit causes better mood." The note also says days without a check-in count as "not done".
- For each habit, only days with a mood where the habit was scheduled and active (see `habits/habit-management`) are used. A day with no check-in counts as "not done".
- Difference = average mood on days done − average mood on days not done, rounded to 1 decimal and shown like "+0.8 on days done". If the absolute unrounded difference is under 0.2, the habit shows "no clear link". Habits with results are sorted from the largest positive difference to the lowest; negative differences are shown, nothing is hidden.
- Results need at least 7 days with a mood. Each habit also needs at least 3 days done and 3 days not done. Otherwise "Not enough data yet" is shown (overall progress such as "4 of 7 days logged"). Results show "based on N days".
- Wording uses "tends to go with", never "improves" or "causes".
- Mood entries are independent of habits: deleting a habit keeps mood entries and removes the habit from the insights; editing a habit keeps its data.
- Results update right after a mood or check-in change. All computation runs in the browser, with no network calls.
- If `mood:v1` is corrupted or storage is unavailable at load, a non-blocking error is shown and mood starts empty. Nothing is overwritten until the user saves a change. The app never crashes. If saving fails after load, the same error is shown and the change stays visible for the session.
- Accessibility: native radio group or buttons, a text label per level (not emoji or color alone), keyboard-operable, visible focus, selected state announced, WCAG 2.1 AA contrast, usable from 320px with no horizontal scroll. Results are shown as text.
- Several tabs: last write wins.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Mood is a 5-point scale (1 very low – 5 very high), 5 buttons with emoji and text label, one tap saves, no confirm | #53 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1795271293204999?thread_ts=1795271293.204999&cid=C0CDNGE90V7) |
| D2 | One mood per day; changeable and clearable ("Clear" button) | #53 | same thread |
| D3 | Mood can be logged for today and the 5 previous days via a day selector; older days locked; check-ins stay today-only (`habits/daily-check-in` D3 unchanged) | #53 | same thread |
| D4 | Notes, tags, mood charts or trends, reminders and export are out of scope | #53 | same thread |
| D5 | Per habit: average mood on days done vs not done, only days with a mood where the habit was scheduled and active; no check-in = not done | #53 | same thread |
| D6 | Difference rounded to 1 decimal ("+0.8 on days done"); sorted from largest positive; absolute difference under 0.2 = "no clear link"; negative shown | #53 | same thread |
| D7 | Minimum data: at least 7 days with a mood overall, and per habit at least 3 days done and 3 days not done; else "Not enough data yet" with progress ("x of 7 days logged"); results show "based on N days" | #53 | same thread |
| D8 | Mood entries are independent of habits: they stay when a habit is deleted; deleted habits leave the insights; editing keeps data | #53 | same thread |
| D9 | Stored in localStorage `mood:v1` as [{date "YYYY-MM-DD" local, value 1–5}], at most one entry per date; `habits:v1` and `checkins:v1` unchanged, no migration; corrupted or unavailable data follows `habits/habit-management` D9 | #53 | same thread |
| D10 | Mood buttons above the habit list next to the "x of y done today" summary; "Insights" section under the list | #53 | same thread |
| D11 | A visible, always-shown note labels results as correlation, not causation; wording "tends to go with", never "improves" or "causes"; the note says days without a check-in count as "not done" | #53 | same thread |
| D12 | Accessible mood controls and text results; computation only in the browser, no network calls; immediate update, no toast | #53 | same thread |

## Data
- Entity `MoodEntry`: `date` (local date "YYYY-MM-DD") and `value` (integer 1–5).
- localStorage key `mood:v1` holds an array of MoodEntry, with at most one entry per `date`. Clearing a mood removes the entry.
- Insights are computed from `mood:v1`, `checkins:v1` and `habits:v1`; nothing derived is stored.

## Not covered
- Notes or tags on a mood.
- Mood history charts or trends.
- Reminders.
- Export and import; cross-tab syncing or merging.
- Mood for days older than the 5 previous days; check-in backfill.
- Proof of cause: results are patterns only.
- Server-side date checks or protection against a changed device clock.
- Re-evaluating past days when a habit's schedule is edited (the current schedule is used).

## History
- 2026-11-21 #53: Created the capability (one-tap mood for today and the 5 previous days, habit correlation insights labeled as correlation, `mood:v1`).
