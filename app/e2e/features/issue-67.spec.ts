import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";

const NOW = new Date(2026, 10, 4, 12, 0, 0);
const NAMES = [
  "Drink water",
  "Walk",
  "Read",
  "Meditate",
  "Sleep early",
  "Stretch",
  "Journal",
  "Exercise",
  "Healthy meal",
  "No phone before bed",
];
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
});

const setup = (p: Page) => p.getByRole("heading", { name: "Welcome to Good Habit Tracker" });
const nav = (p: Page) => p.getByRole("navigation", { name: "Views" });
const stored = (p: Page, key: string) =>
  p.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? "null"), key);
const welcome = (p: Page) => p.getByRole("heading", { level: 2, name: /^Welcome/ });
const checkboxes = (p: Page) => p.getByRole("checkbox");
const nameField = (p: Page) => p.getByLabel("Your name (optional)");
const failWrites = (p: Page) =>
  p.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
  });

test("AC1 (#67): first load shows one setup screen with no nav", async ({ app, page }) => {
  await app.open({}, { firstRun: true });
  await expect(setup(page)).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
});

test("AC2 (#67): setup has a labelled name field and exactly the 10 unchecked habits", async ({
  app,
  page,
}) => {
  await app.open({}, { firstRun: true });
  await expect(nameField(page)).toBeVisible();
  await expect(checkboxes(page)).toHaveCount(10);
  for (const [i, n] of NAMES.entries()) {
    await expect(checkboxes(page).nth(i)).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: new RegExp(n) })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
});

test("AC3 (#67): a name over 30 characters saves nothing and shows an announced error", async ({
  app,
  page,
}) => {
  await app.open({}, { firstRun: true });
  await nameField(page).fill("x".repeat(31));
  await page.getByRole("checkbox", { name: /Walk/ }).check();
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(setup(page)).toBeVisible();
  await expect(page.locator("#setup-name-error")).toHaveAttribute("role", "alert");
  await expect(nameField(page)).toHaveAttribute("aria-invalid", "true");
  expect(await stored(page, "profile:v1")).toBeNull();
  expect(await stored(page, "habits:v1")).toBeNull();
  expect(await stored(page, "setup:v1")).toBeNull();
});

test("AC4 (#67) AC5 (#67): name and 3 habits are saved, Today welcomes by name", async ({
  app,
  page,
}) => {
  await app.open({}, { firstRun: true });
  await nameField(page).fill("  Sara  ");
  // checked out of list order on purpose: creation order must follow the list
  for (const n of ["Read", "Drink water", "Journal"]) {
    await page.getByRole("checkbox", { name: new RegExp(n) }).check();
  }
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(welcome(page)).toHaveText("Welcome, Sara");
  expect(await stored(page, "profile:v1")).toEqual({ name: "Sara" });
  const habits = await stored(page, "habits:v1");
  expect(habits.map((h: { name: string }) => h.name)).toEqual(["Drink water", "Read", "Journal"]);
  for (const h of habits) {
    expect(h.frequency).toEqual({ type: "daily" });
    expect(h.startDate).toBe("2026-11-04");
    expect(h.icon).toBeTruthy();
    expect(h.endDate ?? null).toBeNull();
    expect(h.cost ?? null).toBeNull();
    expect(h.budget ?? null).toBeNull();
  }
  await expect(nav(page).getByRole("button")).toHaveText(["Today", "Week", "Progress", "Habits"]);
  for (const n of ["Drink water", "Read", "Journal"]) {
    await expect(page.getByRole("checkbox", { name: `Done today: ${n}` })).toBeVisible();
  }
});

test("AC6 (#67): Get started with nothing chosen saves nothing, marks setup done", async ({
  app,
  page,
}) => {
  await app.open({}, { firstRun: true });
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(welcome(page)).toHaveText("Welcome");
  await expect(page.getByText("No habits yet")).toBeVisible();
  expect(await stored(page, "profile:v1")).toBeNull();
  expect(await stored(page, "habits:v1")).toBeNull();
  expect(await stored(page, "setup:v1")).toEqual({ done: true });
});

