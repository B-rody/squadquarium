export interface AppSettings {
  ambientSfx: boolean;
  alwaysOnTop: boolean;
  crtBloom: boolean;
  crtScanlines: boolean;
  voiceBubbles: boolean;
  moodGlyphs: boolean;
}

const STORAGE_KEY = "squadquarium:settings";

export function defaultSettings(): AppSettings {
  return {
    ambientSfx: false,
    alwaysOnTop: false,
    crtBloom: false,
    crtScanlines: false,
    voiceBubbles: true,
    moodGlyphs: true,
  };
}

export function loadSettings(): AppSettings {
  if (typeof localStorage === "undefined") return defaultSettings();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultSettings();
  try {
    return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
