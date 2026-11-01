import { describe, expect, it } from "vitest";
import { latestBadge, parseProfile, validateProfileName, welcomeText } from "./profile";

describe("profile domain", () => {
  it("AC2 (#30): the name is trimmed", () => {
    expect(validateProfileName("  Sam ")).toEqual({ name: "Sam", error: null });
  });
  it("AC3 (#30): 30 characters are valid", () => {
    expect(validateProfileName("a".repeat(30)).error).toBeNull();
  });
  it("AC4 (#30): 31 characters are an error", () => {
    expect(validateProfileName("a".repeat(31)).error).not.toBeNull();
  });
  it("AC7 (#30): an empty name clears", () => {
    expect(validateProfileName("   ")).toEqual({ name: "", error: null });
  });
  it("AC1 (#30): welcome without a name", () => {
    expect(welcomeText("")).toBe("Welcome");
    expect(welcomeText("Sam")).toBe("Welcome, Sam");
  });
  it("AC13 (#30): parseProfile flags a malformed value as corrupted", () => {
    expect(parseProfile(null)).toBe("");
    expect(parseProfile({ name: "Sam" })).toBe("Sam");
    expect(parseProfile([])).toBeNull();
    expect(parseProfile({ name: 3 })).toBeNull();
    expect(parseProfile({ name: "a".repeat(31) })).toBeNull();
  });
  it("AC9 (#30): the latest earned date wins", () => {
    const badge = latestBadge([
      { badgeId: "steady-3", earnedAt: "2026-10-03" },
      { badgeId: "first-step", earnedAt: "2026-10-01" },
    ]);
    expect(badge?.name).toBe("Steady 3");
  });
  it("AC10 (#30): on a tie the later badge in the order wins", () => {
    const badge = latestBadge([
      { badgeId: "week-warrior", earnedAt: "2026-10-03" },
      { badgeId: "first-step", earnedAt: "2026-10-03" },
      { badgeId: "steady-3", earnedAt: "2026-10-03" },
    ]);
    expect(badge?.name).toBe("Week Warrior");
  });
  it("AC11 (#30): no badge earned means none", () => {
    expect(latestBadge([])).toBeNull();
  });
});
