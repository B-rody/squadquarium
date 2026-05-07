import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: true,

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.SQUADQUARIUM_URL ?? "http://127.0.0.1:6280",
    screenshot: "only-on-failure",
  },

  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{-projectName}{-snapshotSuffix}{ext}",

  projects: [
    {
      name: "chromium-1x",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 1,
      },
    },
    {
      name: "chromium-2x",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 2,
      },
    },
  ],

  webServer: {
    // --serve-only: boot the HTTP/WS server without running smoke or opening a browser.
    // Both packages must be built before Playwright runs (pnpm -r build).
    command: "node ../cli/dist/index.js --serve-only --port=6280",
    url: "http://127.0.0.1:6280",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
