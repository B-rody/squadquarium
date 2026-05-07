import { beforeEach, describe, expect, it } from "vitest";
import { defaultSettings, loadSettings, saveSettings } from "../../src/settings/store.js";

describe("settings store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips persisted settings", () => {
    const settings = { ...defaultSettings(), ambientSfx: true, crtBloom: true, moodGlyphs: false };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it("returns defaults when storage is missing", () => {
    expect(loadSettings()).toEqual(defaultSettings());
  });
});
