# Skin Author Contract

> **Squadquarium — manifestVersion 1**
> Locked 2026-05-05. Read this before writing a single glyph.

---

## Why this schema exists

Squadquarium renders glyph mosaics on a Canvas2D grid. Every agent sprite is a rectangular grid of cells; each cell is a `(glyph, foreground-color, background-color, blink?)` tuple. The renderer measures JetBrains Mono's exact pixel metrics at startup and never rounds subpixel positions — so a glyph that is 9.3 px wide in your font but 9 px wide in ours will misalign every sprite by a third of a pixel, accumulating across 7 columns into a 2-px drift that the eye reads as a smear.

Three non-negotiables follow:

1. **Font determinism.** The skin names a monospace font. Stock skins bundle JetBrains Mono woff2; community skins must do the same or declare a system font they can verify is installed. The engine refuses to render if the font fails to load.
2. **Glyph allowlist.** The skin declares every character it may emit. Glyphs not in the allowlist render as `▢` (U+25A2) with a dev-console warning. This prevents community packs from accidentally shipping a CJK ideograph that misaligns the grid on every platform.
3. **Cell metrics drive layout.** Bands are integer cell rows. Drift animations are integer cell offsets. No subpixel cheating.

---

## The five sibling files

Every skin lives in `skins/{name}/` and ships exactly these files:

| File            | Purpose                                                          |
| --------------- | ---------------------------------------------------------------- |
| `manifest.json` | Versioned metadata, palette, allowlist, capabilities, fallbacks. |
| `sprites.json`  | Per-role sprite grids per state per frame.                       |
| `habitat.json`  | Band layout and ambient set-dressing rules.                      |
| `vocab.json`    | Flat key → label map for locale/theme label overrides.           |
| `tokens.css`    | CSS custom properties derived from palette + sizing.             |

Optional: `fonts/` (bundled woff2), `sound/` (ambient + transient SFX — future).

---

## manifest.json — field by field

### `manifestVersion` (integer, required)

Always `1` for this schema. The engine reads this first and routes to the matching parser.

```json
"manifestVersion": 1
```

### `name` (string, required)

Kebab-case identifier. Globally unique across community skins. Pattern: `^[a-z][a-z0-9-]*$`.

```json
"name": "deep-space"
```

### `version` (string, required)

SemVer 2.0.0 of the skin itself. Increment patch for color/glyph tweaks, minor for new states, major for grid-size changes that break the sprite contract.

```json
"version": "0.1.0"
```

### `engineVersion` (string, required)

npm-compatible semver range specifying which Squadquarium engine versions can load this skin. The engine rejects the skin with an error if its own version falls outside this range.

```json
"engineVersion": ">=0.1.0 <0.2.0"
```

### `license` (string, required)

SPDX identifier. Required for community-pack policy (the engine does not enforce at runtime). Common values: `MIT`, `Apache-2.0`, `BSD-3-Clause`, `ISC`, `CC-BY-4.0`, `CC0-1.0`. Full registry: <https://spdx.org/licenses/>.

```json
"license": "MIT"
```

### `author` (object, required)

`name` is required; `url` is optional.

```json
"author": { "name": "Your Name", "url": "https://example.com" }
```

### `font` (object, required)

`family` and `fallback` are required. `asset` is optional but strongly recommended for community skins.

```json
"font": {
  "family":   "JetBrains Mono",
  "fallback": "monospace",
  "asset":    "fonts/JetBrainsMono.woff2"
}
```

- **`family`** — CSS font-family name. Must be monospace.
- **`fallback`** — Must be `"monospace"` for glyph-grid integrity.
- **`asset`** — Relative path from `manifest.json` to a bundled woff2. When present, the engine loads via `@font-face` before first render and errors if the fetch fails. When absent, `family` must be a system-installed monospace font — the engine surfaces an error at startup if it cannot measure the font.

### `palette` (object, required)

Five base tokens are required; additional named colors are permitted. All values are 6-digit hex.

```json
"palette": {
  "bg":     "#001f1c",
  "fg":     "#00bfa5",
  "accent": "#80cbc4",
  "alert":  "#ff5252",
  "dim":    "#004d40",
  "success":"#69f0ae"
}
```

Token names map 1:1 to CSS custom properties in `tokens.css`: `bg` → `--skin-bg`, etc. Sprites and habitat reference tokens by their key name (e.g., `"fg": "accent"`).

### `glyphAllowlist` (array, required, minItems 8)

The complete set of Unicode characters this skin may render. **Must include a space character `" "`.** Strongly recommended to include `"▢"` as the explicit fallback-glyph placeholder.

