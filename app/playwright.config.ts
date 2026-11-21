import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and regression tests (Playwright), run by `npm run e2e`.
 * - Locally and in CI: builds nothing itself; serves the static export in `out/` (run
 *   `npm run build` first) with a tiny Node server, so no extra dependency is needed.
 * - E2E_BASE_URL=<url> runs the same suite against a deployed site (e.g. a Vercel preview).
 * Tests live in `e2e/`, named after acceptance criteria: `AC3 (#12): ...`.
 */
const port = Number(process.env.E2E_PORT ?? 4173);
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/.explore/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results/results.json" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: external ?? `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  expect: {
    // visual baselines are created and reviewed in CI (Linux); small anti-aliasing noise is ok
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: external
    ? undefined
    : {
        command: `node e2e/support/serve.mjs out ${port}`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
