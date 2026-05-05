import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for packages/web.
 *
 * webServer note: "serve-only" mode is a v0 milestone Parker will wire into the
 * CLI. It boots the HTTP server without opening a browser, so Playwright can
 * drive it. Once Parker lands the flag, remove this comment.
 */
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
    // "serve-only" boots the HTTP/WS server without opening the browser.
    // This is a placeholder mode Parker wires in the v0 milestone.
    command: "pnpm --filter @squadquarium/cli start --headless-smoke=serve-only --port=6280",
    url: "http://127.0.0.1:6280",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
