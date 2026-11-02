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
const progress = () => within(screen.getByRole("region", { name: "Progress" }));

describe("HabitList progress view (#36)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#36): a Progress nav item shows the view on the same page, with no route change", () => {
    seed([habit("1", "Run")]);
    const before = window.location.href;
    renderView("Today");
    const nav = within(screen.getByRole("navigation", { name: "Views" }));
    expect(nav.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Today",
      "Week",
      "Progress",
      "Habits",
    ]);
    goTo("Progress");
    expect(screen.getByRole("heading", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Progress" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(window.location.href).toBe(before);
  });

  it("AC2 (#36): the period starts on Last 7 days", () => {
    seed([habit("1", "Run")]);
    renderView("Progress");
    expect(progress().getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(progress().getAllByTestId("day-bars")).toHaveLength(7);
  });

  it("AC3 (#36): selecting Last 30 days updates the figures and charts, and 7 goes back", async () => {
    const user = userEvent.setup();
    seed([habit("1", "Run")], [{ habitId: "1", date: "2026-10-05" }]);
    renderView("Progress");
    expect(progress().getByText("0 of 7 done · 0%")).toBeInTheDocument();
    await user.click(progress().getByRole("button", { name: "Last 30 days" }));
    expect(progress().getByText("1 of 30 done · 3%")).toBeInTheDocument();
    expect(progress().getAllByTestId("day-bars")).toHaveLength(30);
    await user.click(progress().getByRole("button", { name: "Last 7 days" }));
    expect(progress().getByText("0 of 7 done · 0%")).toBeInTheDocument();
  });

  it("AC4 (#36): shows '3 of 7 done', 43% and 'not done yet' for today", () => {
    seed(
      [habit("1", "Run")],
      ["2026-10-27", "2026-10-29", "2026-10-31"].map((date) => ({ habitId: "1", date })),
    );
    renderView("Progress");
    expect(progress().getByText("3 of 7 done · 43%")).toBeInTheDocument();
    expect(progress().getByText("Today: not done yet")).toBeInTheDocument();
  });

  it("AC5 (#36): an unscheduled check-in is not counted, stays stored and the Week view shows it", () => {
    const checkins = [{ habitId: "1", date: "2026-10-27" }];
    seed([habit("1", "Run", { frequency: { type: "weekdays", days: [1, 3, 5] } })], checkins);
    renderView("Progress");
    expect(progress().getByText("0 of 3 done · 0%")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CHECKINS_KEY)!)).toEqual(checkins);
    goTo("Week");
    expect(screen.getByRole("cell", { name: "Run, Tue 27: done" })).toBeInTheDocument();
  });

  it("AC6 (#36): a habit that started 3 days ago counts only its active days", () => {
    seed([habit("1", "Run", { startDate: "2026-10-29" })]);
    renderView("Progress");
    expect(progress().getByText("0 of 4 done · 0%")).toBeInTheDocument();
  });

  it("AC7 (#36): a habit without scheduled days shows 'No scheduled days', no bar, no total", () => {
    seed([
      habit("1", "Swim", { frequency: { type: "weekdays", days: [2] }, startDate: "2026-10-28" }),
    ]);
    renderView("Progress");
    expect(progress().getAllByText("No scheduled days").length).toBeGreaterThan(0);
    expect(progress().queryByRole("progressbar")).not.toBeInTheDocument();
    expect(progress().queryByRole("img")).not.toBeInTheDocument();
  });

  it("AC8 (#36): habits that ended before the period or start later are not listed", () => {
    seed([
      habit("1", "Old", { endDate: "2026-10-01" }),
      habit("2", "Future", { startDate: "2026-11-05" }),
      habit("3", "Run"),
    ]);
    renderView("Progress");
    expect(progress().queryByText("Old")).not.toBeInTheDocument();
    expect(progress().queryByText("Future")).not.toBeInTheDocument();
    expect(progress().getAllByText("Run").length).toBeGreaterThan(0);
  });

  it("AC9 (#36): the overall figure reads '4 of 8 done' and '50%'", () => {
    seed(
      [habit("1", "A", { startDate: "2026-10-29" }), habit("2", "B", { startDate: "2026-10-29" })],
      [
        { habitId: "1", date: "2026-10-29" },
        { habitId: "1", date: "2026-10-30" },
        { habitId: "1", date: "2026-10-31" },
        { habitId: "2", date: "2026-10-30" },
      ],
    );
    renderView("Progress");
    expect(progress().getByText("4 of 8 done (50%)")).toBeInTheDocument();
  });

  it("AC10 (#36): each day has a done bar and an expected bar, told apart by pattern and legend", () => {
    seed([habit("1", "Run")]);
    renderView("Progress");
    for (const day of progress().getAllByTestId("day-bars")) {
      expect(day.querySelectorAll("rect")).toHaveLength(2);
    }
    expect(progress().getByText("Done (solid)")).toBeInTheDocument();
    expect(progress().getByText("Expected (striped)")).toBeInTheDocument();
  });

  it("AC11 (#36): each habit with expected days has one progress bar with figures", () => {
    seed([habit("1", "Run")], [{ habitId: "1", date: "2026-10-30" }]);
    renderView("Progress");
    const bar = progress().getByRole("progressbar", { name: "Run: 1 of 7 done" });
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "7");
    expect(progress().getByText("1 of 7 done · 14%")).toBeInTheDocument();
  });

  it("AC12 (#36): a text alternative and equivalent data tables are available", () => {
    seed([habit("1", "Run")], [{ habitId: "1", date: "2026-10-30" }]);
    renderView("Progress");
    expect(progress().getByRole("img")).toHaveAccessibleName(/Last 7 days: 1 of 7 done \(14%\)/);
    const tables = progress().getAllByRole("table");
    expect(tables).toHaveLength(2);
    expect(within(tables[0]).getAllByRole("row")).toHaveLength(8);
    expect(within(tables[1]).getByRole("rowheader", { name: "Run" })).toBeInTheDocument();
    expect(within(tables[1]).getByRole("cell", { name: "14%" })).toBeInTheDocument();
  });

  it("AC13 (#36): no fixed widths; the chart scales and long names can wrap", () => {
    seed([habit("1", "A very long habit name that must wrap on a narrow screen")]);
    renderView("Progress");
    // Layout is CSS only (viewBox scaling, overflow-wrap); jsdom cannot measure it.
    const svg = progress().getByRole("img");
    expect(svg).not.toHaveAttribute("width");
    expect(svg.getAttribute("viewBox")).toBeTruthy();
    expect(progress().getAllByText(/A very long habit name/).length).toBeGreaterThan(0);
  });

  it("AC14 (#36): figures follow a new check-in and a date change on the next focus", () => {
    seed([habit("1", "Run")]);
    renderView("Today");
    fireEvent.click(screen.getByRole("checkbox", { name: "Done today: Run" }));
    goTo("Progress");
    expect(progress().getByText("1 of 7 done · 14%")).toBeInTheDocument();
    vi.setSystemTime(new Date(2026, 10, 2, 9));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(progress().getByText("1 of 7 done · 14%")).toBeInTheDocument();
    expect(progress().getByText("Today: not done yet")).toBeInTheDocument();
    const dayRows = progress().getAllByRole("table")[0].querySelectorAll("tbody tr");
    expect(dayRows[0]).toHaveTextContent("2026-10-27");
    expect(dayRows[6]).toHaveTextContent("2026-11-02 (today)");
  });

  it("AC15 (#36): no habits shows 'No habits yet' and no chart", () => {
    renderView("Progress");
    expect(progress().getByText("No habits yet")).toBeInTheDocument();
    expect(progress().queryByRole("img")).not.toBeInTheDocument();
  });

  it("AC16 (#36): corrupted data shows the existing error and empty charts without crashing", () => {
    localStorage.setItem(HABITS_KEY, "{not json");
    renderView("Progress");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(progress().getByText("No habits yet")).toBeInTheDocument();
    expect(progress().queryByRole("img")).not.toBeInTheDocument();
  });

  it("AC17 (#36): using the view writes no new key and leaves the data unchanged", async () => {
    const user = userEvent.setup();
    seed([habit("1", "Run")], [{ habitId: "1", date: "2026-10-30" }]);
    const habits = localStorage.getItem(HABITS_KEY);
    const checkins = localStorage.getItem(CHECKINS_KEY);
    renderView("Progress");
    // The app's own load logic may write badges:v1; the Progress view itself must add nothing.
    const keys = Object.keys(localStorage).sort();
    expect(keys).not.toContain("progress:v1");
    await user.click(progress().getByRole("button", { name: "Last 30 days" }));
    expect(Object.keys(localStorage).sort()).toEqual(keys);
    expect(localStorage.getItem(HABITS_KEY)).toBe(habits);
    expect(localStorage.getItem(CHECKINS_KEY)).toBe(checkins);
  });

  it("AC18 (#36): the charts make no network calls", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    seed([habit("1", "Run")]);
    renderView("Progress");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
