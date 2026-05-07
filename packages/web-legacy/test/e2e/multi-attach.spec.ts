import { test, expect } from "@playwright/test";

/**
 * Multi-attach layout — exercises the `--attach <path>` multi-instance layout.
 *
 * Run status:
 *  - All tests → FIXME
 *
 * Reason: The multi-attach layout (`--attach <path>` flag, multiple) is not yet
 * implemented in the CLI or web bundle. Parker + Lambert need to:
 *
 *   1. Parker (CLI): Accept multiple `--attach <path>` flags and pass all roots
 *      to the web client via the `hello` WebSocket frame (or a new `multi-attach`
 *      frame type)
 *   2. Lambert (Web): When the `hello` frame contains multiple roots, render a
 *      horizontal split with one `<HabitatPanel>` per root
 *   3. Lambert (Web): Accept a `?attach=mock` URL parameter to enable a mock
 *      multi-attach fixture in the browser (for test isolation without a real CLI)
 *   4. Each panel should be identifiable by `data-testid="habitat-panel-{index}"` or
 *      `data-attach-root="{path}"`
 *
 * Design note: The `?attach=mock` parameter approach keeps multi-attach tests
 * independent of Parker's CLI wiring — once Lambert lands the URL param mock,
 * these tests can move from FIXME to ACTIVE without waiting for the CLI.
 *
 * Decision: see .squad/decisions/inbox/ripley-multi-attach-fixme.md
 */

const SKIN_READY = async (page: import("@playwright/test").Page) =>
  page.waitForFunction(
    () => {
      const s = document.getElementById("skin-tokens");
      return s !== null && (s.textContent?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );

test.describe("multi-attach layout", () => {
  test.fixme("?attach=mock URL param renders two habitat panels", async ({ page }) => {
    // Expected: page.locator('[data-testid^="habitat-panel-"]').count() >= 2 // render two <HabitatPanel> instances in a horizontal split layout. // TODO(Lambert): Implement URL param mock. When /?attach=mock, AppShell should
    await page.goto("/?attach=mock");
    await SKIN_READY(page);

    const panels = page.locator('[data-testid^="habitat-panel-"]');
    await expect(panels).toHaveCount(2);
  });

  test.fixme("each attach panel shows its own squad root label", async ({ page }) => {
    // path it is observing, either in the panel header or as a data attribute. // TODO(Lambert): Each HabitatPanel in multi-attach mode should show the squad root
    await page.goto("/?attach=mock");
    await SKIN_READY(page);

    const panel0 = page.locator('[data-testid="habitat-panel-0"]');
    const panel1 = page.locator('[data-testid="habitat-panel-1"]');

    await expect(panel0).toBeVisible();
    await expect(panel1).toBeVisible();

    // Each panel has a distinct root path label
    const root0 = await panel0.getAttribute("data-attach-root");
    const root1 = await panel1.getAttribute("data-attach-root");
    expect(root0).not.toBe(root1);
  });

  test.fixme("multi-attach layout is horizontally split and both panels are visible without scrolling", async ({
    // without requiring horizontal scroll. // TODO(Lambert): The two panels should fit within the viewport in a side-by-side layout
    page,
  }) => {
    await page.goto("/?attach=mock");
    await SKIN_READY(page);

    const panels = page.locator('[data-testid^="habitat-panel-"]');
    const count = await panels.count();
    expect(count).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < count; i++) {
      await expect(panels.nth(i)).toBeInViewport();
    }
  });
});
