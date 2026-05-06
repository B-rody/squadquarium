import { test, expect } from "@playwright/test";

/**
 * Settings panel — exercises the SettingsPanel component and its effects.
 *
 * Run status:
 *  - "opens via [⚙] button"         → ACTIVE
 *  - "opens via :settings palette"   → ACTIVE
 *  - "CRT Bloom toggle updates body" → ACTIVE
 *  - "game-mode panel"               → FIXME (GameModePanel not yet landed by Lambert)
 */

const SKIN_READY = async (page: import("@playwright/test").Page) =>
  page.waitForFunction(
    () => {
      const s = document.getElementById("skin-tokens");
      return s !== null && (s.textContent?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );

test.describe("settings panel", () => {
  test("opens via [⚙] button in the header", async ({ page }) => {
    await page.goto("/");
    await SKIN_READY(page);

    await page.locator("button", { hasText: "[⚙]" }).click();
    await expect(page.getByText("[ settings ]")).toBeVisible();
  });

  test("opens via :settings command palette", async ({ page }) => {
    await page.goto("/");
    await SKIN_READY(page);

    // Dispatch keydown directly on window — avoids focus racing with xterm.
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: ":", bubbles: true, cancelable: true }),
      ),
    );
    // Wait for the palette input to mount and auto-focus before typing.
    const palInput = page.locator('input[placeholder*=":skin"]');
    await palInput.waitFor({ state: "visible" });
    await palInput.fill(":settings");
    await page.keyboard.press("Enter");

    await expect(page.getByText("[ settings ]")).toBeVisible();
  });

  test("CRT Bloom toggle updates body[data-crt]", async ({ page }) => {
    await page.goto("/");
    await SKIN_READY(page);

    // Open settings
    await page.locator("button", { hasText: "[⚙]" }).click();
    await expect(page.getByText("[ settings ]")).toBeVisible();

    // Default: crtBloom=false, crtScanlines=false → data-crt=""
    // (AppShell useEffect sets dataset.crt = "" when crtMode==="off")
    const before = await page.evaluate(() => document.body.dataset["crt"] ?? "");
    expect(before).toBe("");

    // Toggle CRT Bloom on
    await page
      .locator("label")
      .filter({ hasText: "CRT Bloom" })
      .locator('input[type="checkbox"]')
      .click();

    // applySettings → setCrtMode("bloom") → dataset.crt = "bloom"
    await expect(page.locator("body")).toHaveAttribute("data-crt", "bloom");

    // Toggle CRT Bloom off again
    await page
      .locator("label")
      .filter({ hasText: "CRT Bloom" })
      .locator('input[type="checkbox"]')
      .click();

    const after = await page.evaluate(() => document.body.dataset["crt"] ?? "");
    expect(after).toBe("");
  });

  test.fixme("game-mode toggle in settings opens game panel", async ({ page }) => {
    // Hard rule: game-mode toggle is cosmetic-only — must not affect habitat state or log. // Assert: page.locator('[data-testid="game-mode-panel"]').toBeVisible() // and a <GameModePanel> component. When toggled, the panel should mount in AppShell. // TODO(Lambert): Add `gameMode: boolean` to AppSettings in packages/web/src/settings/store.ts
    await page.goto("/");
  });
});
