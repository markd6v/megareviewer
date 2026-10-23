import { defineConfig, devices } from "@playwright/test";

// Every test starts its own fake-mode server (see fake-server.ts), so tests run in parallel
// without sharing state. Needs `pnpm build` first: the server serves dist/web.
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // PLAYWRIGHT_CHANNEL=chrome runs the installed Chrome instead of Playwright's own build.
        ...(process.env.PLAYWRIGHT_CHANNEL && { channel: process.env.PLAYWRIGHT_CHANNEL }),
      },
    },
  ],
});
