import { describe, expect, it } from "vitest";
import {
  addHabit,
  parseHabits,
  removeHabit,
  updateHabit,
  validateName,
  type Habit,
} from "./habits";
import { DEFAULT_ICON_EMOJI, ICON_CATALOG, iconEmoji } from "./icons";

const read: Habit = { id: "1", name: "Read", createdAt: "2026-01-01T00:00:00.000Z" };

describe("validateName", () => {
  it("AC3 (#1): empty and whitespace-only names are rejected", () => {
    expect(validateName("", [])).toBe("Enter a habit name.");
    expect(validateName("   ", [])).toBe("Enter a habit name.");
  });
  it("AC3 (#1): names over 60 characters are rejected", () => {
    expect(validateName("a".repeat(61), [])).toBe("Name must be 60 characters or fewer.");
    expect(validateName("a".repeat(60), [])).toBeNull();
  });
  it("AC4 (#1): the limit counts emoji as one character", () => {
    expect(validateName("😀".repeat(60), [])).toBeNull();
    expect(validateName("😀".repeat(61), [])).toBe("Name must be 60 characters or fewer.");
  });
  it("AC5 (#1): duplicates are found after trimming and case-folding", () => {
    expect(validateName(" read ", [read])).toBe("You already have this habit.");
  });
  it("AC7 (#1): the habit being edited is ignored in the duplicate check", () => {
    expect(validateName(" READ ", [read], "1")).toBeNull();
  });
});

describe("parseHabits", () => {
  it("AC12 (#1): habits without an icon key are valid", () => {
    expect(parseHabits([read])).toEqual([read]);
  });
  it("AC13 (#1): an unknown icon is dropped, not an error", () => {
    expect(parseHabits([{ ...read, icon: "nope" }])).toEqual([read]);
    expect(parseHabits([{ ...read, icon: "water" }])?.[0].icon).toBe("water");
  });
  it("AC14 (#1): malformed entries make the whole value corrupted", () => {
    expect(parseHabits([{ name: "x" }])).toBeNull();
    expect(parseHabits([{ id: "1" }])).toBeNull();
    expect(parseHabits([{ id: "1", name: "a".repeat(61) }])).toBeNull();
    expect(parseHabits({})).toBeNull();
    expect(parseHabits([read, null])).toBeNull();
  });
  it("AC12 (#1): a missing value is an empty list", () => {
    expect(parseHabits(null)).toEqual([]);
  });
});

describe("list updates", () => {
  it("AC1 (#1): addHabit appends with trimmed name and icon", () => {
    const list = addHabit([read], " Run ", "run", new Date("2026-02-01T00:00:00Z"));
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({
      name: "Run",
      icon: "run",
      createdAt: "2026-02-01T00:00:00.000Z",
    });
  });
  it("AC2 (#1): addHabit without an icon stores no icon key", () => {
    expect("icon" in addHabit([], "Run", undefined)[0]).toBe(false);
  });
  it("AC6 (#1): updateHabit keeps id, createdAt and position", () => {
    const b: Habit = { id: "2", name: "B", createdAt: "x" };
    const list = updateHabit([read, b], "1", " Reading ", "book");
    expect(list[0]).toEqual({ id: "1", name: "Reading", createdAt: read.createdAt, icon: "book" });
    expect(list[1]).toBe(b);
  });
  it("AC6 (#1): updateHabit can clear the icon", () => {
    const list = updateHabit([{ ...read, icon: "book" }], "1", "Read", undefined);
    expect("icon" in list[0]).toBe(false);
  });
  it("AC11 (#1): removeHabit removes only that habit", () => {
    expect(removeHabit([read, { ...read, id: "2" }], "1").map((h) => h.id)).toEqual(["2"]);
  });
});

describe("icon catalog", () => {
  it("AC17 (#1): has 24 options, each with a text label and a unique id", () => {
    expect(ICON_CATALOG).toHaveLength(24);
    expect(ICON_CATALOG.every((i) => i.label.length > 0)).toBe(true);
    expect(new Set(ICON_CATALOG.map((i) => i.id)).size).toBe(24);
  });
  it("AC2 (#1): missing or unknown ids give the default icon", () => {
    expect(iconEmoji(undefined)).toBe(DEFAULT_ICON_EMOJI);
    expect(iconEmoji("nope")).toBe(DEFAULT_ICON_EMOJI);
  });
});
