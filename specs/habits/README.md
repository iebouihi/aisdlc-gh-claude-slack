# habits

Capabilities in this module. Generated; do not edit by hand.

- [Daily check-in](daily-check-in.md) `habits/daily-check-in`: Mark a habit as done for today (and undo it) and see which habits are done today, with a progress summary; check-ins stored only in the browser's localStorage. (entities: CheckIn; decisions: 15; issues: #2)
- [Discipline badges](discipline-badges.md) `habits/discipline-badges`: Five fixed built-in badges earned from check-ins and streaks, shown passively in a Badges section below the today list; earned badges are kept forever in the browser's localStorage. (entities: Badge; decisions: 14; issues: #24)
- [Habit management](habit-management.md) `habits/habit-management`: Create, list, edit and delete habits with a name, optional catalog icon, frequency and start/end dates; stored only in the browser's localStorage. (entities: Habit; decisions: 47; issues: #1, #15, #2)
- [Weekly overview](weekly-overview.md) `habits/weekly-overview`: Read-only view on the home page showing the last 7 days for each habit (done, missed, not scheduled, not active) with a per-habit summary; computed from existing data. (entities: Habit, CheckIn; decisions: 10; issues: #4)
