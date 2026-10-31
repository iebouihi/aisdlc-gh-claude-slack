/** Habit domain logic: validation, parsing stored data and list updates. Pure, no React. */
import { findIcon } from "./icons";
import {
  isLocalDate,
  parseFrequency,
  toLocalDate,
  type Frequency,
  type Schedule,
} from "./schedule";

export type Habit = {
  id: string;
  name: string;
  createdAt: string;
  icon?: string;
  frequency: Frequency;
  /** Local date "YYYY-MM-DD". */
  startDate: string;
  /** Local date "YYYY-MM-DD"; missing means the habit never ends. */
  endDate?: string;
};

const DAILY: Frequency = { type: "daily" };

export const MAX_NAME_LENGTH = 60;
export const ERROR_EMPTY = "Enter a habit name.";
export const ERROR_TOO_LONG = "Name must be 60 characters or fewer.";
export const ERROR_DUPLICATE = "You already have this habit.";

/** Length in Unicode characters (code points), so an emoji counts as 1. */
export function nameLength(name: string): number {
  return Array.from(name).length;
}

function fold(name: string): string {
  return name.trim().toLowerCase();
}

/** Returns an error message, or null when `name` is valid. `editingId` is ignored in the duplicate check. */
export function validateName(
  name: string,
  habits: readonly Habit[],
  editingId?: string,
): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return ERROR_EMPTY;
  if (nameLength(trimmed) > MAX_NAME_LENGTH) return ERROR_TOO_LONG;
  const folded = fold(trimmed);
  if (habits.some((h) => h.id !== editingId && fold(h.name) === folded)) {
    return ERROR_DUPLICATE;
  }
  return null;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Turn a stored value into habits. Returns null when the value is corrupted (not an array, or an
 * entry has no id or name, a name over 60 characters, or a present but malformed frequency,
 * startDate or endDate). A missing icon, frequency or startDate is not an error: a legacy habit
 * becomes Daily from its createdAt (local) date.
 */
export function parseHabits(value: unknown): Habit[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const habits: Habit[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { id, name, createdAt, icon, frequency, startDate, endDate } = entry as Record<
      string,
      unknown
    >;
    if (typeof id !== "string" || id === "") return null;
    if (typeof name !== "string" || name.trim() === "") return null;
    if (nameLength(name.trim()) > MAX_NAME_LENGTH) return null;
    const created = typeof createdAt === "string" ? createdAt : new Date(0).toISOString();
    const parsedFrequency = frequency === undefined ? DAILY : parseFrequency(frequency);
    if (parsedFrequency === null) return null;
    if (startDate !== undefined && !isLocalDate(startDate)) return null;
    if (endDate !== undefined && !isLocalDate(endDate)) return null;
    const createdDate = new Date(created);
    const habit: Habit = {
      id,
      name: name.trim(),
      createdAt: created,
      frequency: parsedFrequency,
      startDate:
        startDate ?? toLocalDate(Number.isNaN(createdDate.getTime()) ? new Date(0) : createdDate),
    };
    if (endDate !== undefined) habit.endDate = endDate;
    if (typeof icon === "string" && findIcon(icon)) habit.icon = icon;
    habits.push(habit);
  }
  return habits;
}

function applySchedule(habit: Habit, schedule: Schedule): Habit {
  const next: Habit = { ...habit, frequency: schedule.frequency, startDate: schedule.startDate };
  delete next.endDate;
  if (schedule.endDate) next.endDate = schedule.endDate;
  return next;
}

/** Without a schedule the habit is Daily from today (local date of `now`), with no end. */
export function addHabit(
  habits: readonly Habit[],
  name: string,
  icon: string | undefined,
  now: Date = new Date(),
  schedule: Schedule = { frequency: DAILY, startDate: toLocalDate(now) },
): Habit[] {
  const habit = applySchedule(
    { id: createId(), name: name.trim(), createdAt: now.toISOString() } as Habit,
    schedule,
  );
  if (icon) habit.icon = icon;
  return [...habits, habit];
}

/** Change name, icon and (optionally) schedule; id, createdAt and position stay as they are. */
export function updateHabit(
  habits: readonly Habit[],
  id: string,
  name: string,
  icon: string | undefined,
  schedule?: Schedule,
): Habit[] {
  return habits.map((h) => {
    if (h.id !== id) return h;
    const updated: Habit = { ...h, name: name.trim() };
    delete updated.icon;
    if (icon) updated.icon = icon;
    return schedule ? applySchedule(updated, schedule) : updated;
  });
}

export function removeHabit(habits: readonly Habit[], id: string): Habit[] {
  return habits.filter((h) => h.id !== id);
}
