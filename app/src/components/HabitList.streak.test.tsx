import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitList } from "./HabitList";
import { CHECKINS_KEY, HABITS_KEY } from "@/lib/storage";

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
const seed = (habits: unknown, checkins?: unknown) => {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  if (checkins !== undefined) localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkins));
};
const row = (name: string) => within(screen.getByRole("listitem", { name }));

describe("HabitList streaks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#3) AC17 (#3): the row shows an icon and '3-day streak'", () => {
    seed([habit("1", "Run")], ci("2026-10-30", "2026-10-31", "2026-11-01"));
    render(<HabitList />);
    expect(row("Run").getByText("3-day streak")).toBeInTheDocument();
    expect(row("Run").getByText("🔥")).toHaveAttribute("aria-hidden", "true");
  });

  it("AC2 (#3): checking today updates 3 to 4 without a reload", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")], ci("2026-10-29", "2026-10-30", "2026-10-31"));
    render(<HabitList />);
    expect(row("Run").getByText("3-day streak")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Done today: Run" }));
    expect(row("Run").getByText("4-day streak")).toBeInTheDocument();
  });

  it("AC3 (#3): a missed past day cuts the streak", () => {
    seed([habit("1", "Run")], ci("2026-10-28", "2026-10-30", "2026-10-31"));
    render(<HabitList />);
    expect(row("Run").getByText("2-day streak")).toBeInTheDocument();
  });

  it("AC4 (#3): a streak of 1 is singular", () => {
    seed([habit("1", "Run")], ci("2026-10-31"));
    render(<HabitList />);
    expect(row("Run").getByText("1-day streak")).toBeInTheDocument();
  });

  it("AC5 (#3): Mon/Wed/Fri habit shows its streak on a Tuesday", () => {
    vi.setSystemTime(new Date(2026, 9, 27, 12)); // Tue 27 Oct
    seed(
      [habit("1", "Run", { frequency: { type: "weekdays", days: [1, 3, 5] } })],
      ci("2026-10-26", "2026-10-23", "2026-10-21"),
    );
    render(<HabitList />);
    expect(row("Run").getByText("3-day streak")).toBeInTheDocument();
  });

  it("AC6 (#3): Mon/Wed/Fri habit that missed Wednesday counts only later days", () => {
    seed(
      [habit("1", "Run", { frequency: { type: "weekdays", days: [1, 3, 5] } })],
      ci("2026-10-30", "2026-10-26"),
    );
    render(<HabitList />);
    expect(row("Run").getByText("1-day streak")).toBeInTheDocument();
  });

  it("AC7 (#3) AC20 (#3): an unscheduled check-in adds nothing but the week still shows it done", () => {
    seed(
      [habit("1", "Run", { frequency: { type: "weekdays", days: [1, 3, 5] } })],
      ci("2026-10-30", "2026-10-29", "2026-10-28"),
    );
    render(<HabitList />);
    expect(row("Run").getByText("2-day streak")).toBeInTheDocument();
    const week = within(screen.getByRole("region", { name: "Week" }));
    expect(week.getByRole("cell", { name: "Run, Thu 29: done" })).toBeInTheDocument();
    expect(week.queryByText(/streak/)).not.toBeInTheDocument();
  });

  it("AC8 (#3): no check-ins shows 'No streak yet'", () => {
    seed([habit("1", "Run")]);
    render(<HabitList />);
    expect(row("Run").getByText("No streak yet")).toBeInTheDocument();
  });

  it("AC9 (#3): a habit starting in the future shows no streak", () => {
    seed([habit("1", "Run", { startDate: "2026-11-05" })], ci("2026-10-31", "2026-11-01"));
    render(<HabitList />);
    expect(row("Run").getByText("No streak yet")).toBeInTheDocument();
  });

  it("AC10 (#3): an ended habit shows its final streak and an Ended label", () => {
    seed(
      [habit("1", "Run", { endDate: "2026-10-29" })],
      ci("2026-10-27", "2026-10-28", "2026-10-29", "2026-10-31"),
    );
    render(<HabitList />);
    expect(row("Run").getByText("3-day streak")).toBeInTheDocument();
    expect(row("Run").getByText("Ended")).toBeInTheDocument();
  });

  it("AC11 (#3) AC14 (#3): storage is unchanged by showing streaks", () => {
    seed([habit("1", "Run")], ci("2026-10-31"));
    const before = [localStorage.getItem(HABITS_KEY), localStorage.getItem(CHECKINS_KEY)];
    render(<HabitList />);
    expect(row("Run").getByText("1-day streak")).toBeInTheDocument();
    expect([localStorage.getItem(HABITS_KEY), localStorage.getItem(CHECKINS_KEY)]).toEqual(before);
    // The only new key is badges:v1 (First Step is awarded from the existing check-in, #24).
    expect(localStorage.length).toBe(3);
  });

  it("AC12 (#3): a legacy habit without frequency or dates counts as Daily from createdAt", () => {
    const legacy = { id: "1", name: "Run", createdAt: new Date(2026, 9, 30, 12).toISOString() };
    seed([legacy], ci("2026-10-29", "2026-10-30", "2026-10-31"));
    render(<HabitList />);
    expect(row("Run").getByText("2-day streak")).toBeInTheDocument();
  });

  it("AC13 (#3): a long history counts back to the start date", () => {
    const dates: string[] = [];
    for (let i = 1; i <= 300; i++) {
      const d = new Date(2026, 10, 1 - i);
      dates.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
    seed([habit("1", "Run", { startDate: "2025-01-01" })], ci(...dates));
    render(<HabitList />);
    expect(row("Run").getByText("300-day streak")).toBeInTheDocument();
  });

  it("AC15 (#3): the row's accessible text includes 'Run: 3-day streak'", () => {
    seed([habit("1", "Run")], ci("2026-10-30", "2026-10-31", "2026-11-01"));
    render(<HabitList />);
    expect(screen.getByRole("listitem", { name: "Run" })).toHaveTextContent("Run: 3-day streak");
  });

  it("AC16 (#3): the streak text wraps and cannot overflow a narrow row", () => {
    seed([habit("1", "Run")], ci("2026-10-31"));
    render(<HabitList />);
    // jsdom has no layout: the wrapping rules live in the CSS module class on the element.
    expect(row("Run").getByText("1-day streak").parentElement?.className).toMatch(/streak/);
  });

  it("AC18 (#3): streaks refresh for the new date on the next interaction", () => {
    seed([habit("1", "Run")], ci("2026-10-30", "2026-10-31", "2026-11-01"));
    render(<HabitList />);
    expect(row("Run").getByText("3-day streak")).toBeInTheDocument();
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 3, 12)); // Nov 2 was missed
    });
    fireEvent.pointerDown(document.body);
    expect(row("Run").getByText("No streak yet")).toBeInTheDocument();
  });

  it("AC19 (#3): corrupted check-ins show the existing error and no streaks", () => {
    seed([habit("1", "Run")]);
    localStorage.setItem(CHECKINS_KEY, "{not json");
    render(<HabitList />);
    expect(screen.getByRole("alert")).toHaveTextContent("check-ins could not be loaded");
    expect(row("Run").queryByText(/streak/)).not.toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Run" })).toBeInTheDocument();
  });
});
