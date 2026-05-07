import { describe, it, expect, vi, beforeEach } from "vitest";

const VALID_MANIFEST = {
  manifestVersion: 1,
  name: "test-skin",
  version: "0.1.0",
  engineVersion: ">=0.1.0",
  license: "MIT",
  author: { name: "Test" },
  font: { family: "JetBrains Mono", fallback: "monospace" },
  palette: {
    bg: "#001f1c",
    fg: "#00bfa5",
    accent: "#80cbc4",
    alert: "#ff5252",
    dim: "#004d40",
  },
  glyphAllowlist: [" ", "a", "b", "c", "d", "e", "f", "▢"],
};

function mockFetchWith(manifest: unknown) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith("manifest.json")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(manifest),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    } as Response);
  });
}

describe("skin loader validation", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { clearSkinCache } = await import("../../src/skin/loader.js");
    clearSkinCache();
  });

  it("loads a valid manifest", async () => {
    mockFetchWith(VALID_MANIFEST);
    const { loadSkin } = await import("../../src/skin/loader.js");
    const assets = await loadSkin("test-skin");
    expect(assets.manifest.name).toBe("test-skin");
  });

  it("rejects a manifest missing required fields", async () => {
    mockFetchWith({ manifestVersion: 1, name: "bad" });
    const { loadSkin } = await import("../../src/skin/loader.js");
    await expect(loadSkin("bad-skin")).rejects.toThrow();
  });

  it("rejects manifestVersion !== 1", async () => {
    mockFetchWith({ ...VALID_MANIFEST, manifestVersion: 2 });
    const { loadSkin } = await import("../../src/skin/loader.js");
    await expect(loadSkin("bad-skin")).rejects.toThrow(/manifestVersion/);
  });

  it("rejects missing space in glyphAllowlist", async () => {
    mockFetchWith({ ...VALID_MANIFEST, glyphAllowlist: ["a", "b", "c", "d", "e", "f", "g", "h"] });
    const { loadSkin } = await import("../../src/skin/loader.js");
    await expect(loadSkin("no-space")).rejects.toThrow(/space/);
  });

  it("rejects invalid palette hex", async () => {
    mockFetchWith({
      ...VALID_MANIFEST,
      palette: { ...VALID_MANIFEST.palette, bg: "notahex" },
    });
    const { loadSkin } = await import("../../src/skin/loader.js");
    await expect(loadSkin("bad-palette")).rejects.toThrow(/palette\.bg/);
  });
});
