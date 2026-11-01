# habits

Capabilities in this module. Generated; do not edit by hand.

- [Daily check-in](daily-check-in.md) `habits/daily-check-in`: Mark a habit as done for today (and undo it) and see which habits are done today, with a progress summary; check-ins stored only in the browser's localStorage. (entities: CheckIn; decisions: 15; issues: #2)
- [Discipline badges](discipline-badges.md) `habits/discipline-badges`: Five fixed built-in badges earned from check-ins and streaks, shown passively in a Badges section below the today list; earned badges are kept forever in the browser's localStorage. (entities: Badge; decisions: 14; issues: #24)
- [Habit management](habit-management.md) `habits/habit-management`: Create, list, edit and delete habits with a name, optional catalog icon, frequency and start/end dates; stored only in the browser's localStorage. (entities: Habit; decisions: 47; issues: #1, #15, #2)
- [Habit streaks](habit-streaks.md) `habits/habit-streaks`: Shows each habit's current streak (consecutive scheduled days completed) next to its row in the today list, computed from habits and check-ins. (entities: Habit, CheckIn; decisions: 15; issues: #3)
- [User profile and welcome](user-profile.md) `habits/user-profile`: An optional user name set inline in the Habits view, shown in a welcome heading on the Today view with the emoji and name of the most recently earned badge; stored in the browser's localStorage. (entities: Profile; decisions: 11; issues: #30)
- [Weekly overview](weekly-overview.md) `habits/weekly-overview`: Read-only view, reached from the app navigation, showing the last 7 days for each habit (done, missed, not scheduled, not active) with a per-habit summary; computed from existing data. (entities: Habit, CheckIn; decisions: 10; issues: #4, #27)
