/** Habit domain logic: validation, parsing stored data and list updates. Pure, no React. */
import { findIcon } from "./icons";

export type Habit = {
  id: string;
  name: string;
  createdAt: string;
  icon?: string;
};

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
 * entry has no id or name, or a name over 60 characters). A missing or unknown icon is not an error.
 */
export function parseHabits(value: unknown): Habit[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const habits: Habit[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { id, name, createdAt, icon } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id === "") return null;
    if (typeof name !== "string" || name.trim() === "") return null;
    if (nameLength(name.trim()) > MAX_NAME_LENGTH) return null;
    const habit: Habit = {
      id,
      name: name.trim(),
      createdAt: typeof createdAt === "string" ? createdAt : new Date(0).toISOString(),
    };
    if (typeof icon === "string" && findIcon(icon)) habit.icon = icon;
    habits.push(habit);
  }
  return habits;
}

export function addHabit(
  habits: readonly Habit[],
  name: string,
  icon: string | undefined,
  now: Date = new Date(),
): Habit[] {
  const habit: Habit = { id: createId(), name: name.trim(), createdAt: now.toISOString() };
  if (icon) habit.icon = icon;
  return [...habits, habit];
}

/** Change name and icon only; id, createdAt and position stay as they are. */
export function updateHabit(
  habits: readonly Habit[],
  id: string,
  name: string,
  icon: string | undefined,
): Habit[] {
  return habits.map((h) => {
    if (h.id !== id) return h;
    const updated: Habit = { id: h.id, name: name.trim(), createdAt: h.createdAt };
    if (icon) updated.icon = icon;
    return updated;
  });
}

export function removeHabit(habits: readonly Habit[], id: string): Habit[] {
  return habits.filter((h) => h.id !== id);
}
