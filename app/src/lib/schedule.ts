/** Habit schedule: frequency and start/end dates. Pure, no React. Dates are local "YYYY-MM-DD". */

export type Frequency = { type: "daily" } | { type: "weekdays"; days: number[] };

export type Schedule = { frequency: Frequency; startDate: string; endDate?: string };

/** Weekday numbers follow `Date.getDay` (0 = Sunday). Listed Monday first for display. */
export const WEEKDAYS: readonly { day: number; short: string; long: string }[] = [
  { day: 1, short: "Mon", long: "Monday" },
  { day: 2, short: "Tue", long: "Tuesday" },
  { day: 3, short: "Wed", long: "Wednesday" },
  { day: 4, short: "Thu", long: "Thursday" },
  { day: 5, short: "Fri", long: "Friday" },
  { day: 6, short: "Sat", long: "Saturday" },
  { day: 0, short: "Sun", long: "Sunday" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const ERROR_START_PAST = "Start date can't be in the past.";
export const ERROR_END_BEFORE_START = "End date must be on or after the start date.";
export const ERROR_END_PAST = "End date can't be in the past.";
export const ERROR_NO_DAYS = "Pick at least one day.";
export const ERROR_NO_START = "Enter a start date.";

export type ScheduleErrors = { start?: string; end?: string; days?: string };

/** The device's local date as "YYYY-MM-DD". */
export function toLocalDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True for a real calendar date written as "YYYY-MM-DD". */
export function isLocalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Parse a stored frequency. Returns null when malformed. */
export function parseFrequency(value: unknown): Frequency | null {
  if (typeof value !== "object" || value === null) return null;
  const { type, days } = value as Record<string, unknown>;
  if (type === "daily") return { type: "daily" };
  if (type !== "weekdays" || !Array.isArray(days) || days.length === 0) return null;
  if (!days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return null;
  return { type: "weekdays", days: [...new Set(days as number[])].sort((a, b) => a - b) };
}

/**
 * Validate a schedule. A new habit (`previous` undefined) must start today or later. When editing,
 * the start date is checked only if it changed, and a changed end date must be today or later.
 * The end date must always be on or after the start date.
 */
export function validateSchedule(
  schedule: Schedule,
  today: string,
  previous?: Schedule,
): ScheduleErrors {
  const errors: ScheduleErrors = {};
  const { frequency, startDate, endDate } = schedule;
  if (frequency.type === "weekdays" && frequency.days.length === 0) errors.days = ERROR_NO_DAYS;
  if (!isLocalDate(startDate)) errors.start = ERROR_NO_START;
  else if ((!previous || startDate !== previous.startDate) && startDate < today) {
    errors.start = ERROR_START_PAST;
  }
  if (endDate) {
    if (isLocalDate(startDate) && endDate < startDate) errors.end = ERROR_END_BEFORE_START;
    else if (previous && endDate !== previous.endDate && endDate < today) {
      errors.end = ERROR_END_PAST;
    }
  }
  return errors;
}

export function hasErrors(errors: ScheduleErrors): boolean {
  return Boolean(errors.start || errors.end || errors.days);
}

/** "12 Nov" for "2026-11-12". */
export function formatDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Daily · from 12 Nov" or "Mon, Wed, Fri · 12 Nov – 12 Dec". */
export function summarize(schedule: Schedule): string {
  const { frequency, startDate, endDate } = schedule;
  const freq =
    frequency.type === "daily"
      ? "Daily"
      : WEEKDAYS.filter((w) => frequency.days.includes(w.day))
          .map((w) => w.short)
          .join(", ");
  const dates = endDate
    ? `${formatDate(startDate)} – ${formatDate(endDate)}`
    : `from ${formatDate(startDate)}`;
  return `${freq} · ${dates}`;
}

/** The habit has an end date before today's local date. */
export function hasEnded(schedule: Schedule, today: string): boolean {
  return schedule.endDate !== undefined && schedule.endDate < today;
}
