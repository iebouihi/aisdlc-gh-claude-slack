import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goTo, renderView } from "./test-utils";
import { CATEGORY_CATALOG } from "@/lib/categories";
import { groupByCategory, progress } from "@/lib/progress";
import { parseHabits } from "@/lib/habits";
import { CHECKINS_KEY, HABITS_KEY } from "@/lib/storage";

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
const progressView = () => within(screen.getByRole("region", { name: "Progress" }));
const groupHeadings = () =>
  progressView()
    .queryAllByRole("heading", { level: 4 })
    .map((h) => h.textContent);

describe("habit categories (#50)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#50): each category with a visible habit has a heading, its figure and its bars", () => {
    seed(
      [habit("1", "Run", { category: "fitness" }), habit("2", "Read", { category: "learning" })],
      [{ habitId: "1", date: "2026-11-01" }],
    );
    renderView("Progress");
    expect(groupHeadings()).toEqual(["Fitness", "Learning"]);
    const fitness = within(
      screen
        .getByRole("region", { name: "Progress" })
        .querySelector("section[aria-labelledby='category-fitness']") as HTMLElement,
    );
    // the group figure comes right after the heading, before the habit's own figure
    expect(fitness.getAllByText("1 of 7 done · 14%")).toHaveLength(2);
    expect(fitness.getByRole("progressbar", { name: "Run: 1 of 7 done" })).toBeInTheDocument();
  });

  it("AC2 (#50): groups follow catalog order with Uncategorised last; habits keep creation order", () => {
    seed([
      habit("1", "Plain"),
      habit("2", "Other1", { category: "other" }),
      habit("3", "Work2", { category: "work" }),
      habit("4", "Health1", { category: "health" }),
      habit("5", "Work1", { category: "work" }),
    ]);
    renderView("Progress");
    expect(groupHeadings()).toEqual(["Health", "Work", "Other", "Uncategorised"]);
    const work = progressView()
      .getByRole("heading", { name: "Work" })
      .closest("section") as HTMLElement;
    expect(
      within(work)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([expect.stringContaining("Work2"), expect.stringContaining("Work1")]);
  });

  it("AC3 (#50): no category or an unknown id appears under Uncategorised", () => {
    seed([
      habit("1", "Run", { category: "health" }),
      habit("2", "A"),
      habit("3", "B", { category: "zzz" }),
    ]);
    renderView("Progress");
    expect(groupHeadings()).toEqual(["Health", "Uncategorised"]);
    const section = progressView()
      .getByRole("heading", { name: "Uncategorised" })
      .closest("section") as HTMLElement;
    expect(within(section).getAllByRole("listitem")).toHaveLength(2);
  });

  it("AC4 (#50): with no categories there are no group headings", () => {
    seed([habit("1", "A"), habit("2", "B")]);
    renderView("Progress");
    expect(groupHeadings()).toEqual([]);
    expect(progressView().getAllByRole("progressbar")).toHaveLength(2);
  });

  it("AC5 (#50): a category with no visible habit in the period has no heading", () => {
    seed([
      habit("1", "Run", { category: "health" }),
      habit("2", "Old", { category: "work", startDate: "2026-01-05", endDate: "2026-02-01" }),
      habit("3", "Future", { category: "home", startDate: "2026-12-01" }),
    ]);
    renderView("Progress");
    expect(groupHeadings()).toEqual(["Health"]);
  });

  it("AC6 (#50): a group's figure is sum of done over sum of expected", () => {
    const habits = parseHabits([
      habit("1", "A", { category: "work" }),
      habit("2", "B", { category: "work", frequency: { type: "weekdays", days: [0] } }),
    ])!;
    const p = progress(
      habits,
      [
        { habitId: "1", date: "2026-11-01" },
        { habitId: "1", date: "2026-10-31" },
        { habitId: "2", date: "2026-11-01" },
      ],
      "2026-11-01",
      7,
    );
    const [g] = groupByCategory(p.rows);
    expect(g).toMatchObject({ label: "Work", done: 3, expected: 8, percent: 38 });
    expect(p.expected).toBe(8);
    expect(p.done).toBe(3);
  });

  it("AC6 (#50): the 7/30 day period still switches with groups shown", async () => {
    seed([habit("1", "A", { category: "work" })]);
    renderView("Progress");
    expect(progressView().getAllByText("0 of 7 done · 0%")).toHaveLength(2);
    await userEvent.click(progressView().getByRole("button", { name: "Last 30 days" }));
    expect(progressView().getAllByText("0 of 30 done · 0%").length).toBeGreaterThan(0);
  });

  it("AC7 (#50): add and edit forms have a labelled Category select with 8 categories and No category", async () => {
    seed([habit("1", "Run")]);
    const user = userEvent.setup();
    renderView("Habits");
    const expected = ["No category", ...CATEGORY_CATALOG.map((c) => c.label)];
    const add = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(Array.from(add.options).map((o) => o.text)).toEqual(expected);
    expect(add.value).toBe("");
    expect(CATEGORY_CATALOG).toHaveLength(8);
    // same group as the name + icon controls
    expect(add.closest("form")?.querySelector("input[aria-label='New habit name']")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Edit Run" }));
    const selects = screen.getAllByLabelText("Category") as HTMLSelectElement[];
    expect(selects).toHaveLength(2);
    expect(Array.from(selects[1].options).map((o) => o.text)).toEqual(expected);
    // keyboard: focusable and changeable with the keyboard
    selects[1].focus();
    expect(selects[1]).toHaveFocus();
    await user.selectOptions(selects[1], "Work");
    expect(selects[1].value).toBe("work");
  });

  it("AC8 (#50): a chosen category is kept after reload and the row shows no badge", async () => {
    const user = userEvent.setup();
    const { unmount } = renderView("Habits");
    await user.type(screen.getByLabelText("New habit name"), "Stretch");
    await user.selectOptions(screen.getByLabelText("Category"), "Fitness");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(JSON.parse(localStorage.getItem(HABITS_KEY)!)[0].category).toBe("fitness");
    unmount();
    renderView("Habits");
    expect(screen.getByText("Stretch")).toBeInTheDocument();
    expect(screen.queryByText("Fitness", { selector: "li *" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Edit Stretch" }));
    expect((screen.getAllByLabelText("Category")[1] as HTMLSelectElement).value).toBe("fitness");
  });

  it("AC9 (#50): editing a habit to No category puts it under Uncategorised", async () => {
    seed([habit("1", "Run", { category: "health" }), habit("2", "Read", { category: "work" })]);
    const user = userEvent.setup();
    renderView("Habits");
    await user.click(screen.getByRole("button", { name: "Edit Run" }));
    await user.selectOptions(screen.getAllByLabelText("Category")[1], "No category");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(JSON.parse(localStorage.getItem(HABITS_KEY)!)[0]).not.toHaveProperty("category");
    goTo("Progress");
    expect(groupHeadings()).toEqual(["Work", "Uncategorised"]);
  });

  it("AC10 (#50): stored habits with no or an unknown category load without error", () => {
    seed([habit("1", "A"), habit("2", "B", { category: "nope" })]);
    renderView("Habits");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("AC11 (#50): a malformed (non-string) category shows the existing error and an empty list", () => {
    seed([habit("1", "A", { category: 5 })]);
    renderView("Habits");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("A")).toBeNull();
  });

  it("AC12 (#50): group headings are real headings and groups are not collapsible", () => {
    seed([habit("1", "A", { category: "health" }), habit("2", "B")]);
    renderView("Progress");
    expect(progressView().getAllByRole("heading", { level: 4 })).toHaveLength(2);
    const view = screen.getByRole("region", { name: "Progress" });
    expect(view.querySelector("details, [aria-expanded]")).toBeNull();
    // the group figure is text, not colour only
    expect(progressView().getAllByText(/of 7 done · 0%/).length).toBeGreaterThanOrEqual(2);
  });
});
