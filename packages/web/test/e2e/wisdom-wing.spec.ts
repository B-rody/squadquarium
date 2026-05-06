import { test, expect } from "@playwright/test";

/**
 * Wisdom Wing — exercises the WisdomWing overlay component.
 *
 * WisdomWing opens via the `:wisdom` command palette verb.
 * The AppShell supplies a WISDOM_PLACEHOLDER constant with 2 parsed patterns
 * (no network call needed) — all assertions here are ACTIVE.
 */

const SKIN_READY = async (page: import("@playwright/test").Page) =>
  page.waitForFunction(
    () => {
      const s = document.getElementById("skin-tokens");
      return s !== null && (s.textContent?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );

async function openWisdomWing(page: import("@playwright/test").Page) {
  // Dispatch keydown directly on window — avoids focus racing with xterm.
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: ":", bubbles: true, cancelable: true }),
    ),
  );
  // Wait for the palette input to mount and auto-focus before typing.
  const palInput = page.locator('input[placeholder*=":skin"]');
  await palInput.waitFor({ state: "visible" });
  await palInput.fill(":wisdom");
  await page.keyboard.press("Enter");
}

test.describe("wisdom wing", () => {
  test("opens via :wisdom palette command", async ({ page }) => {
    await page.goto("/");
    await SKIN_READY(page);

    await openWisdomWing(page);

    await expect(page.getByText("[ wisdom wing ]")).toBeVisible();
  });

  test("renders at least one pattern card from the wisdom placeholder", async ({ page }) => {
    await page.goto("/");
    await SKIN_READY(page);

    await openWisdomWing(page);
    await expect(page.getByText("[ wisdom wing ]")).toBeVisible();

    // WISDOM_PLACEHOLDER in AppShell.tsx has two **Pattern:** entries.
    // parseWisdomPatterns should parse both.
    await expect(
      page.getByText(/Keep canvas animation and CSS camera motion/, { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText(/Parse command palette verbs as data/, { exact: false }),
    ).toBeVisible();
  });

  test("shows skills section with at least one skill chip", async ({ page }) => {
    await page.goto("/");
    await SKIN_READY(page);

    await openWisdomWing(page);
    await expect(page.getByText("[ wisdom wing ]")).toBeVisible();

    // AppShell supplies two hardcoded skill chips: frontend-polish, skin-metrics
    await expect(page.getByText(/frontend-polish/, { exact: false })).toBeVisible();
  });

  test("closes on [×] button click", async ({ page }) => {
    await page.goto("/");
    await SKIN_READY(page);

    await openWisdomWing(page);
    await expect(page.getByText("[ wisdom wing ]")).toBeVisible();

    await page.locator("button", { hasText: "[×]" }).first().click();
    await expect(page.getByText("[ wisdom wing ]")).not.toBeVisible();
  });

  test("closes on backdrop click", async ({ page }) => {
    await page.goto("/");
    await SKIN_READY(page);

    await openWisdomWing(page);
    await expect(page.getByText("[ wisdom wing ]")).toBeVisible();

    // The WisdomWing outer div has onClick that closes on self-click (not child click).
    // Backdrop has inset:24px; inner panel is 520px centered (≈380-900px in 1280px viewport).
    // Click left of inner panel, below header — guaranteed to land on backdrop div itself.
    await page.mouse.click(50, 200);
    await expect(page.getByText("[ wisdom wing ]")).not.toBeVisible();
  });
});
