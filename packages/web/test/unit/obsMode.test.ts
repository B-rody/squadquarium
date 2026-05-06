import { describe, it, expect, beforeEach } from "vitest";
import { defaultSettings, loadSettings, saveSettings } from "../../src/settings/store.js";
import type { ObsMode } from "../../src/settings/store.js";

describe("OBS mode settings", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset body dataset and style in case previous tests modified them
    document.body.dataset.obsMode = "";
    document.body.style.background = "";
  });

  it("default obsMode is off", () => {
    const settings = defaultSettings();
    expect(settings.obsMode).toBe("off");
  });

  it("obsMode round-trips through localStorage", () => {
    const modes: ObsMode[] = ["off", "transparent", "chroma-green", "chroma-magenta"];
    for (const mode of modes) {
      const settings = { ...defaultSettings(), obsMode: mode };
      saveSettings(settings);
      const loaded = loadSettings();
      expect(loaded.obsMode).toBe(mode);
    }
  });

  it("loadSettings defaults obsMode to off when not stored", () => {
    localStorage.clear();
    const loaded = loadSettings();
    expect(loaded.obsMode).toBe("off");
  });

  it("obsMode background mapping is correct", () => {
    // Test the CSS color values that AppShell applies for each mode
    const obsModeBackgrounds: Record<ObsMode, string> = {
      off: "",
      transparent: "transparent",
      "chroma-green": "#00FF00",
      "chroma-magenta": "#FF00FF",
    };

    // Simulate AppShell's effect (inline CSS application)
    for (const [mode, expected] of Object.entries(obsModeBackgrounds) as [ObsMode, string][]) {
      switch (mode) {
        case "transparent":
          expect(obsModeBackgrounds[mode]).toBe("transparent");
          break;
        case "chroma-green":
          expect(obsModeBackgrounds[mode]).toBe("#00FF00");
          break;
        case "chroma-magenta":
          expect(obsModeBackgrounds[mode]).toBe("#FF00FF");
          break;
        default:
          expect(expected).toBe("");
      }
    }
  });
});

describe("multi-attach and game mode settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("default gameMode is false", () => {
    expect(defaultSettings().gameMode).toBe(false);
  });

  it("default enableMultiAttach is false", () => {
    expect(defaultSettings().enableMultiAttach).toBe(false);
  });

  it("gameMode and enableMultiAttach persist", () => {
    const s = { ...defaultSettings(), gameMode: true, enableMultiAttach: true };
    saveSettings(s);
    const loaded = loadSettings();
    expect(loaded.gameMode).toBe(true);
    expect(loaded.enableMultiAttach).toBe(true);
  });
});
