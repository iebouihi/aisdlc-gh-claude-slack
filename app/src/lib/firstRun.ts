/** First-run setup: the fixed starter habits and the rules around them. Pure, no React. */
import { addHabit, type Habit } from "./habits";
import type { StorageResult } from "./storage";

export type StarterHabit = { id: string; name: string; icon: string };

/** The 10 common habits offered once, in this order (icons are catalog ids). */
export const STARTER_HABITS: readonly StarterHabit[] = [
  { id: "drink-water", name: "Drink water", icon: "water" },
  { id: "walk", name: "Walk", icon: "walk" },
  { id: "read", name: "Read", icon: "book" },
  { id: "meditate", name: "Meditate", icon: "meditate" },
  { id: "sleep-early", name: "Sleep early", icon: "sleep" },
  { id: "stretch", name: "Stretch", icon: "stretch" },
  { id: "journal", name: "Journal", icon: "write" },
  { id: "exercise", name: "Exercise", icon: "workout" },
  { id: "healthy-meal", name: "Healthy meal", icon: "salad" },
  { id: "no-phone-before-bed", name: "No phone before bed", icon: "phone" },
];

/**
 * First run = every given key was read fine and is missing. A present key (any value) or a
 * failed read (corrupted, unavailable) means no setup.
 */
export function isFirstRun(results: readonly StorageResult<unknown>[]): boolean {
  return results.every((r) => r.ok && r.value === null);
}

/** Add each selected starter, in list order, as a normal Daily habit starting today. */
export function starterHabits(
  habits: readonly Habit[],
  selectedIds: readonly string[],
  now: Date = new Date(),
): Habit[] {
  let next = [...habits];
  for (const starter of STARTER_HABITS) {
    if (!selectedIds.includes(starter.id)) continue;
    next = addHabit(next, starter.name, starter.icon, now);
  }
  return next;
}
