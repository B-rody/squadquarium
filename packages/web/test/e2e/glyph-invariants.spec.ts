import { test, expect } from "@playwright/test";

/**
 * Glyph-grid invariants — structural contract for the terminal renderer.
 *
 * Run status:
 *  - "palette tokens" → ACTIVE: CSS custom properties asserted on :root
 *  - remaining tests  → fixme (pending renderer milestone from Lambert)
 */

test.describe("glyph-grid invariants", () => {
  /**
   * Cell-row alignment — no fractional cell offsets.
   */
  test("cell-row alignment — no fractional cell offsets", async ({ page }) => {
    test.fixme(
      true,
      "v0 milestone — renderer not yet shipped; assert integer cell offsets once Lambert lands the grid",
    );
    await page.goto("/");
  });

  /**
   * Palette tokens are CSS custom properties on :root, not raw hex.
   *
   * The skin loader injects --skin-bg, --skin-fg, --skin-accent, --skin-alert,
   * --skin-dim as CSS custom properties. This asserts they are defined on the
   * document root after the default skin loads.
   */
  test("palette tokens are CSS custom properties (--skin-fg, etc.), not raw hex", async ({
    page,
  }) => {
    await page.goto("/");
    // Wait for the skin loader to inject the tokens CSS into the document.
    await page.waitForFunction(
      () => {
        const style = document.getElementById("skin-tokens");
        return style !== null && style.textContent !== null && style.textContent.length > 0;
      },
      { timeout: 10_000 },
    );

    // Assert the five required skin tokens are defined as CSS custom properties.
    const tokens = ["--skin-bg", "--skin-fg", "--skin-accent", "--skin-alert", "--skin-dim"];
    for (const token of tokens) {
      const value = await page.evaluate(
        (t) => getComputedStyle(document.documentElement).getPropertyValue(t).trim(),
        token,
      );
      expect(value, `CSS custom property ${token} should be defined on :root`).toBeTruthy();
    }
  });

  /**
   * Manifest schema compliance — loaded skin validates against v1 JSON Schema.
   */
  test("manifest schema compliance — loaded skin validates against v1 schema", async ({ page }) => {
    test.fixme(
      true,
      "v0 milestone — skin loader not yet shipped; assert window.__squadquarium.skinManifestValid once Lambert lands the loader",
    );
    await page.goto("/");
  });

  /**
   * Missing glyphs render ▢ with a dev-console warning.
   */
  test("missing glyphs render ▢ with a dev-console warning", async ({ page }) => {
    test.fixme(
      true,
      "v0 milestone — glyph allowlist enforcement not yet shipped; assert ▢ substitution + console.warn once Lambert lands allowlist gating",
    );
    await page.goto("/");
  });
});
