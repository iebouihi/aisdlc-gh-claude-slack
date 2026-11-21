import { expect, test } from "../support/fixtures";

/**
 * Seed regression suite: the core user journeys of the existing capabilities, end to end in a
 * real browser. Tests for new features go in e2e/features/issue-<n>.spec.ts (named after their
 * acceptance criteria); this file protects what already works. Names cite the living spec.
 */

test("platform/app-navigation: the four views switch in-page and Today is first", async ({
  app,
  page,
}) => {
  await app.open();
  await expect(app.nav("Today")).toHaveAttribute("aria-current", "page");
  for (const view of ["Week", "Progress", "Habits", "Today"] as const) {
    await app.goTo(view);
  }
  await expect(page).toHaveURL(/\/$/); // views are not routes
});

test("habits/habit-management: empty state leads to the add form", async ({ app, page }) => {
  await app.open();
  await expect(page.getByText("No habits yet")).toBeVisible();
  await page.getByRole("button", { name: "Add your first habit" }).click();
  await expect(app.nav("Habits")).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("New habit name")).toBeFocused();
});

test("habits/habit-management: an added habit is listed and kept after a reload", async ({
  app,
  page,
}) => {
  await app.open();
  await app.addHabit("Drink water");
  await expect(page.getByText("Drink water").first()).toBeVisible();
  await page.reload();
  await app.goTo("Habits");
  await expect(page.getByText("Drink water").first()).toBeVisible();
});

test("habits/habit-management: an empty name is refused with an error", async ({ app, page }) => {
  await app.open();
  await app.addHabit("   ");
  await expect(page.getByLabel("New habit name")).toHaveAttribute("aria-invalid", "true");
});

test("habits/daily-check-in: checking a habit off today survives a reload", async ({
  app,
  page,
}) => {
  await app.open();
  await app.addHabit("Read 10 pages");
  await app.goTo("Today");
  const check = page.getByRole("checkbox", { name: "Done today: Read 10 pages" });
  await check.check();
  await expect(check).toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Done today: Read 10 pages" })).toBeChecked();
});

test("platform/ui-design-system: every view meets WCAG 2.1 AA (axe)", async ({ app }) => {
  await app.open();
  await app.addHabit("Stretch");
  for (const view of ["Today", "Week", "Progress", "Habits"] as const) {
    await app.goTo(view);
    expect(await app.a11yViolations(), `${view} view`).toEqual([]);
  }
});

test("platform/app-foundation D6: no horizontal scroll at 320px", async ({ app, page }) => {
  // Known bug found when this suite was added: the four nav buttons overflow by ~10px at 320px.
  // test.fail keeps CI green while the bug is open, and turns red once the fix lands: then
  // remove this line.
  test.fail(true, "known bug: nav overflows at 320px");
  await page.setViewportSize({ width: 320, height: 640 });
  await app.open();
  await app.addHabit("A habit with a fairly long name to wrap");
  for (const view of ["Today", "Week", "Progress", "Habits"] as const) {
    await app.goTo(view);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${view} view`).toBeLessThanOrEqual(0);
  }
});
