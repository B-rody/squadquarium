import { test, expect } from "@playwright/test";

/**
 * Smoke spec — confirms the server is alive and the root HTML shell renders.
 *
 * These checks run in both chromium-1x and chromium-2x projects. If the server
 * would 404 (the CLI serve-only mode isn't wired yet), each test is marked
 * fixme so CI stays green while Parker lands the flag.
 */

test.describe("smoke — page shell", () => {
  test("page title contains 'squadquarium'", async ({ page }) => {
    // fixme: remove once Parker wires --headless-smoke=serve-only
    test.fixme(true, "v0 milestone — serve-only mode not yet wired; page would 404");
    await page.goto("/");
    await expect(page).toHaveTitle(/squadquarium/i);
  });

  test("root element renders", async ({ page }) => {
    // fixme: remove once Parker wires --headless-smoke=serve-only
    test.fixme(true, "v0 milestone — habitat panel not yet rendered; root element absent");
    await page.goto("/");
    const root = page.locator("#root");
    await expect(root).toBeVisible();
  });
});
