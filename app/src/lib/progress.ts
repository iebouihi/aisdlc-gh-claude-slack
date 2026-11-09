/** Progress chart domain logic: done vs expected check-ins over a rolling period. Pure, no React. */
import { isChecked, type CheckIn } from "./checkins";
import type { Habit } from "./habits";

export type Period = 7 | 30;
export const PERIODS: { days: Period; label: string }[] = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
];
export const DEFAULT_PERIOD: Period = 7;
export type ChartType = "bars" | "line";
export const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: "bars", label: "Bars" },
  { type: "line", label: "Line" },
];
export const DEFAULT_CHART_TYPE: ChartType = "bars";
export const NO_SCHEDULED_DAYS_TEXT = "No scheduled days";

export type ProgressDay = { date: string; label: string; isToday: boolean };
export type DayTotal = { date: string; done: number; expected: number };
export type ProgressRow = {
  habit: Habit;
  expected: number;
  done: number;
  /** Whole-number percentage, or null without expected days. */
  percent: number | null;
  /** Today is expected but not checked yet. */
  todayPending: boolean;
};
export type Progress = {
  days: ProgressDay[];
  rows: ProgressRow[];
  perDay: DayTotal[];
  done: number;
  expected: number;
  percent: number | null;
};

function format(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today and the previous `period - 1` local dates, oldest to newest. */
export function periodDays(today: string, period: Period): ProgressDay[] {
  const [y, m, d] = today.split("-").map(Number);
  const days: ProgressDay[] = [];
  for (let i = period - 1; i >= 0; i--) {
    const date = new Date(y, m - 1, d - i);
    const iso = format(date);
    days.push({
      date: iso,
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      isToday: iso === today,
    });
  }
  return days;
}

/** Scheduled and active (started, not ended) on `date`. */
function isExpected(habit: Habit, date: string): boolean {
  if (date < habit.startDate || (habit.endDate !== undefined && date > habit.endDate)) return false;
  if (habit.frequency.type === "weekdays") {
    const [y, m, d] = date.split("-").map(Number);
    return habit.frequency.days.includes(new Date(y, m - 1, d).getDay());
  }
  return true;
}

export function percentOf(done: number, expected: number): number | null {
  return expected === 0 ? null : Math.round((done / expected) * 100);
}

export function figureText(done: number, expected: number): string {
  return `${done} of ${expected} done`;
}

/**
 * Habits in creation order whose schedule overlaps the period, with their done/expected counts.
 * Check-ins on unscheduled days are not counted; habits without expected days stay out of totals.
 */
export function progress(
  habits: readonly Habit[],
  checkins: readonly CheckIn[],
  today: string,
  period: Period,
): Progress {
  if (!today) return { days: [], rows: [], perDay: [], done: 0, expected: 0, percent: null };
  const days = periodDays(today, period);
  const first = days[0].date;
  const rows = habits
    .filter((h) => h.startDate <= today && (h.endDate === undefined || h.endDate >= first))
    .map((habit): ProgressRow => {
      const expectedDays = days.filter((d) => isExpected(habit, d.date));
      const done = expectedDays.filter((d) => isChecked(checkins, habit.id, d.date)).length;
      return {
        habit,
        expected: expectedDays.length,
        done,
        percent: percentOf(done, expectedDays.length),
        todayPending: expectedDays.some((d) => d.isToday) && !isChecked(checkins, habit.id, today),
      };
    });
  const counted = rows.filter((r) => r.expected > 0);
  const perDay = days.map(({ date }) => {
    let done = 0;
    let expected = 0;
    for (const { habit } of counted) {
      if (!isExpected(habit, date)) continue;
      expected++;
      if (isChecked(checkins, habit.id, date)) done++;
    }
    return { date, done, expected };
  });
  const done = counted.reduce((n, r) => n + r.done, 0);
  const expected = counted.reduce((n, r) => n + r.expected, 0);
  return { days, rows, perDay, done, expected, percent: percentOf(done, expected) };
}
