import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goTo, renderView } from "./test-utils";
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
const seed = (habits: unknown, checkins?: unknown) => {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  if (checkins !== undefined) localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkins));
};
const week = () => within(screen.getByRole("region", { name: "Week" }));
const cell = (label: string) => week().getByRole("cell", { name: label });

describe("HabitList weekly overview", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#4): the Week overview is its own view on the home page, next to Today", () => {
    seed([habit("1", "Run")]);
    renderView("Today");
    expect(screen.getByRole("listitem", { name: "Run" })).toBeInTheDocument();
    goTo("Week");
    expect(screen.getByRole("heading", { name: "Week" })).toBeInTheDocument();
  });

  it("AC2 (#4): 7 headed columns 26 Oct to 1 Nov with today marked", () => {
    seed([habit("1", "Run")]);
    renderView("Week");
    const heads = week().getAllByRole("columnheader").slice(1);
    expect(heads.map((h) => h.textContent)).toEqual([
      "Mon 26",
      "Tue 27",
      "Wed 28",
      "Thu 29",
      "Fri 30",
      "Sat 31",
      "Sun 1Today",
    ]);
    expect(heads[6]).toHaveAttribute("aria-current", "date");
  });

  it("AC3 (#4) AC4 (#4) AC7 (#4) AC17 (#4): done, missed and not-done-yet cells have labels and icons", () => {
    seed([habit("1", "Run")], [{ habitId: "1", date: "2026-10-27" }]);
    renderView("Week");
    expect(cell("Run, Tue 27: done")).toHaveTextContent("✓");
    expect(cell("Run, Wed 28: missed")).toHaveTextContent("✗");
    expect(cell("Run, Sun 1: not done yet")).toHaveTextContent("○");
    expect(week().queryByRole("cell", { name: "Run, Sun 1: missed" })).not.toBeInTheDocument();
  });

  it("AC5 (#4): an unchecked Tuesday of a Mon/Wed/Fri habit is not scheduled", () => {
    seed([habit("1", "Gym", { frequency: { type: "weekdays", days: [1, 3, 5] } })]);
    renderView("Week");
    expect(cell("Gym, Tue 27: not scheduled")).toBeInTheDocument();
  });

  it("AC6 (#4): days outside start and end dates are not active", () => {
    seed([habit("1", "Run", { startDate: "2026-10-28", endDate: "2026-10-30" })]);
    renderView("Week");
    expect(cell("Run, Tue 27: not active")).toBeInTheDocument();
    expect(cell("Run, Wed 28: missed")).toBeInTheDocument();
    expect(cell("Run, Sat 31: not active")).toBeInTheDocument();
  });

  it("AC8 (#4) AC22 (#4): an unscheduled check-in shows done and storage is untouched", () => {
    const checkins = [{ habitId: "1", date: "2026-10-27" }];
    seed([habit("1", "Gym", { frequency: { type: "weekdays", days: [1] } })], checkins);
    const keysBefore = Object.keys(localStorage).sort();
    renderView("Week");
    expect(cell("Gym, Tue 27: done")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CHECKINS_KEY)!)).toEqual(checkins);
    expect(Object.keys(localStorage).sort()).toEqual(keysBefore);
  });

  it("AC9 (#4) AC10 (#4): creation order; hides habits outside the window", () => {
    seed([
      habit("1", "A"),
      habit("2", "B", { endDate: "2026-10-26" }),
      habit("3", "Old", { endDate: "2026-10-25" }),
      habit("4", "Future", { startDate: "2026-11-02" }),
      habit("5", "C"),
    ]);
    renderView("Week");
    const names = week()
      .getAllByRole("rowheader")
      .map((h) => h.textContent);
    expect(names).toHaveLength(3);
    expect(names[0]).toContain("A");
    expect(names[1]).toContain("B");
    expect(names[2]).toContain("C");
  });

  it("AC11 (#4): a legacy habit counts as Daily from its createdAt date", () => {
    seed([{ id: "1", name: "Old", createdAt: new Date(2026, 9, 28, 12).toISOString() }]);
    renderView("Week");
    expect(cell("Old, Tue 27: not active")).toBeInTheDocument();
    expect(cell("Old, Wed 28: missed")).toBeInTheDocument();
    expect(week().getByText("0 of 5 scheduled days done")).toBeInTheDocument();
  });

  it("AC12 (#4): shows x of y scheduled days done", () => {
    seed(
      [habit("1", "Run", { startDate: "2026-10-28" })],
      ["2026-10-28", "2026-10-29", "2026-11-01"].map((date) => ({ habitId: "1", date })),
    );
    renderView("Week");
    expect(week().getByText("3 of 5 scheduled days done")).toBeInTheDocument();
  });

  it("AC13 (#4): no scheduled days shows 'No scheduled days'", () => {
    seed([
      habit("1", "Gym", {
        frequency: { type: "weekdays", days: [2] },
        startDate: "2026-10-28",
        endDate: "2026-10-29",
      }),
    ]);
    renderView("Week");
    expect(week().getByText("No scheduled days")).toBeInTheDocument();
  });

  it("AC14 (#4): clicking a cell changes nothing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")], []);
    renderView("Week");
    await user.click(cell("Run, Sun 1: not done yet"));
    await user.click(cell("Run, Wed 28: missed"));
    expect(cell("Run, Sun 1: not done yet")).toBeInTheDocument();
    expect(cell("Run, Wed 28: missed")).toBeInTheDocument();
    expect(localStorage.getItem(CHECKINS_KEY)).toBe("[]");
  });

  it("AC15 (#4): with no habits the Week section says 'No habits yet'", () => {
    renderView("Week");
    expect(week().getByText("No habits yet")).toBeInTheDocument();
  });

  it("AC16 (#4): corrupted storage shows the error and an empty Week view", () => {
    localStorage.setItem(HABITS_KEY, "{not json");
    renderView("Week");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(week().getByText("No habits yet")).toBeInTheDocument();
    expect(week().queryByRole("table")).not.toBeInTheDocument();
  });

  it("AC18 (#4): the Week view is a table with column and row headers", () => {
    seed([habit("1", "Run")]);
    renderView("Week");
    expect(week().getByRole("table")).toBeInTheDocument();
    expect(week().getAllByRole("columnheader")).toHaveLength(8);
    expect(week().getByRole("rowheader")).toHaveTextContent("Run");
  });

  it("AC19 (#4): the grid has no fixed width and habit names can wrap", () => {
    seed([habit("1", "A very long habit name that must wrap on a narrow screen")]);
    renderView("Week");
    // Layout is CSS only (table-layout: fixed, overflow-wrap); jsdom cannot measure it,
    // so check the long name is a plain text row header, not truncated or clipped by script.
    expect(week().getByRole("rowheader")).toHaveTextContent(
      "A very long habit name that must wrap on a narrow screen",
    );
  });

  it("AC20 (#4): toggling today updates today's cell and the summary at once", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run", { startDate: "2026-10-31" })], []);
    renderView("Week");
    expect(week().getByText("0 of 2 scheduled days done")).toBeInTheDocument();
    goTo("Today");
    await user.click(screen.getByRole("checkbox", { name: "Done today: Run" }));
    goTo("Week");
    expect(cell("Run, Sun 1: done")).toBeInTheDocument();
    expect(week().getByText("1 of 2 scheduled days done")).toBeInTheDocument();
  });

  it("AC21 (#4): the window shifts when the date changes and the app gets focus", () => {
    seed([habit("1", "Run")]);
    renderView("Week");
    expect(week().getAllByRole("columnheader")[7]).toHaveTextContent("Sun 1");
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 2, 9));
      fireEvent.focus(window);
    });
    const heads = week().getAllByRole("columnheader");
    expect(heads[1]).toHaveTextContent("Tue 27");
    expect(heads[7]).toHaveTextContent("Mon 2");
    expect(heads[7]).toHaveTextContent("Today");
  });
});
