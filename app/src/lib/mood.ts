/** Mood domain logic: one mood per local day and the habit/mood insights. Pure, no React. */
import { isChecked, todayStatus, type CheckIn } from "./checkins";
import type { Habit } from "./habits";
import { isLocalDate, toLocalDate } from "./schedule";

export type MoodValue = 1 | 2 | 3 | 4 | 5;
/** One mood on one local date ("YYYY-MM-DD"). At most one entry per date. */
export type MoodEntry = { date: string; value: MoodValue };

export const MOOD_LEVELS: { value: MoodValue; emoji: string; label: string }[] = [
  { value: 1, emoji: "😞", label: "Very low" },
  { value: 2, emoji: "🙁", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "High" },
  { value: 5, emoji: "😄", label: "Very high" },
];

/** Today plus the 5 previous days. */
export const MOOD_WINDOW_DAYS = 6;
export const MIN_MOOD_DAYS = 7;
export const MIN_SIDE_DAYS = 3;
export const NO_LINK_BELOW = 0.2;

export const MOOD_ERROR =
  "Your mood entries could not be loaded or saved. Changes may be lost when you close this page.";
export const NOT_ENOUGH_TEXT = "Not enough data yet";
export const NO_LINK_TEXT = "no clear link";

const isMoodValue = (v: unknown): v is MoodValue =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;

/** Turn a stored value into moods. Null when corrupted. Duplicate dates collapse (first wins). */
export function parseMood(value: unknown): MoodEntry[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const result: MoodEntry[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { date, value: v } = entry as Record<string, unknown>;
    if (!isLocalDate(date) || !isMoodValue(v)) return null;
    if (!result.some((m) => m.date === date)) result.push({ date, value: v });
  }
  return result;
}

/** The days a mood can be set for: today, yesterday, then the 4 days before (ISO dates). */
export function moodDays(today: string): { offset: number; date: string; label: string }[] {
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: MOOD_WINDOW_DAYS }, (_, offset) => {
    const date = toLocalDate(new Date(y, m - 1, d - offset));
    const label = offset === 0 ? "Today" : offset === 1 ? "Yesterday" : date;
    return { offset, date, label };
  });
}

export function setMood(moods: readonly MoodEntry[], date: string, value: MoodValue): MoodEntry[] {
  const index = moods.findIndex((m) => m.date === date);
  if (index === -1) return [...moods, { date, value }];
  return moods.map((m, i) => (i === index ? { date, value } : m));
}

export function clearMood(moods: readonly MoodEntry[], date: string): MoodEntry[] {
  return moods.filter((m) => m.date !== date);
}

export type InsightRow = {
  habitId: string;
  name: string;
  icon?: string;
  status: "ok" | "no-link" | "not-enough";
  diff?: number;
  days: number;
};

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** Habit/mood differences. Computed on render, never stored. */
export function insights(
  habits: readonly Habit[],
  checkins: readonly CheckIn[],
  moods: readonly MoodEntry[],
): { logged: number; ready: boolean; rows: InsightRow[] } {
  const logged = new Set(moods.map((m) => m.date)).size;
  const ready = logged >= MIN_MOOD_DAYS;
  if (!ready) return { logged, ready, rows: [] };
  const rows: InsightRow[] = habits.map((habit) => {
    const done: number[] = [];
    const notDone: number[] = [];
    for (const m of moods) {
      if (todayStatus(habit, m.date) !== "checkable") continue; // not scheduled or active: ignored
      (isChecked(checkins, habit.id, m.date) ? done : notDone).push(m.value);
    }
    const days = done.length + notDone.length;
    if (done.length < MIN_SIDE_DAYS || notDone.length < MIN_SIDE_DAYS) {
      return { habitId: habit.id, name: habit.name, icon: habit.icon, status: "not-enough", days };
    }
    const diff = mean(done) - mean(notDone);
    const status = Math.abs(diff) < NO_LINK_BELOW ? "no-link" : "ok";
    return { habitId: habit.id, name: habit.name, icon: habit.icon, status, diff, days };
  });
  const withDiff = rows.filter((r) => r.diff !== undefined);
  const without = rows.filter((r) => r.diff === undefined);
  // Array.prototype.sort is stable: creation order within ties.
  withDiff.sort((a, b) => (b.diff as number) - (a.diff as number));
  return { logged, ready, rows: [...withDiff, ...without] };
}

export function insightText(row: InsightRow): string {
  if (row.status === "not-enough" || row.diff === undefined) return NOT_ENOUGH_TEXT;
  if (row.status === "no-link") return NO_LINK_TEXT;
  const rounded = Math.round(row.diff * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)} on days done`;
}
