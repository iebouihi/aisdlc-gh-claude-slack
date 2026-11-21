---
name: e2e-from-acceptance-criteria
description: Turn a requirement's acceptance criteria (Given/When/Then) into Playwright end-to-end tests in app/e2e/ - one test per criterion named after its AC ID, user-facing locators, seeded storage, accessibility and visual checks where the criterion implies them. Use when writing or reviewing end-to-end tests.
---

# End-to-end tests from acceptance criteria

## Where and how they run
- Files: `app/e2e/features/issue-<n>.spec.ts` (one per issue), `app/e2e/regression/` (core
  journeys), shared helpers in `app/e2e/support/fixtures.ts`. Config: `app/playwright.config.ts`.
- `npm run build && npm run e2e` serves the static export and runs every test on a desktop and a
  mobile project. `E2E_BASE_URL=<preview url> npm run e2e` runs them against a deployed preview.
- Import `test` and `expect` from `../support/fixtures`; use the `app` fixture
  (`app.open(storage)`, `app.goTo(view)`, `app.addHabit(name)`, `app.a11yViolations()`).
  Add a helper there when two tests need the same steps.

## Naming = traceability
`test("AC3 (#12): an empty name shows an inline error", …)`: the AC ID and issue first, then the
observable result. Group by feature with `test.describe("#12 <title>", …)`. Every AC with a
user-visible result has at least one test; one test may cover several ACs (`AC1, AC2 (#12): …`).

## Given / When / Then → test
- **Given** = starting state. Seed it directly instead of clicking through other features:
  `await app.open({ "habits:v1": [...], "checkins:v1": [...] })` with the stored formats from the
  code map. Dates relative to today: compute them in the test, never hard-code a date. For a
  fixed date, use `page.clock.setFixedTime(...)` before `app.open()`.
- **When** = what the user does: clicks, typing, keyboard (`page.keyboard.press("Tab")`).
- **Then** = what the user can observe: text, state, focus, what survives `page.reload()`.
  Assert with web-first assertions (`await expect(locator).toBeVisible()`, `toHaveText`,
  `toBeChecked`, `toBeFocused`, `toHaveAttribute("aria-invalid", "true")`).

## Locators
- In this order: `getByRole(role, { name })`, `getByLabel`, `getByText` for content. These are
  the same names a screen reader uses, so they also check accessibility.
- Never CSS classes (CSS Modules hash them), DOM structure or `nth()` unless order *is* the
  requirement. `data-testid` is not used in this app.

## Implied checks
- A criterion about **accessibility** (labels, focus, announcements): assert roles/focus, and
  `expect(await app.a11yViolations()).toEqual([])` on the screen.
- A criterion about **layout or look** that the mockup defines: a visual check,
  `await expect(page.getByRole("region", { name: … })).toHaveScreenshot("issue-12-empty.png")`,
  on the smallest stable element, masking dynamic parts (`mask: [page.getByText(/today/i)]`).
  Baselines are created in CI on Linux by the tester run (`npm run e2e:update` for your new
  screenshots only) and committed with the tests; never update an existing baseline silently.
- **Persistence**: reload and assert again. **Errors**: corrupt the stored data via `app.open`.
- **Mobile**: the suite already runs every test on the mobile project; add
  `page.setViewportSize({ width: 320, height: 640 })` for criteria about small screens.

## Rules
- No `waitForTimeout`; rely on auto-waiting assertions.
- Each test independent (fresh browser context, empty storage); no order between tests.
- No retries or `test.skip` to hide a failure. A known, reported bug may use
  `test.fail(true, "<bug link>")` so the suite turns red when it gets fixed.
