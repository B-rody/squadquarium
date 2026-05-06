import { test, expect } from "@playwright/test";

/**
 * Smoke spec — confirms the server is alive and the root HTML shell renders.
 *
 * Both checks run in chromium-1x and chromium-2x projects.
 * Screenshot baselines are captured for the "root element renders" case —
 * update with `pnpm test:web -u` from a clean run.
 */

test.describe("smoke — page shell", () => {
  test("page title contains 'squadquarium'", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/squadquarium/i);
  });

  test("root element renders", async ({ page }) => {
    await page.goto("/");
    const root = page.locator("#root");
    await expect(root).toBeVisible();
    // Wait for the skin CSS tokens to be injected (skin fully loaded, no spinner).
    await page.waitForFunction(
      () => {
        const style = document.getElementById("skin-tokens");
        return style !== null && (style.textContent?.length ?? 0) > 0;
      },
      { timeout: 10_000 },
    );
    // Baseline screenshot — documents the known-good shell at v0.
    // maxDiffPixelRatio of 5% tolerates cursor blink / animation variance across runs.
    await expect(page).toHaveScreenshot("smoke-root.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });
});