```json
"glyphAllowlist": [
  " ", "!", "(", ")", "*", "=", "<", ">",
  "°", "·",
  "╔", "═", "╗", "║",
  "▢"
]
```

- Glyphs not in this list render as `▢` with a dev-console warning at runtime.
- All glyphs must exist in the bundled font. Glyphs absent from JetBrains Mono **fail the render-diff CI test** (see Cross-platform glyph rule below).
- BMP characters (U+0000–U+FFFF) are strongly preferred. Supplementary-plane characters (U+10000+) count as length 2 in some JSON parsers and may cause surprises — avoid them.
- minItems: 8 is the schema floor; real skins need far more.

### `capabilities` (array, optional)

Opt-in engine features. The engine silently ignores unknown strings for forward compatibility.

```json
"capabilities": ["bands", "drift", "scanlines", "bloom"]
```

| Value       | Effect                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------- |
| `bands`     | Multi-tier banded layout mapping roles to vertical zones. Required for role-band rendering. |
| `drift`     | Ambient glyph drift between bands — e.g., rising bubbles, falling sparks.                   |
| `scanlines` | CSS scanline overlay on the habitat panel.                                                  |
| `bloom`     | Phosphor glow effect (`filter: blur + color`) on foreground glyphs.                         |
| `barrel`    | Optional barrel-distortion CRT curvature (CSS `perspective` transform).                     |

### `fallbacks` (object, optional)

Maps missing sprite states to fallback states. If neither state is defined for a role, the engine falls back to `idle`.

```json
"fallbacks": {
  "working":   "idle",
  "blocked":   "idle",
  "celebrate": "working"
}
```

### `x-*` extension namespace

Any root-level key beginning with `x-` is permitted and carries any value. The engine ignores all `x-*` keys — they are reserved for authors, tooling, and future community conventions.

```json
"x-author-notes": "Draft — not yet validated against CI."
```

---

## sprites.json shape

```json
{
  "roles": {
    "<role>": {
      "states": {
        "idle": {
          "frames": [
            {
              "cells": [
                [
                  { "glyph": "(", "fg": "fg", "bg": "bg" },
                  { "glyph": "°", "fg": "accent", "bg": "bg" }
                ],
                [
                  { "glyph": "~", "fg": "dim", "bg": "bg" },
                  { "glyph": ")", "fg": "fg",  "bg": "bg" }
                ]
              ]
            }
          ]
        },
        "working":   { "frames": [ ... ] },
        "blocked":   { "frames": [ ... ] },
        "celebrate": { "frames": [ ... ] }
      }
    }
  }
}
```

### Cell shape

```json
{ "glyph": "X", "fg": "<token-or-hex>", "bg": "<token-or-hex>", "blink": false }
```

