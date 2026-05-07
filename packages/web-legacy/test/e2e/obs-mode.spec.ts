import { test, expect } from "@playwright/test";

/**
 * OBS mode — exercises the OBS-friendly background modes.
 *
 * Run status:
 *  - All tests → FIXME
 *
 * Reason: No OBS mode toggle exists in the current codebase. Lambert needs to:
 *
 *   1. Add `obsMode: "off" | "green-screen" | "transparent" | "dark"` (or similar)
 *      to AppSettings or as a separate app-level state
 *   2. Create palette commands `:obs green-screen`, `:obs transparent`, `:obs dark`, `:obs off`
 *      (or a `:obs` command that cycles modes)
 *   3. When an OBS mode is active, update `document.body.dataset.obs` (or set
 *      `background: transparent` / `background: #00FF00` directly on the root element)
 *      so streaming software can apply chroma-key or window capture
 *
 * Expected CSS contract (to be locked in a decision once Lambert lands OBS mode):
 *   - `obs="green-screen"` → `body { background: #00FF00 !important }`
 *   - `obs="transparent"` → `body { background: transparent !important }` (requires
 *     transparent Tauri window or browser devtools override)
 *   - `obs="dark"` → `body { background: #000000 !important }`
 *   - `obs="off"` → falls back to `--skin-bg`
 *
 * Decision: see .squad/decisions/inbox/ripley-obs-mode-fixme.md
 */

const SKIN_READY = async (page: import("@playwright/test").Page) =>
  page.waitForFunction(
    () => {
      const s = document.getElementById("skin-tokens");
      return s !== null && (s.textContent?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );

test.describe("OBS mode", () => {
  test.fixme("enabling green-screen OBS mode sets expected body background", async ({ page }) => {
    // Expected: document.body CSS background resolves to #00FF00 (or computed equivalent). // TODO(Lambert): Wire `:obs green-screen` palette command.
    await page.goto("/");
    await SKIN_READY(page);

    await page.locator("body").click({ position: { x: 200, y: 400 } });
    await page.keyboard.press(":");
    await page.keyboard.type("obs green-screen");
    await page.keyboard.press("Enter");

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/0,\s*255,\s*0/); // rgb(0, 255, 0)
  });

  test.fixme("enabling dark OBS mode sets body background to black", async ({ page }) => {
    await page.goto("/");
    await SKIN_READY(page);

    await page.locator("body").click({ position: { x: 200, y: 400 } });
    await page.keyboard.press(":");
    await page.keyboard.type("obs dark");
    await page.keyboard.press("Enter");

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/0,\s*0,\s*0/); // rgb(0, 0, 0)
  });

  test.fixme("disabling OBS mode restores skin background", async ({ page }) => {
    // TODO(Lambert): `:obs off` should restore body background to `--skin-bg` value.
    await page.goto("/");
    await SKIN_READY(page);
  });

  test.fixme("body data-obs attribute reflects active mode", async ({ page }) => {
    // Expected: page.locator("body").toHaveAttribute("data-obs", "green-screen") // analogous to document.body.dataset.crt for CRT mode. // TODO(Lambert): Set document.body.dataset.obs = mode when OBS mode is toggled,
    await page.goto("/");
    await SKIN_READY(page);
  });
});
