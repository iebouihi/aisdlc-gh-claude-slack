import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared helpers for the end-to-end tests.
 * - Every test starts on an empty app: each Playwright test gets a fresh browser context, so
 *   localStorage is empty. Use `seed()` to start from stored data instead of clicking it in.
 * - Locate elements the way users do: roles and accessible names (getByRole, getByLabel).
 */
export const test = base.extend<{ app: App }>({
  // the fixture callback is named `provide`, not `use`, so React's hook lint rule leaves it alone
  app: async ({ page }, provide) => {
    await provide(new App(page));
  },
});
export { expect };

export class App {
  constructor(readonly page: Page) {}

  /** Opens the app, optionally with localStorage entries (key -> JSON value) already set. */
  async open(storage: Record<string, unknown> = {}, options: { firstRun?: boolean } = {}) {
    // Empty storage is a first run (#67): mark the setup done unless the test is about it.
    const entries = options.firstRun ? storage : { "setup:v1": { done: true }, ...storage };
    if (Object.keys(entries).length) {
      await this.page.addInitScript((initial) => {
        for (const [key, value] of Object.entries(initial)) {
          window.localStorage.setItem(key, JSON.stringify(value));
        }
      }, entries);
    }
    await this.page.goto("/");
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  nav(view: "Today" | "Week" | "Progress" | "Habits") {
    return this.page.getByRole("navigation", { name: "Views" }).getByRole("button", { name: view });
  }

  async goTo(view: "Today" | "Week" | "Progress" | "Habits") {
    await this.nav(view).click();
    await expect(this.nav(view)).toHaveAttribute("aria-current", "page");
  }

  async addHabit(name: string) {
    await this.goTo("Habits");
    await this.page.getByLabel("New habit name").fill(name);
    await this.page.getByRole("button", { name: "Add", exact: true }).click();
  }

  /** WCAG 2.1 A/AA violations on the current page (empty = accessible). */
  async a11yViolations() {
    const results = await new AxeBuilder({ page: this.page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
  }
}
