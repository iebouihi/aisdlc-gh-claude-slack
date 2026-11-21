/** Weekly overview domain logic: the 7-day window and each habit's cell states. Pure, no React. */
import { isChecked, type CheckIn } from "./checkins";
import type { Habit } from "./habits";
import { WEEKDAYS } from "./schedule";

export type CellState = "done" | "missed" | "not-scheduled" | "not-active" | "pending";

export const WINDOW_DAYS = 7;
export const NO_SCHEDULED_DAYS_TEXT = "No scheduled days";

export const STATE_TEXT: Record<CellState, string> = {
  done: "done",
  missed: "missed",
  "not-scheduled": "not scheduled",
  "not-active": "not active",
  pending: "not done yet",
};

export type WeekDay = { date: string; weekday: string; day: number; isToday: boolean };

export type WeekRow = {
  habit: Habit;
  cells: { date: string; state: CellState }[];
  done: number;
  scheduled: number;
};

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function format(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** `date` moved by `days` (negative = back), as a local date string. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = parts(date);
  return format(new Date(y, m - 1, d + days));
}

/** Earliest local date among the habits' createdAt and the check-ins; null when there is none. */
export function earliestDate(
  habits: readonly Habit[],
  checkins: readonly CheckIn[],
): string | null {
  const dates: string[] = [];
  for (const h of habits) {
    const created = new Date(h.createdAt);
    if (!Number.isNaN(created.getTime())) dates.push(format(created));
  }
  for (const c of checkins) dates.push(c.date);
  return dates.length === 0 ? null : dates.reduce((a, b) => (b < a ? b : a));
}

/** Can the window ending at `end` go back (earliest is before it) or forward (it is in the past). */
export function windowBounds(
  end: string,
  today: string,
  earliest: string | null,
): { canPrev: boolean; canNext: boolean } {
  return {
    canPrev: earliest !== null && earliest < shiftDate(end, -(WINDOW_DAYS - 1)),
    canNext: end < today,
  };
}

/** "Oct 20 – Oct 26"; ", YYYY" is appended when the window ends in another year than today. */
export function rangeLabel(days: readonly WeekDay[], today: string): string {
  const fmt = (date: string) => {
    const [, m, d] = parts(date);
    return `${MONTH_SHORT[m - 1]} ${d}`;
  };
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const label = `${fmt(first)} – ${fmt(last)}`;
  const year = parts(last)[0];
  return year === parts(today)[0] ? label : `${label}, ${year}`;
}

/** The 7 local dates ending at `end`, oldest to newest. `isToday` only where a date is `today`. */
export function weekWindow(end: string, today: string): WeekDay[] {
  const [y, m, d] = parts(end);
  const days: WeekDay[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const date = new Date(y, m - 1, d - i);
    const weekday = WEEKDAYS.find((w) => w.day === date.getDay())!.short;
    const iso = format(date);
    days.push({ date: iso, weekday, day: date.getDate(), isToday: iso === today });
  }
  return days;
}

/** State of `habit` on `date`. A stored check-in always shows as done (even when unscheduled). */
export function cellState(
  habit: Habit,
  checkins: readonly CheckIn[],
  date: string,
  today: string,
): CellState {
  if (isChecked(checkins, habit.id, date)) return "done";
  if (date < habit.startDate || (habit.endDate !== undefined && date > habit.endDate)) {
    return "not-active";
  }
  if (habit.frequency.type === "weekdays") {
    const [y, m, d] = parts(date);
    if (!habit.frequency.days.includes(new Date(y, m - 1, d).getDay())) return "not-scheduled";
  }
  return date === today ? "pending" : "missed";
}

/** Habits in creation order whose schedule overlaps the window, with cells and the x of y counts. */
export function weekRows(
  habits: readonly Habit[],
  checkins: readonly CheckIn[],
  today: string,
  end: string = today,
): WeekRow[] {
  if (!today) return [];
  const window = weekWindow(end, today);
  const first = window[0].date;
  return habits
    .filter((h) => h.startDate <= end && (h.endDate === undefined || h.endDate >= first))
    .map((habit) => {
      const cells = window.map(({ date }) => ({
        date,
        state: cellState(habit, checkins, date, today),
      }));
      // Only scheduled and active days count; an unscheduled check-in is shown but not counted.
      const counted = window.filter(({ date }) => {
        const s = cellState(habit, [], date, today);
        return s === "pending" || s === "missed";
      });
      return {
        habit,
        cells,
        scheduled: counted.length,
        done: counted.filter(({ date }) => isChecked(checkins, habit.id, date)).length,
      };
    });
}

export function summaryText(row: Pick<WeekRow, "done" | "scheduled">): string {
  return row.scheduled === 0
    ? NO_SCHEDULED_DAYS_TEXT
    : `${row.done} of ${row.scheduled} scheduled days done`;
}
