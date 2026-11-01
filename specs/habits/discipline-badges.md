---
id: habits/discipline-badges
title: Discipline badges
module: habits
summary: Five fixed built-in badges earned from check-ins and streaks, shown passively in a Badges section below the today list; earned badges are kept forever in the browser's localStorage.
entities: [Badge]
status: active
issues: [24]
updated: 2026-11-01
---
# Discipline badges

## Current behaviour
- A "Badges" section below the today list shows exactly 5 fixed badges in one row that wraps, in this order: First Step 👣, Steady 3 🌱, Week Warrior ⚔️, Fortnight Focus 🔥, Iron Discipline 🏆. The weekly overview is unchanged.
- Rules: First Step = first check-in ever. Steady 3, Week Warrior, Fortnight Focus and Iron Discipline = a streak of 3, 7, 14 and 30 days on a single habit.
- Badges are app-wide: a badge is earned when any one habit reaches the rule. Streaks use the same calculation as `habits/habit-streaks` (scheduled days only). Past streaks of Ended habits count.
- Once earned, a badge stays earned forever, with its earned date (local date), even if the streak breaks, the check-in is undone, the schedule is edited or the habit is deleted.
- Earned badge: logo, name, and the text "Earned on <date>". Unearned badge: locked, grayscale, name and rule text (e.g. "Reach a 7-day streak") and the text "Locked". State never relies on color alone.
- A newly earned badge shows a passive "New" label until the next visit (next page load or app reopen), announced to screen readers. There is no toast, modal or notification.
- Earned badges are stored in `badges:v1`. `habits:v1` and `checkins:v1` are unchanged and need no migration.
- If `badges:v1` is corrupted or storage is unavailable at load, the existing non-blocking error is shown and all badges show as Locked. The app never crashes. Nothing is overwritten until the user saves a change.
- Logos are built-in emoji or inline SVG shipped in the code. There are no uploads, no network calls and no AI at runtime.
- Accessibility: each badge has its name and state as text, the logo is decorative, WCAG 2.1 AA contrast, usable from 320px with no horizontal scroll.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Supersedes `habits/habit-streaks` D15 for badges only: badges are shown passively; celebrations, toasts and notifications stay out of scope | #24 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793556434939749?thread_ts=1793556434.939749&cid=C0CDNGE90V7) |
| D2 | Exactly 5 fixed built-in badges; no user-defined badges | #24 | same thread |
| D3 | The AI proposed names, logos and rules once; the app has no AI or network calls | #24 | same thread |
| D4 | Rules: First Step (first check-in), Steady 3 (3-day streak), Week Warrior (7), Fortnight Focus (14), Iron Discipline (30) | #24 | same thread |
| D5 | Badges are app-wide: any single habit reaching the rule earns the badge | #24 | same thread |
| D6 | Once earned, a badge is kept forever with its earned date, even after a streak break, delete or schedule edit | #24 | same thread |
| D7 | Same streak calculation as `habits/habit-streaks` (scheduled days only); Ended habits' past streaks count | #24 | same thread |
| D8 | Unearned badges are locked and grayscale with the rule text; never color alone | #24 | same thread |
| D9 | Stored in `badges:v1` as [{badgeId, earnedAt "YYYY-MM-DD" local}], at most one entry per badge; `habits:v1` and `checkins:v1` unchanged, no migration | #24 | same thread |
| D10 | Corrupted or unavailable `badges:v1`: existing non-blocking error, all badges Locked, no crash, no overwrite until the user saves | #24 | same thread |
| D11 | "Badges" section below the today list, one row of 5 that wraps; weekly overview unchanged | #24 | same thread |
| D12 | Passive "New" label until the next visit, announced to screen readers; no toast or modal | #24 | same thread |
| D13 | Name and state as text ("Earned on <date>" or "Locked"), decorative logo, AA contrast, usable from 320px with no horizontal scroll | #24 | same thread |
| D14 | Logos are built-in emoji or inline SVG; no uploads, no network calls | #24 | same thread |

## Data
- Entity `Badge`: `badgeId` (string, one of `first-step`, `steady-3`, `week-warrior`, `fortnight-focus`, `iron-discipline`) and `earnedAt` (local date "YYYY-MM-DD" when the badge was earned).
- localStorage key `badges:v1` holds an array of earned Badge, with at most one entry per `badgeId`. Unearned badges have no entry. The badge definitions (name, logo, rule) are shipped in the code.
- Reads `Habit` from `habits:v1` and `CheckIn` from `checkins:v1` (unchanged).

## Not covered
- Sharing badges.
- Badge history and progress bars.
- Levels.
- Resetting badges.
- User-defined badges; uploaded or network-loaded logos.
- Celebrations, toasts, modals and notifications.
- An AI or network call at runtime.
- Protection against a changed device clock.

## History
- 2026-11-01 #24: Created the capability (5 fixed discipline badges earned from check-ins and streaks, `badges:v1`; supersedes `habits/habit-streaks` D15 for passive badges).
