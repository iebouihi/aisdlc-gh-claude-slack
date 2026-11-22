import { describe, expect, it } from "vitest";
import { STARTER_HABITS, isFirstRun, starterHabits } from "./firstRun";
import { findIcon } from "./icons";

const missing = { ok: true, value: null } as const;

describe("first-run rules (#67)", () => {
  it("AC2 (#67): offers exactly the 10 habits of the decision, in order, with catalog icons", () => {
    expect(STARTER_HABITS.map((h) => h.name)).toEqual([
      "Drink water",
      "Walk",
      "Read",
      "Meditate",
      "Sleep early",
      "Stretch",
      "Journal",
      "Exercise",
      "Healthy meal",
      "No phone before bed",
    ]);
    expect(new Set(STARTER_HABITS.map((h) => h.id)).size).toBe(10);
    for (const h of STARTER_HABITS) expect(findIcon(h.icon)).toBeDefined();
  });

  it("AC1 (#67): all keys readable and missing is a first run", () => {
    expect(isFirstRun([missing, missing, missing, missing])).toBe(true);
  });

  it("AC8 (#67) AC9 (#67): any present key means no setup", () => {
    for (let i = 0; i < 4; i++) {
      const results = [missing, missing, missing, missing].map((r, j) =>
        j === i ? { ok: true as const, value: [] } : r,
      );
      expect(isFirstRun(results)).toBe(false);
    }
  });

  it("AC10 (#67): a corrupted or unavailable read means no setup", () => {
    expect(isFirstRun([missing, { ok: false, reason: "corrupted" }, missing, missing])).toBe(false);
    expect(isFirstRun([{ ok: false, reason: "unavailable" }, missing, missing, missing])).toBe(
      false,
    );
  });

  it("AC4 (#67): selected starters become Daily habits from today, in list order", () => {
    const now = new Date(2026, 10, 22, 9);
    const habits = starterHabits([], ["read", "drink-water", "walk"], now);
    expect(habits.map((h) => h.name)).toEqual(["Drink water", "Walk", "Read"]);
    expect(habits.map((h) => h.icon)).toEqual(["water", "walk", "book"]);
    for (const h of habits) {
      expect(h.frequency).toEqual({ type: "daily" });
      expect(h.startDate).toBe("2026-11-22");
      expect(h).not.toHaveProperty("endDate");
      expect(h).not.toHaveProperty("cost");
      expect(h).not.toHaveProperty("budget");
    }
  });
});
