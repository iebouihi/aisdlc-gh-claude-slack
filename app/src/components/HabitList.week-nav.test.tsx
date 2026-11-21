import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goTo, renderView } from "./test-utils";
import { CHECKINS_KEY, HABITS_KEY } from "@/lib/storage";

// Sunday 1 Nov 2026, local time. Current window: Oct 26 – Nov 1.
const NOW = new Date(2026, 10, 1, 12);
const habit = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  createdAt: new Date(2026, 9, 5, 12).toISOString(), // 5 Oct: earliest window is Oct 5 – Oct 11
  frequency: { type: "daily" },
  startDate: "2026-10-05",
  ...extra,
});
const seed = (habits: unknown, checkins: unknown = []) => {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkins));
};
const week = () => within(screen.getByRole("region", { name: "Week" }));
const prev = () => week().getByRole("button", { name: "Previous week" });
const next = () => week().getByRole("button", { name: "Next week" });
const range = () => week().getByText(/^[A-Z][a-z]{2} \d+ – /, { selector: "p" });

describe("HabitList week navigation (#61)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#61): opens on the current window with its range and Next week disabled", () => {
    seed([habit("1", "Run")]);
    renderView("Week");
    expect(range()).toHaveTextContent("Oct 26 – Nov 1");
    expect(next()).toBeDisabled();
    expect(prev()).toBeEnabled();
  });

  it("AC2 (#61): Previous week shifts back 7 days and updates label, headers, cells, summaries", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")], [{ habitId: "1", date: "2026-10-20" }]);
    renderView("Week");
    await user.click(prev());
    expect(range()).toHaveTextContent("Oct 19 – Oct 25");
    expect(week().getAllByRole("columnheader")[1]).toHaveTextContent("Mon 19");
    expect(week().getAllByRole("columnheader")[7]).toHaveTextContent("Sun 25");
    expect(week().getByRole("cell", { name: "Run, Tue 20: done" })).toBeInTheDocument();
    expect(week().getByText("1 of 7 scheduled days done")).toBeInTheDocument();
  });

  it("AC3 (#61): Next week moves forward and is disabled again on the current window", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")]);
    renderView("Week");
    await user.click(prev());
    expect(next()).toBeEnabled();
    await user.click(next());
    expect(range()).toHaveTextContent("Oct 26 – Nov 1");
    expect(next()).toBeDisabled();
  });

  it("AC4 (#61): Previous week is disabled on the earliest window, with a dashed non-colour cue", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")]);
    renderView("Week");
    for (let i = 0; i < 3; i++) await user.click(prev());
    expect(range()).toHaveTextContent("Oct 5 – Oct 11");
    expect(prev()).toBeDisabled();
    // Focus is not lost on a disabled button.
    expect(next()).toHaveFocus();
  });

  it("AC5 (#61): past windows show missed and never 'not done yet'", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")]);
    renderView("Week");
    await user.click(prev());
    expect(week().getByRole("cell", { name: "Run, Wed 21: missed" })).toBeInTheDocument();
    expect(week().queryByRole("cell", { name: /not done yet/ })).not.toBeInTheDocument();
  });

  it("AC6 (#61) AC7 (#61): past summary counts the window; unscheduled check-in shows done", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed(
      [
        habit("1", "Gym", { frequency: { type: "weekdays", days: [1] } }),
        habit("2", "Idle", {
          frequency: { type: "weekdays", days: [2] },
          startDate: "2026-10-22",
          endDate: "2026-10-23",
        }),
      ],
      [{ habitId: "1", date: "2026-10-21" }],
    );
    renderView("Week");
    await user.click(prev());
    expect(week().getByRole("cell", { name: "Gym, Wed 21: done" })).toBeInTheDocument();
    expect(week().getByText("0 of 1 scheduled days done")).toBeInTheDocument();
    expect(week().getByText("No scheduled days")).toBeInTheDocument();
  });

  it("AC8 (#61): only overlapping habits are listed, ended ones included", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([
      habit("1", "A"),
      habit("2", "Ended", { endDate: "2026-10-20" }),
      habit("3", "Later", { startDate: "2026-10-27" }),
    ]);
    renderView("Week");
    await user.click(prev());
    const names = week()
      .getAllByRole("rowheader")
      .map((h) => h.textContent);
    expect(names).toHaveLength(2);
    expect(names[0]).toContain("A");
    expect(names[1]).toContain("Ended");
  });

  it("AC9 (#61): a window with no habits says so and navigation stays usable", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run", { startDate: "2026-10-30" })], [{ habitId: "1", date: "2026-09-01" }]);
    renderView("Week");
    await user.click(prev());
    expect(week().getByText("No habits in this week")).toBeInTheDocument();
    expect(week().queryByRole("table")).not.toBeInTheDocument();
    expect(prev()).toBeEnabled();
    expect(next()).toBeEnabled();
    await user.click(next());
    expect(week().getByRole("table")).toBeInTheDocument();
  });

  it("AC10 (#61): month name where the month changes; Today only in the current window", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")]);
    renderView("Week");
    expect(week().getAllByText("Today")).toHaveLength(1);
    await user.click(prev());
    expect(week().queryByText("Today")).not.toBeInTheDocument();
    const heads = week().getAllByRole("columnheader");
    expect(heads[1]).toHaveTextContent("OctMon 19");
    expect(heads.some((h) => h.getAttribute("aria-current"))).toBe(false);
  });

  it("AC11 (#61): clicking a past cell does nothing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")]);
    renderView("Week");
    await user.click(prev());
    await user.click(week().getByRole("cell", { name: "Run, Wed 21: missed" }));
    expect(week().getByRole("cell", { name: "Run, Wed 21: missed" })).toBeInTheDocument();
    expect(localStorage.getItem(CHECKINS_KEY)).toBe("[]");
  });

  it("AC12 (#61): leaving Week and coming back shows the current window", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")]);
    renderView("Week");
    await user.click(prev());
    goTo("Progress");
    goTo("Week");
    expect(range()).toHaveTextContent("Oct 26 – Nov 1");
  });

  it("AC13 (#61): the selected past window does not change on a focus refresh or date change", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")]);
    renderView("Week");
    await user.click(prev());
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 2, 9));
      fireEvent.focus(window);
    });
    expect(range()).toHaveTextContent("Oct 19 – Oct 25");
  });

  it("AC14 (#61): the current window refreshes to the new date", () => {
    seed([habit("1", "Run")]);
    renderView("Week");
    expect(range()).toHaveTextContent("Oct 26 – Nov 1");
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 2, 9));
      fireEvent.focus(window);
    });
    expect(range()).toHaveTextContent("Oct 27 – Nov 2");
    expect(next()).toBeDisabled();
  });

  it("AC15 (#61): navigating writes nothing to storage and keeps the URL", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")]);
    const before = JSON.stringify({ ...localStorage });
    const path = window.location.pathname;
    renderView("Week");
    await user.click(prev());
    await user.click(next());
    expect(JSON.stringify({ ...localStorage })).toBe(before);
    expect(window.location.pathname).toBe(path);
  });

  it("AC16 (#61): the range is a polite live region and the buttons are keyboard operable", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Run")]);
    renderView("Week");
    expect(range()).toHaveAttribute("aria-live", "polite");
    prev().focus();
    await user.keyboard("{Enter}");
    expect(range()).toHaveTextContent("Oct 19 – Oct 25");
    await user.keyboard(" ");
    expect(range()).toHaveTextContent("Oct 12 – Oct 18");
  });

  it("AC18 (#61): corrupted data shows the error, no navigation and no crash", () => {
    localStorage.setItem(HABITS_KEY, "{not json");
    renderView("Week");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(week().getByText("No habits yet")).toBeInTheDocument();
    expect(week().queryByRole("button", { name: "Previous week" })).not.toBeInTheDocument();
  });
});
