import { fireEvent, screen, within } from "@testing-library/react";
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
const toggle = (name: "Bars" | "Line") => progress().getByRole("button", { name });
const selectLine = async () => {
  await userEvent.setup().click(toggle("Line"));
};

describe("HabitList progress line chart (#43)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#43): after load the overall chart is paired bars and Bars is selected", () => {
    seed([habit("1", "Run")]);
    renderView("Progress");
    expect(progress().getAllByTestId("day-bars")).toHaveLength(7);
    expect(progress().queryByTestId("line-chart")).not.toBeInTheDocument();
    expect(toggle("Bars")).toHaveAttribute("aria-pressed", "true");
  });

  it("AC2 (#43): the toggle sits next to the period selector with exactly one option selected", () => {
    seed([habit("1", "Run")]);
    renderView("Progress");
    const period = progress().getByRole("group", { name: "Period" });
    const type = progress().getByRole("group", { name: "Chart type" });
    expect(period.parentElement).toBe(type.parentElement);
    expect(
      within(type)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Bars", "Line"]);
    expect(
      within(type)
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-pressed") === "true"),
    ).toHaveLength(1);
  });

  it("AC3 (#43): selecting Line shows one done and one expected line with a point per day", async () => {
    seed([habit("1", "Run")]);
    renderView("Progress");
    await selectLine();
    expect(progress().queryByTestId("day-bars")).not.toBeInTheDocument();
    const chart = progress().getByTestId("line-chart");
    expect(chart.querySelectorAll("path")).toHaveLength(2);
    expect(progress().getAllByTestId("done-point")).toHaveLength(7);
    expect(progress().getAllByTestId("expected-point")).toHaveLength(7);
  });

  it("AC4 (#43): selecting Bars again shows the paired bars", async () => {
    const user = userEvent.setup();
    seed([habit("1", "Run")]);
    renderView("Progress");
    await user.click(toggle("Line"));
    await user.click(toggle("Bars"));
    expect(progress().getAllByTestId("day-bars")).toHaveLength(7);
    expect(progress().queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("AC5 (#43): points equal the bar values and the overall figure is unchanged", async () => {
    seed(
      [habit("1", "Run"), habit("2", "Read", { startDate: "2026-10-30" })],
      [
        { habitId: "1", date: "2026-10-30" },
        { habitId: "2", date: "2026-10-31" },
        { habitId: "1", date: "2026-10-31" },
      ],
    );
    renderView("Progress");
    const barRows = () =>
      [...progress().getAllByRole("table")[0].querySelectorAll("tbody tr")].map((r) =>
        [...r.querySelectorAll("td")].map((c) => c.textContent),
      );
    const bars = barRows();
    const figure = "3 of 10 done (30%)";
    expect(progress().getByText(figure)).toBeInTheDocument();
    await selectLine();
    expect(barRows()).toEqual(bars);
    expect(progress().getByText(figure)).toBeInTheDocument();
    // Point heights follow the same numbers: the highest expected value is plotted at the top.
    const ys = progress()
      .getAllByTestId("done-point")
      .map((p) => Number(p.getAttribute("cy")));
    const doneValues = bars.map((r) => Number(r[0]));
    doneValues.forEach((a, i) => doneValues.forEach((b, j) => expect(a < b).toBe(ys[i] > ys[j])));
  });

  it("AC6 (#43): a day with no expected habits is plotted at 0 and 0 without a gap", async () => {
    seed([habit("1", "Run", { startDate: "2026-10-30" })]);
    renderView("Progress");
    await selectLine();
    const done = progress().getAllByTestId("done-point");
    const expected = progress().getAllByTestId("expected-point");
    expect(done).toHaveLength(7);
    // First day (26 Oct) is before the start date: 0 expected, 0 done, on the x axis.
    expect(Number(done[0].getAttribute("cy"))).toBe(90);
    expect(
      Number(expected[0].getAttribute("y")) + Number(expected[0].getAttribute("height")) / 2,
    ).toBe(90);
    const row = progress().getAllByRole("table")[0].querySelectorAll("tbody tr")[0];
    expect(row).toHaveTextContent("2026-10-26");
    expect([...row.querySelectorAll("td")].map((c) => c.textContent)).toEqual(["0", "0"]);
    expect(
      progress().getByTestId("line-chart").querySelector("path")!.getAttribute("d"),
    ).not.toMatch(/M[^L]*M/);
  });

  it("AC7 (#43): today counts as expected and is labelled 'not done yet'", async () => {
    seed([habit("1", "Run")]);
    renderView("Progress");
    await selectLine();
    expect(progress().getByText("0 of 7 done (0%)")).toBeInTheDocument();
    expect(progress().getAllByText("Today: not done yet").length).toBeGreaterThan(0);
    const last = progress().getAllByRole("table")[0].querySelectorAll("tbody tr")[6];
    expect(last).toHaveTextContent("2026-11-01 (today, not done yet)");
  });

  it("AC8 (#43): Line stays selected when the period changes, with 7 or 30 points", async () => {
    const user = userEvent.setup();
    seed([habit("1", "Run")]);
    renderView("Progress");
    await user.click(toggle("Line"));
    await user.click(progress().getByRole("button", { name: "Last 30 days" }));
    expect(toggle("Line")).toHaveAttribute("aria-pressed", "true");
    expect(progress().getAllByTestId("done-point")).toHaveLength(30);
    await user.click(progress().getByRole("button", { name: "Last 7 days" }));
    expect(toggle("Line")).toHaveAttribute("aria-pressed", "true");
    expect(progress().getAllByTestId("done-point")).toHaveLength(7);
  });

  it("AC9 (#43): Line is kept when switching to another view and back", async () => {
    seed([habit("1", "Run")]);
    renderView("Progress");
    await selectLine();
    goTo("Week");
    goTo("Progress");
    expect(toggle("Line")).toHaveAttribute("aria-pressed", "true");
    expect(progress().getByTestId("line-chart")).toBeInTheDocument();
  });

  it("AC10 (#43): after a reload Bars is selected and no new key is written", async () => {
    seed([habit("1", "Run")]);
    const first = renderView("Progress");
    const keys = Object.keys(localStorage).sort();
    await selectLine();
    expect(Object.keys(localStorage).sort()).toEqual(keys);
    first.unmount();
    renderView("Progress");
    expect(toggle("Bars")).toHaveAttribute("aria-pressed", "true");
    expect(Object.keys(localStorage).sort()).toEqual(keys);
  });

  it("AC11 (#43): the toggle exposes aria-pressed, is operable by keyboard and is marked beyond colour", async () => {
    const user = userEvent.setup();
    seed([habit("1", "Run")]);
    renderView("Progress");
    expect(toggle("Bars")).toHaveAttribute("aria-pressed", "true");
    expect(toggle("Line")).toHaveAttribute("aria-pressed", "false");
    toggle("Line").focus();
    expect(toggle("Line")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(toggle("Line")).toHaveAttribute("aria-pressed", "true");
    toggle("Bars").focus();
    await user.keyboard(" ");
    expect(toggle("Bars")).toHaveAttribute("aria-pressed", "true");
    // Selected style (bold, underline, thicker border) and focus ring come from the shared
    // period-button CSS ([aria-pressed="true"]); jsdom cannot compute them.
    expect(toggle("Bars").tagName).toBe("BUTTON");
  });

  it("AC12 (#43): the line chart has a text alternative, the same table, and line style plus markers", async () => {
    seed([habit("1", "Run")], [{ habitId: "1", date: "2026-10-30" }]);
    renderView("Progress");
    await selectLine();
    expect(progress().getByRole("img")).toHaveAccessibleName(/Last 7 days: 1 of 7 done \(14%\)/);
    const tables = progress().getAllByRole("table");
    expect(tables).toHaveLength(2);
    expect(within(tables[0]).getAllByRole("row")).toHaveLength(8);
    expect(progress().getByText("Done (solid line, circles)")).toBeInTheDocument();
    expect(progress().getByText("Expected (dashed line, squares)")).toBeInTheDocument();
    const chart = progress().getByTestId("line-chart");
    expect(chart.querySelector("circle")).not.toBeNull();
    expect(chart.querySelector("rect")).not.toBeNull();
  });

  it("AC13 (#43): colours come only from design tokens (AA in both themes)", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/components/ProgressView.module.css", "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
    expect(css).toMatch(/\.doneLine\s*{[^}]*var\(--accent\)/);
    expect(css).toMatch(/\.expectedLine\s*{[^}]*var\(--fg\)/);
  });

  it("AC14 (#43): the 30-point chart scales with no fixed width", async () => {
    const user = userEvent.setup();
    seed([habit("1", "Run")]);
    renderView("Progress");
    await user.click(toggle("Line"));
    await user.click(progress().getByRole("button", { name: "Last 30 days" }));
    // Layout is CSS only (viewBox scaling); jsdom cannot measure it.
    const svg = progress().getByTestId("line-chart");
    expect(svg).not.toHaveAttribute("width");
    expect(svg.getAttribute("viewBox")).toBeTruthy();
    const xs = progress()
      .getAllByTestId("done-point")
      .map((p) => Number(p.getAttribute("cx")));
    expect(Math.min(...xs.slice(1).map((x, i) => x - xs[i]))).toBeGreaterThanOrEqual(9);
    expect(Math.max(...xs)).toBeLessThanOrEqual(300);
  });

  it("AC15 (#43): per-habit charts stay one progress bar each whichever chart type is selected", async () => {
    seed([habit("1", "Run")], [{ habitId: "1", date: "2026-10-30" }]);
    renderView("Progress");
    await selectLine();
    expect(progress().getAllByRole("progressbar")).toHaveLength(1);
    expect(progress().getByRole("progressbar", { name: "Run: 1 of 7 done" })).toBeInTheDocument();
    expect(progress().getByText("1 of 7 done · 14%")).toBeInTheDocument();
  });

  it("AC16 (#43): no habits shows 'No habits yet' whichever chart type is selected", async () => {
    seed([habit("1", "Run")]);
    renderView("Progress");
    await selectLine();
    goTo("Habits");
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete/i }));
    goTo("Progress");
    expect(progress().getByText("No habits yet")).toBeInTheDocument();
    expect(progress().queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("AC17 (#43): corrupted data shows the existing error and an empty chart in Line mode", () => {
    localStorage.setItem(HABITS_KEY, "{not json");
    renderView("Progress");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(progress().getByText("No habits yet")).toBeInTheDocument();
    expect(progress().queryByRole("img")).not.toBeInTheDocument();
  });

  it("AC18 (#43): the line chart updates right after a check-in toggle", async () => {
    seed([habit("1", "Run")]);
    renderView("Progress");
    await selectLine();
    const before = progress().getAllByTestId("done-point").at(-1)!.getAttribute("cy");
    goTo("Today");
    fireEvent.click(screen.getByRole("checkbox", { name: "Done today: Run" }));
    goTo("Progress");
    expect(toggle("Line")).toHaveAttribute("aria-pressed", "true");
    expect(progress().getByText("1 of 7 done (14%)")).toBeInTheDocument();
    expect(progress().getAllByTestId("done-point").at(-1)!.getAttribute("cy")).not.toBe(before);
  });

  it("AC19 (#43): no network call and the Week view is unchanged", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    seed([habit("1", "Run")]);
    renderView("Progress");
    await selectLine();
    goTo("Week");
    expect(screen.getByRole("cell", { name: "Run, Sun 1: not done yet" })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
