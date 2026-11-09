import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HABITS_KEY } from "@/lib/storage";
import { renderView } from "./test-utils";
import styles from "./HabitList.module.css";

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), "utf8");
const css = read("src/components/HabitList.module.css");
const tokens = read("src/app/tokens.css");

/** The declaration block of the first rule whose selector is exactly `selector`. */
function rule(selector: string, source = css): string {
  const escaped = selector.replace(/[.>]/g, "\\$&");
  const m = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  expect(m, `rule ${selector}`).not.toBeNull();
  return m![1];
}

const addInput = (label: string) => screen.getByLabelText(label);

const habit = {
  id: "1",
  name: "Jogging",
  createdAt: new Date(2026, 0, 5, 12).toISOString(),
  frequency: { type: "daily" },
  startDate: "2026-01-05",
};

function openEdit() {
  localStorage.setItem(HABITS_KEY, JSON.stringify([habit]));
  renderView("Habits");
  fireEvent.click(screen.getByRole("button", { name: /^Edit/ }));
}

describe("habit form layout (#47)", () => {
  it("AC1 (#47): name, date and amount inputs share one size, font, border and radius from tokens", () => {
    const input = rule(".input");
    expect(input).toMatch(/min-height:\s*var\(--control-height\)/);
    expect(input).toMatch(/font-size:\s*var\(--text-md\)/);
    expect(input).toMatch(/border:\s*1px solid var\(--muted\)/);
    expect(input).toMatch(/border-radius:\s*var\(--radius\)/);
    expect(tokens).toMatch(/--control-height:\s*40px/);

    renderView("Habits");
    const controls = [
      "New habit name",
      "Start date",
      "End date (optional)",
      "Cost per check-in (optional)",
      "Budget amount (optional)",
    ].map(addInput);
    for (const c of controls) expect(c).toHaveClass(styles.input);
  });

  it("AC2 (#47): the inline edit form uses the same classes and layout as the add form", () => {
    openEdit();
    const editForm = screen.getByLabelText("Name for Jogging").closest("form")!;
    const addForm = screen.getByLabelText("New habit name").closest("form")!;
    expect(rule(".addForm,\n.editForm")).toMatch(/gap:\s*var\(--space-4\)/);
    const shape = (form: HTMLElement) =>
      [...form.querySelectorAll("input, select, fieldset, .x, div, label")]
        .filter((el) => !el.closest("[role=group]") || el.matches("[role=group]"))
        .map((el) => `${el.tagName}.${el.className}`)
        .filter((s) => !/^INPUT\.$|\.$/.test(s));
    const inEdit = shape(editForm).filter((s) => s.includes(styles.input));
    const inAdd = shape(addForm).filter((s) => s.includes(styles.input));
    // Same field set and classes, apart from the name input's accessible label.
    expect(inEdit).toEqual(inAdd);
    expect(editForm.querySelectorAll(`.${styles.fieldRow}`)).toHaveLength(
      addForm.querySelectorAll(`.${styles.fieldRow}`).length,
    );
    expect(editForm.querySelectorAll(`.${styles.dates}`)).toHaveLength(1);
  });

  it("AC3 (#47): start and end date share a row from 480px", () => {
    expect(css).toMatch(
      /@media \(min-width: 480px\)\s*\{\s*\.dates\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/,
    );
  });

  it("AC4 (#47): below 480px the dates are one column", () => {
    expect(rule(".dates")).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
  });

  it("AC5 (#47): start and end date are native date inputs", () => {
    renderView("Habits");
    expect(addInput("Start date")).toHaveAttribute("type", "date");
    expect(addInput("End date (optional)")).toHaveAttribute("type", "date");
  });

  it("AC6 (#47): cost has its own row; budget amount and period share a wrapping row", () => {
    renderView("Habits");
    const cost = addInput("Cost per check-in (optional)").closest(`.${styles.fieldRow}`)!;
    expect(cost.querySelectorAll("input, select")).toHaveLength(1);
    const amount = addInput("Budget amount (optional)").closest(`.${styles.fieldRow}`)!;
    expect(amount).toBe(addInput("Budget period").closest(`.${styles.fieldRow}`));
    expect(amount).not.toBe(cost);
    expect(rule(".fieldRow")).toMatch(/flex-wrap:\s*wrap/);
  });

  it("AC7 (#47): groups name + icon, schedule, cost and budget; labels above; one gap", () => {
    renderView("Habits");
    const group = addInput("New habit name").closest(`.${styles.group}`)!;
    expect(group).toContainElement(screen.getByRole("group", { name: "Icon (optional)" }));
    const schedule = addInput("Start date").closest(`.${styles.schedule}`)!;
    expect(schedule).toContainElement(screen.getByRole("group", { name: "Frequency" }));
    const money = addInput("Budget period").closest(`.${styles.schedule}`)!;
    expect(money).toContainElement(addInput("Cost per check-in (optional)"));
    expect(money).not.toBe(schedule);
    expect(rule(".dateField")).toMatch(/flex-direction:\s*column/);
    for (const sel of [".group", ".schedule", ".dates", ".fieldRow", ".addRow"]) {
      expect(rule(sel), sel).toMatch(/gap:\s*var\(--field-gap\)/);
    }
  });

  it("AC8 (#47): invalid input still shows the same inline messages and saves nothing", () => {
    renderView("Habits");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(localStorage.getItem(HABITS_KEY)).toBeNull();
  });

  it("AC9 (#47): existing habits in habits:v1 load and the format is unchanged", () => {
    localStorage.setItem(HABITS_KEY, JSON.stringify([habit]));
    renderView("Habits");
    expect(screen.getByText("Jogging")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(HABITS_KEY)!)).toEqual([habit]);
  });

  it("AC10 (#47): every control has a visible focus outline", () => {
    expect(rule(".input:focus-visible")).toMatch(/outline:\s*2px solid var\(--accent\)/);
  });

  it("AC11 (#47): controls are at least 40px high and never wider than the form", () => {
    expect(rule(".input")).toMatch(/max-width:\s*100%/);
    expect(rule(".input")).toMatch(/box-sizing:\s*border-box/);
    expect(rule(".choice")).toMatch(/min-height:\s*var\(--control-height\)/);
    expect(rule(".button,\n.primaryButton,\n.dangerButton")).toMatch(
      /min-height:\s*var\(--control-height\)/,
    );
    expect(rule(".iconOption")).toMatch(/min-height:\s*40px/);
  });

  it("AC12 (#47): every field keeps a label and errors are announced", () => {
    renderView("Habits");
    for (const name of [
      "New habit name",
      "Start date",
      "End date (optional)",
      "Reminder time (optional)",
      "Cost per check-in (optional)",
      "Budget amount (optional)",
      "Budget period",
    ]) {
      expect(addInput(name)).toBeInTheDocument();
    }
    fireEvent.change(addInput("Cost per check-in (optional)"), { target: { value: "abc" } });
    fireEvent.change(addInput("New habit name"), { target: { value: "Read" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("AC13 (#47): date fields can shrink, so nothing overflows in any browser", () => {
    expect(rule(".input")).toMatch(/min-width:\s*0/);
    expect(rule(".dateField")).toMatch(/min-width:\s*0/);
  });

  it("AC14 (#47): no hex/rgb colours or raw spacing for fields; no new runtime dependency", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["next", "react", "react-dom"]);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(rule(".input")).not.toMatch(/\d+px\s+\d+px|padding:\s*\d+px/);
  });
});
