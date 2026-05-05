import { test } from "@playwright/test";

/**
 * Glyph-grid invariants — structural contract for the terminal renderer.
 *
 * These tests are all marked fixme (pending) until the renderer ships. The
 * structure here IS the contract: each test name is an invariant Ripley will
 * assert once Lambert lands the canvas/DOM renderer in packages/web.
 *
 * Run status: all fixme → zero failures in CI today; each fixme flips to a
 * real assertion when the renderer milestone lands.
 */

test.describe("glyph-grid invariants", () => {
  /**
   * Cell-row alignment — no fractional cell offsets.
   *
   * Every glyph must be positioned at an integer multiple of (cellWidth,
   * cellHeight). Sub-pixel drift accumulates into visible misalignment at 2×
   * DPI; this invariant catches it at one-cell resolution.
   */
  test("cell-row alignment — no fractional cell offsets", async ({ page }) => {
    test.fixme(
      true,
      "v0 milestone — renderer not yet shipped; assert integer cell offsets once Lambert lands the grid",
    );
    await page.goto("/");
    // Implementation: query all glyph elements, assert
    // parseInt(el.style.left) === el.offsetLeft (no subpixel drift).
  });

  /**
   * Palette tokens are CSS custom properties, not raw hex values.
   *
   * Every colour reference in the rendered output must use a `--skin-*` CSS
   * custom property (e.g., `--skin-fg`, `--skin-bg`, `--skin-accent`). Raw
   * hex strings in inline styles are a violation — they bypass theme switching
   * and break the skin hot-swap contract.
   */
  test("palette tokens are CSS custom properties (--skin-fg, etc.), not raw hex", async ({
    page,
  }) => {
    test.fixme(
      true,
      "v0 milestone — renderer not yet shipped; assert no inline hex colours once Lambert ships the palette system",
    );
    await page.goto("/");
    // Implementation: evaluate all computed styles on glyph elements; assert
    // none have rgb()/hex values set directly — only var(--skin-*) references.
  });

  /**
   * Manifest schema compliance — loaded skin validates against v1 JSON Schema.
   *
   * The skin loader must validate the active skin's manifest.json at load time
   * and expose a `skinManifestValid` flag in the page's debug surface. This
   * test asserts that flag is true after the default skin loads.
   */
  test("manifest schema compliance — loaded skin validates against v1 schema", async ({ page }) => {
    test.fixme(
      true,
      "v0 milestone — skin loader not yet shipped; assert window.__squadquarium.skinManifestValid once Lambert lands the loader",
    );
    await page.goto("/");
    // Implementation: await page.waitForFunction(() =>
    //   window.__squadquarium?.skinManifestValid === true
    // );
  });

  /**
   * Missing glyphs render ▢ with a dev-console warning.
   *
   * If a character is not in the active skin's glyphAllowlist, the renderer
   * must substitute ▢ (U+25A2) and emit a console.warn(). Both behaviors are
   * tested: visual substitution via screenshot diff, warning via
   * page.on('console') capture.
   */
  test("missing glyphs render ▢ with a dev-console warning", async ({ page }) => {
    test.fixme(
      true,
      "v0 milestone — glyph allowlist enforcement not yet shipped; assert ▢ substitution + console.warn once Lambert lands allowlist gating",
    );
    await page.goto("/");
    // Implementation:
    //   1. Inject a glyph outside glyphAllowlist via a test fixture.
    //   2. Capture console messages; assert at least one warn contains the
    //      missing glyph codepoint.
    //   3. Screenshot-diff the cell to confirm ▢ renders, not the raw char.
  });
});
