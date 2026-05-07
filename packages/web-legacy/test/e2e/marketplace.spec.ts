import { test, expect } from "@playwright/test";

/**
 * Marketplace — exercises the plugin marketplace UX surface.
 *
 * Run status:
 *  - All tests → FIXME
 *
 * Reason: The `:marketplace` command in CommandPalette only dispatches
 * `marketplace browse <url>` through a PTY channel (interactive mode). There is
 * no standalone MarketplacePanel component in AppShell yet. Lambert needs to:
 *
 *   1. Add a `marketplaceOpen: boolean` state to AppShell
 *   2. Wire the `:marketplace` palette verb to a `<MarketplacePanel>` overlay
 *      (separate from the PTY-based `marketplace browse <url>` flow)
 *   3. MarketplacePanel should show either:
 *      - An empty state message ("No plugins installed") when no
 *        `.squad/plugins/marketplaces.json` fixture is found, OR
 *      - Plugin cards when that fixture is present
 *
 * Decision: see .squad/decisions/inbox/ripley-marketplace-fixme.md
 */

const SKIN_READY = async (page: import("@playwright/test").Page) =>
  page.waitForFunction(
    () => {
      const s = document.getElementById("skin-tokens");
      return s !== null && (s.textContent?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );

test.describe("marketplace panel", () => {
  test.fixme("opens via :marketplace palette command", async ({ page }) => {
    // Expected: page.getByText(/\[ marketplace \]/).toBeVisible() // TODO(Lambert): Wire `:marketplace` palette verb to a <MarketplacePanel> overlay in AppShell.
    await page.goto("/");
    await SKIN_READY(page);

    await page.locator("body").click({ position: { x: 200, y: 400 } });
    await page.keyboard.press(":");
    await page.keyboard.type("marketplace");
    await page.keyboard.press("Enter");

    await expect(page.getByText(/\[ marketplace \]/)).toBeVisible();
  });

  test.fixme("shows empty state when no plugins are installed", async ({ page }) => {
    // Expected: page.getByText(/no plugins/i).toBeVisible() // exists in the served squad root, show a message like "No plugins installed." // TODO(Lambert): When MarketplacePanel is mounted and no .squad/plugins/marketplaces.json
    await page.goto("/");
    await SKIN_READY(page);
  });

  test.fixme("shows marketplace card when a plugin fixture is present", async ({ page }) => {
    // Requires test fixture injection via CLI serve or URL param. // MarketplacePanel should render a card for each plugin. // TODO(Lambert + Parker): When .squad/plugins/marketplaces.json contains a plugin entry,
    await page.goto("/");
    await SKIN_READY(page);
  });
});
