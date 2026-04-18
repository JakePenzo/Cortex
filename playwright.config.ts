import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.browser.ts",
  timeout: 30_000,
  retries: 0,
  workers: 1, // serial — one server shared across tests

  use: {
    baseURL: "http://localhost:3475",
    // Capture console logs so tests can assert on them
    video: "off",
    screenshot: "only-on-failure",
  },

  // Start the dashboard server before tests, seeded with example data
  webServer: {
    command: "bun tests/browser/test-server.ts",
    port: 3475,
    reuseExistingServer: false,
    timeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
