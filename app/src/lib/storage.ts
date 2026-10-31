/** Client-only localStorage helper: reads and writes JSON under a key and never throws. */

export const HABITS_KEY = "habits:v1";

export type StorageFailureReason = "unavailable" | "corrupted";

export type StorageResult<T> =
  { ok: true; value: T | null } | { ok: false; reason: StorageFailureReason };

/** Read the JSON value under `key`. A missing key is a success with `value: null`. */
export function readJson<T = unknown>(key: string): StorageResult<T> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (raw === null) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false, reason: "corrupted" };
  }
}

/** Write `value` as JSON under `key`. Fails when storage is blocked or full. */
export function writeJson(key: string, value: unknown): StorageResult<true> {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true, value: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
