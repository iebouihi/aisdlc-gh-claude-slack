import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitList } from "./HabitList";
import { BADGES_KEY, CHECKINS_KEY, HABITS_KEY } from "@/lib/storage";

// Sunday 1 Nov 2026, local time.
const NOW = new Date(2026, 10, 1, 12);
const habit = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  createdAt: new Date(2026, 0, 5, 12).toISOString(),
  frequency: { type: "daily" },
  startDate: "2026-01-05",
  ...extra,
});
const ci = (...dates: string[]) => dates.map((date) => ({ habitId: "1", date }));
const seed = (habits: unknown, checkins?: unknown, badges?: unknown) => {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  if (checkins !== undefined) localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkins));
  if (badges !== undefined) localStorage.setItem(BADGES_KEY, JSON.stringify(badges));
};
const badge = (name: string) => within(screen.getByRole("group", { name }));
const stored = () => JSON.parse(localStorage.getItem(BADGES_KEY) ?? "null");

describe("HabitList badges", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#24) AC2 (#24) AC16 (#24): 5 locked badges with logo, name, state and rule as text", () => {
    render(<HabitList />);
    const section = within(screen.getByRole("region", { name: "Badges" }));
    const names = BADGE_NAMES.map((n) => section.getByText(n).textContent);
    expect(names).toEqual(BADGE_NAMES);
    expect(section.getAllByText("Locked")).toHaveLength(5);
    expect(section.getByText("Reach a 7-day streak")).toBeInTheDocument();
    expect(section.getByText("👣")).toHaveAttribute("aria-hidden", "true");
    expect(stored()).toBeNull();
  });

  it("AC3 (#24) AC11 (#24): the first check-in earns First Step with today's date and a New label", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")], []);
    render(<HabitList />);
    await user.click(screen.getByRole("checkbox", { name: "Done today: Run" }));
    expect(badge("First Step").getByText("Earned on 1 Nov")).toBeInTheDocument();
    expect(badge("First Step").getByText("New")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(stored()).toEqual([{ badgeId: "first-step", earnedAt: "2026-11-01" }]);
  });

  it("AC4 (#24): checking the 3rd day earns Steady 3", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")], ci("2026-10-30", "2026-10-31"), []);
    render(<HabitList />);
    expect(badge("Steady 3").getByText("Locked")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Done today: Run" }));
    expect(badge("Steady 3").getByText("Earned on 1 Nov")).toBeInTheDocument();
  });

  it("AC7 (#24) AC9 (#24): unchecking or deleting keeps the badge and its date", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")], [], []);
    render(<HabitList />);
    const box = screen.getByRole("checkbox", { name: "Done today: Run" });
    await user.click(box);
    await user.click(box);
    expect(badge("First Step").getByText("Earned on 1 Nov")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Habits" }));
    await user.click(screen.getByRole("button", { name: "Delete Run" }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(badge("First Step").getByText("Earned on 1 Nov")).toBeInTheDocument();
    expect(stored()).toEqual([{ badgeId: "first-step", earnedAt: "2026-11-01" }]);
  });

  it("AC8 (#24): an ended habit's past streak is awarded on load", () => {
    seed(
      [habit("1", "Run", { endDate: "2026-10-12" })],
      ci("2026-10-10", "2026-10-11", "2026-10-12"),
    );
    render(<HabitList />);
    expect(badge("Steady 3").getByText("Earned on 1 Nov")).toBeInTheDocument();
  });

  it("AC10 (#24) AC12 (#24): earned badges are read from badges:v1 and have no New label on reload", () => {
    seed([habit("1", "Run")], [], [{ badgeId: "steady-3", earnedAt: "2026-10-05" }]);
    render(<HabitList />);
    expect(badge("Steady 3").getByText("Earned on 5 Oct")).toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();
    expect(stored()).toEqual([{ badgeId: "steady-3", earnedAt: "2026-10-05" }]);
  });

  it("AC13 (#24): corrupted badges show an alert, all Locked, and are not overwritten on load", () => {
    seed([habit("1", "Run")], ci("2026-10-30", "2026-10-31", "2026-11-01"));
    localStorage.setItem(BADGES_KEY, "{not json");
    render(<HabitList />);
    expect(screen.getByRole("alert")).toHaveTextContent("badges could not be loaded");
    expect(screen.getAllByText("Locked")).toHaveLength(5);
    expect(localStorage.getItem(BADGES_KEY)).toBe("{not json");
  });

  it("AC13 (#24): unavailable storage does not crash and shows all Locked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<HabitList />);
    expect(screen.getAllByText("Locked")).toHaveLength(5);
  });

  it("AC14 (#24): existing habits and check-ins are read unchanged", () => {
    const habits = [habit("1", "Run")];
    const checkins = ci("2026-10-31");
    seed(habits, checkins);
    render(<HabitList />);
    expect(JSON.parse(localStorage.getItem(HABITS_KEY)!)).toEqual(habits);
    expect(JSON.parse(localStorage.getItem(CHECKINS_KEY)!)).toEqual(checkins);
  });

  it("AC17 (#24): the weekly overview is still shown", () => {
    seed([habit("1", "Run")], []);
    render(<HabitList />);
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByRole("heading", { name: "Week" })).toBeInTheDocument();
  });
});

const BADGE_NAMES = [
  "First Step",
  "Steady 3",
  "Week Warrior",
  "Fortnight Focus",
  "Iron Discipline",
];