| Field   | Type    | Required | Description                                                                                                                                                |
| ------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glyph` | string  | yes      | Single Unicode character. Must be in `glyphAllowlist`.                                                                                                     |
| `fg`    | string  | yes      | Foreground color. Palette token name (`"fg"`, `"accent"`, `"alert"`, `"dim"`, `"bg"`, or any extra named color) **or** a 6-digit hex string (`"#ff5252"`). |
| `bg`    | string  | yes      | Background color. Same format as `fg`.                                                                                                                     |
| `blink` | boolean | no       | If `true`, the renderer applies the skin's blink interval (~1 Hz) to this cell. Defaults to `false` when omitted.                                          |

### Grid contract

- `cells` is a 2D array: `cells[row][col]`.
- **Every frame of every state of every role must have the same dimensions** (rows × cols). Dimension mismatch is a render error.
- Both Aquarium and Office ship at **2 rows × 7 cols** — the canonical v0 grid. Community skins may choose a different size, but all roles within a skin must share the same size.
- Use palette tokens (`"fg"`, `"accent"`, etc.) in preference to raw hex — this is what makes re-skinning mechanical.

---

## habitat.json shape

```json
{
  "bands": [
    {
      "id": "top",
      "role": "lead",
      "height": 4,
      "dressing": [
        { "cell": { "row": 0, "col": 68 }, "glyph": "╔", "color": "dim", "drift": false },
        { "cell": { "row": 3, "col": 5 }, "glyph": "·", "color": "accent", "drift": true }
      ]
    }
  ]
}
```

| Field              | Type    | Description                                                                                                                      |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | string  | Band identifier. Must match across skins for the loader to avoid reflow.                                                         |
| `role`             | string  | The agent role whose sprite lives in this band.                                                                                  |
| `height`           | integer | Band height in cell rows.                                                                                                        |
| `dressing[].cell`  | object  | `{ "row": int, "col": int }` — integer position relative to the band's top-left corner. Engine clips items outside the viewport. |
| `dressing[].glyph` | string  | Character to render. Must be in `glyphAllowlist`.                                                                                |
| `dressing[].color` | string  | Palette token or hex.                                                                                                            |
| `dressing[].drift` | boolean | If `true`, the engine applies ambient drift animation (floating, swaying) to this glyph when the `drift` capability is active.   |

---

## vocab.json shape

A flat key → label map. The engine looks up UI label keys here before falling back to the key name itself. Labels may contain Unicode and emoji, but glyphs in the habitat panel still obey the allowlist.

```json
{
  "habitat": "Aquarium",
  "elevator": "Current",
  "lobby": "Reef"
}
```

---

## tokens.css

CSS custom properties pulled from `palette` and sizing. The engine reads `manifest.json` for runtime color values; `tokens.css` is for component stylesheet authors and hot-swap scenarios.

```css
:root {
  --skin-bg: #001f1c;
  --skin-fg: #00bfa5;
  --skin-accent: #80cbc4;
  --skin-alert: #ff5252;
  --skin-dim: #004d40;

  --skin-font-family: "JetBrains Mono", monospace;
  --skin-font-size: 14px;
  --skin-line-height: 1; /* must stay 1.0 — engine assumes line-height = cell-h */

  /* Placeholders — engine overwrites via JS after font measurement */
  --skin-cell-w: 9px;
  --skin-cell-h: 18px;
}
```

`--skin-cell-w` and `--skin-cell-h` are **placeholders**. The engine measures actual glyph dimensions at startup and overwrites them via inline style before first render. Do not hard-code cell dimensions in layout math that runs before the engine initialises.

---

## Rules

### Fallbacks rule

When a role is missing a state in `sprites.json`, the engine looks up `fallbacks.<state>` in `manifest.json` and renders the fallback state instead. If neither the requested state nor its fallback is defined, the engine falls back to `idle`. Example chain for a role that only defines `idle`:

```
celebrate → (fallbacks.celebrate = "working") → working → (fallbacks.working = "idle") → idle ✓
```

### Glyph allowlist rule

- Every glyph emitted by `sprites.json` or `habitat.json` must appear in `manifest.glyphAllowlist`.
- Glyphs not in the allowlist render as `▢` (U+25A2) with a dev-console warning.
- **Authors should include `"▢"` in `glyphAllowlist`** — otherwise the fallback glyph itself triggers a warning.
- The CI glyph-allowlist invariant test fails the build if any sprite or dressing glyph is missing from the manifest.

### font.asset rule

- **When `font.asset` is present:** path is relative to `manifest.json`. The engine loads the file via `@font-face` before the first render and surfaces a hard error if the fetch fails. Never ship a skin with a `font.asset` path that points to a missing file.
- **When `font.asset` is absent:** `font.family` must be a system-installed monospace font. The engine emits a startup error if it cannot measure the font. Community skins that name custom fonts **must** bundle the asset.

### Capability flags

Each capability is opt-in. Declaring a capability in `manifest.capabilities` activates the corresponding engine feature. The engine ignores unknown string values for forward compatibility — do not treat unknown capabilities as errors when parsing other authors' skins.

### x-\* extension namespace

Any `x-*` root key is permitted. The engine ignores all `x-*` keys. Authors use the namespace for documentation, tooling metadata, or experimental pre-standard fields. Convention: `x-<tool>-<purpose>`, e.g., `x-vscode-preview-scale`.

**Reserved key: `x-signature`** — see [Future: Signed manifest verification](#future-signed-manifest-verification) below.

### engineVersion range

The engine refuses to load a skin if `semver.satisfies(engine.version, manifest.engineVersion)` returns `false`. Author responsibility: test against the target engine range before publishing. The range `">=0.1.0 <0.2.0"` means "any 0.1.x engine."

### Cross-platform glyph rule

Every skin must pass the render-diff CI test on Windows, macOS, and Linux at 1× and 2× DPI. The CI matrix renders each skin's sprites and habitat in a headless Chromium instance with the bundled font, compares screenshots to platform-specific baselines, and fails the build on drift beyond 1 pixel.

**Skins that include glyphs not present in JetBrains Mono will fail CI.** Before publishing, verify your glyphs render correctly in JetBrains Mono. A safe heuristic: if it renders in a standard terminal using JetBrains Mono, it's in the font.

---

## Future: Signed manifest verification

> **Status:** Extension point only — v3+. The `x-signature` field is reserved in the schema now so community tools can prepare. The engine does not verify signatures in v1 or v2.

### What it will be

A **base64url-encoded Ed25519 signature** over the canonical-JSON encoding of the `manifest.json` object. The signing process removes the `x-signature` field itself before computing the canonical form, then signs the result.

```json
{
  "manifestVersion": 1,
  "name": "my-skin",
  ...
  "x-signature": "base64url(Ed25519.sign(privateKey, canonicalJSON))"
}
```

### Key format

- **Key type:** Ed25519 (RFC 8032)
- **Private key:** 32-byte seed, represented as PEM (`-----BEGIN PRIVATE KEY-----`) or raw hex for tooling
- **Public key:** 32-byte public key, published in a `keys.json` file alongside the skin's registry entry

### Canonical JSON rules

Before signing, the manifest object is serialised with:

1. All keys sorted alphabetically (deep, recursive)
2. `x-signature` key removed from the top level
3. No trailing whitespace; no indentation; UTF-8 encoding

### Verification flow (v3+)

1. Load `manifest.json`
2. Extract and remove `x-signature` from the object
3. Serialise to canonical JSON
4. Fetch the author's public key from the skin registry (`keys.json`)
5. Verify `Ed25519.verify(publicKey, canonicalJSON, base64urlDecode(x-signature))`
6. Reject the skin if verification fails

### Tooling (community)

Until the engine implements verification, community tools and CI pipelines may verify signatures independently using any Ed25519 implementation (e.g., `@noble/ed25519`, `libsodium`, `tweetnacl`).

---

## Minimal example skin

A complete, schema-valid skin at minimum size. All five files, one role, one state, one frame, two bands.

**`manifest.json`**

```json
{
  "manifestVersion": 1,
  "name": "minimal",
  "version": "0.1.0",
  "engineVersion": ">=0.1.0 <0.2.0",
  "license": "MIT",
  "author": { "name": "Your Name" },
  "font": { "family": "JetBrains Mono", "fallback": "monospace" },
  "palette": {
    "bg": "#000000",
    "fg": "#ffffff",
    "accent": "#aaaaff",
    "alert": "#ff0000",
    "dim": "#444444"
  },
  "glyphAllowlist": [" ", "X", ".", "-", "|", "~", "▢", "·"],
  "capabilities": ["bands"],
  "fallbacks": { "working": "idle", "blocked": "idle", "celebrate": "working" }
}
```

**`sprites.json`** (2 rows × 7 cols, lead only, idle only, 2 frames)

```json
{
  "roles": {
    "lead": {
      "states": {
        "idle": {
          "frames": [
            {
              "cells": [
                [
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": "X", "fg": "fg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" }
                ],
                [
                  { "glyph": "~", "fg": "dim", "bg": "bg" },
                  { "glyph": ".", "fg": "fg", "bg": "bg" },
                  { "glyph": "~", "fg": "dim", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" }
                ]
              ]
            },
            {
              "cells": [
                [
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": "X", "fg": "accent", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" }
                ],
                [
                  { "glyph": "~", "fg": "dim", "bg": "bg" },
                  { "glyph": ".", "fg": "fg", "bg": "bg" },
                  { "glyph": "-", "fg": "dim", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" },
                  { "glyph": " ", "fg": "bg", "bg": "bg" }
                ]
              ]
            }
          ]
        }
      }
    }
  }
}
```

**`habitat.json`** (2 bands, minimal dressing)

```json
{
  "bands": [
    {
      "id": "top",
      "role": "lead",
      "height": 4,
      "dressing": [{ "cell": { "row": 3, "col": 5 }, "glyph": "·", "color": "dim", "drift": true }]
    },
    { "id": "bottom", "role": "lead", "height": 4, "dressing": [] }
  ]
}
```

**`vocab.json`**

```json
{ "habitat": "Minimal" }
```

**`tokens.css`**

```css
:root {
  --skin-bg: #000000;
  --skin-fg: #ffffff;
  --skin-accent: #aaaaff;
  --skin-alert: #ff0000;
  --skin-dim: #444444;
  --skin-font-family: "JetBrains Mono", monospace;
  --skin-font-size: 14px;
  --skin-line-height: 1;
  --skin-cell-w: 9px;
  --skin-cell-h: 18px;
}
```

---

## Schema validation

Run from the repo root:

```sh
node skins/validate.mjs
```

Requires `ajv@8` in devDependencies (`pnpm add -D ajv`). Without ajv:

```sh
npx ajv-cli validate -s skins/manifest.schema.json \
    -d skins/aquarium/manifest.json --spec=draft2020
npx ajv-cli validate -s skins/manifest.schema.json \
    -d skins/office/manifest.json --spec=draft2020
```

The CI pipeline runs `node skins/validate.mjs` as a gating step before Playwright screenshot tests.
