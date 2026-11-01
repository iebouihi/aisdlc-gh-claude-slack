/** User profile: an optional personal name and the latest earned badge. Pure, no React. */
import { BADGES, type Badge, type EarnedBadge } from "./badges";

export const MAX_NAME_LENGTH = 30;
export const NAME_TOO_LONG_TEXT = `Use at most ${MAX_NAME_LENGTH} characters for your name.`;

/** Result of checking a typed name: the trimmed name ("" clears it) or an error text. */
export type NameCheck = { name: string; error: null } | { name: null; error: string };

/** Trim the name; empty clears it, more than 30 characters is an error. Any text is allowed. */
export function validateProfileName(input: string): NameCheck {
  const name = input.trim();
  if (name.length > MAX_NAME_LENGTH) return { name: null, error: NAME_TOO_LONG_TEXT };
  return { name, error: null };
}

/**
 * Turn a stored value into a name ("" = none). Returns null when corrupted: anything but
 * nothing or an object whose `name` is a string of at most 30 characters after trimming.
 */
export function parseProfile(value: unknown): string | null {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const { name } = value as Record<string, unknown>;
  if (name === undefined) return "";
  if (typeof name !== "string") return null;
  const checked = validateProfileName(name);
  return checked.error === null ? checked.name : null;
}

/** "Welcome, <name>", or "Welcome" without a name. */
export function welcomeText(name: string): string {
  return name ? `Welcome, ${name}` : "Welcome";
}

/**
 * The badge with the latest earned date; on a tie, the one furthest along the badge order.
 * Null when none is earned.
 */
export function latestBadge(earned: readonly EarnedBadge[]): Badge | null {
  let best: { badge: Badge; date: string; index: number } | null = null;
  for (const entry of earned) {
    const index = BADGES.findIndex((b) => b.id === entry.badgeId);
    if (index < 0) continue;
    if (
      !best ||
      entry.earnedAt > best.date ||
      (entry.earnedAt === best.date && index > best.index)
    ) {
      best = { badge: BADGES[index], date: entry.earnedAt, index };
    }
  }
  return best ? best.badge : null;
}
