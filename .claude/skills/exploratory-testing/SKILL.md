---
name: exploratory-testing
description: Run a short, time-boxed exploratory session on a feature in a real browser (Playwright, headless) beyond the scripted tests - edge inputs, keyboard and screen-reader paths, small screens, reload and corrupted data, neighbouring features - and record findings with evidence. Use after the scripted tests pass, or when asked to explore a feature.
---

# Exploratory testing

Scripted tests prove what was specified. Exploration looks for what nobody wrote down. Keep it
to 10–15 minutes and to the feature plus the existing features it impacts.

## How
Write throwaway scripts in `app/e2e/.explore/` (git-ignored; never committed) using the same
fixtures, and run them with `npx playwright test e2e/.explore --project=desktop`
(`--project=mobile` for small screens). Use `testIgnore` defaults: these files never join the
regression suite. Capture evidence with `await page.screenshot({ path: … })` and traces
(`--trace on`); `page.accessibility` / `app.a11yViolations()` for assistive tech.
(If `playwright-cli` is installed, you may use it instead for an interactive session.)

## Charters (pick the ones that fit the feature)
- **Inputs**: empty, spaces, very long text (200+ chars), emoji and RTL text, `<b>html</b>`,
  boundary numbers (0, negative, max, decimals with `,` and `.`).
- **Keyboard only**: reach and operate every new control with Tab/Shift+Tab/Enter/Space/Escape;
  focus is visible and lands somewhere sensible after each action.
- **Small screen**: 320px wide; no horizontal scroll, nothing cut off, touch targets ≥ 40px.
- **State**: reload mid-flow; two tabs; date change (`page.clock`); corrupted or old-format
  stored data (`app.open({ key: "garbage" })`).
- **Neighbours**: every existing view and feature listed in the issue's impact section still
  works with the new data present (Today, Week, Progress, Habits, badges, budget…).

## Record
For each finding: what you did (steps), what you expected (cite AC or spec decision), what
happened, evidence (screenshot or trace path under `app/test-results/`), severity
(high = breaks an AC, a spec decision or data; medium = degraded but usable; low = cosmetic).
Promote a finding that is a clear AC or spec violation into a real test in
`app/e2e/features/` so it stays covered.