test("AC7 (#67) AC8 (#67): Skip saves nothing and the setup never returns after reload", async ({
  app,
  page,
}) => {
  await app.open({}, { firstRun: true });
  await nameField(page).fill("Ignored");
  await page.getByRole("checkbox", { name: /Walk/ }).check();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(welcome(page)).toHaveText("Welcome");
  await expect(page.getByText("No habits yet")).toBeVisible();
  expect(await stored(page, "profile:v1")).toBeNull();
  expect(await stored(page, "habits:v1")).toBeNull();
  expect(await stored(page, "setup:v1")).toEqual({ done: true });
  await page.reload();
  await expect(welcome(page)).toBeVisible();
  await expect(setup(page)).toHaveCount(0);
});

const habitA = {
  id: "a",
  name: "Read",
  createdAt: "2026-10-01T09:00:00",
  frequency: { type: "daily" },
  startDate: "2026-10-01",
};
const existing: Record<string, unknown> = {
  "profile:v1": { name: "Old" },
  "habits:v1": [habitA],
  "checkins:v1": [],
};
for (const key of Object.keys(existing)) {
  test(`AC9 (#67): existing ${key} means no setup and data unchanged`, async ({ app, page }) => {
    await app.open({ [key]: existing[key] }, { firstRun: true });
    await expect(welcome(page)).toBeVisible();
    await expect(setup(page)).toHaveCount(0);
    await expect(nav(page)).toBeVisible();
    expect(await stored(page, key)).toEqual(existing[key]);
    expect(await stored(page, "setup:v1")).toBeNull();
  });
}

test("AC10 (#67): corrupted data shows the error, no setup, nothing overwritten", async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem("habits:v1", "{not json"));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(setup(page)).toHaveCount(0);
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be loaded or saved" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("habits:v1"))).toBe("{not json");
});

test("AC10 (#67): corrupted profile shows the error, no setup", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("profile:v1", "{not json"));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(setup(page)).toHaveCount(0);
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be loaded or saved" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("profile:v1"))).toBe("{not json");
});

test("AC10 (#67): unavailable localStorage shows the error and no setup, no crash", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(setup(page)).toHaveCount(0);
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be loaded or saved" }),
  ).toBeVisible();
});

test("AC11 (#67): a failed save shows the error and keeps name and habits for the session", async ({
  app,
  page,
}) => {
  await failWrites(page);
  await app.open({}, { firstRun: true });
  await nameField(page).fill("Sara");
  await page.getByRole("checkbox", { name: /Walk/ }).check();
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(welcome(page)).toHaveText("Welcome, Sara");
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be loaded or saved" }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Done today: Walk" })).toBeVisible();
});

test("AC12 (#67): keyboard-only, no horizontal scroll at 320px, accessible", async ({
  app,
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await app.open({}, { firstRun: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(await app.a11yViolations()).toEqual([]);
  await expect(nameField(page)).toBeFocused();
  await page.keyboard.type("Kim");
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    await expect(checkboxes(page).nth(i)).toBeFocused();
    if (i < 2) await page.keyboard.press("Space");
  }
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Get started" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Skip" })).toBeFocused();
  const outline = await page
    .getByRole("button", { name: "Skip" })
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(welcome(page)).toHaveText("Welcome, Kim");
  await expect(page.getByRole("checkbox", { name: "Done today: Drink water" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Done today: Walk" })).toBeVisible();
});

test("AC13 (#67): after setup the name is editable and removable in Habits, no reopen action", async ({
  app,
  page,
}) => {
  await app.open({}, { firstRun: true });
  await nameField(page).fill("Sara");
  await page.getByRole("button", { name: "Get started" }).click();
  await app.goTo("Habits");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await nameField(page).fill("Sarah");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect(await stored(page, "profile:v1")).toEqual({ name: "Sarah" });
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await nameField(page).fill("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await app.goTo("Today");
  await expect(welcome(page)).toHaveText("Welcome");
  await expect(page.getByRole("button", { name: /setup|get started|reset/i })).toHaveCount(0);
});

test("AC14 (#67): setup habits behave like others: check in, no duplicates, delete", async ({
  app,
  page,
}) => {
  await app.open({}, { firstRun: true });
  await page.getByRole("checkbox", { name: /Walk/ }).check();
  await page.getByRole("button", { name: "Get started" }).click();
  const done = page.getByRole("checkbox", { name: "Done today: Walk" });
  await done.check();
  await expect(done).toBeChecked();
  await app.goTo("Habits");
  await page.getByLabel("New habit name").fill("walk");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("New habit name")).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Delete Walk" }).click();
  await expect(page.getByRole("alertdialog").or(page.getByRole("dialog"))).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Delete/ })
    .click();
  await expect(page.getByText("No habits yet")).toBeVisible();
});
