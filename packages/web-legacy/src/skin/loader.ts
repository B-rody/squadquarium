export interface SkinManifest {
  manifestVersion: 1;
  name: string;
  version: string;
  engineVersion: string;
  license: string;
  author: { name: string; url?: string };
  font: { family: string; fallback: string; asset?: string };
  palette: Record<string, string>;
  glyphAllowlist: string[];
  capabilities?: string[];
  fallbacks?: Record<string, string>;
  [key: string]: unknown;
}

export interface SkinAssets {
  manifest: SkinManifest;
  sprites: unknown;
  habitat: unknown;
  vocab: Record<string, string>;
  tokensCSS: string;
}

const REQUIRED_PALETTE = ["bg", "fg", "accent", "alert", "dim"] as const;
const REQUIRED_MANIFEST_KEYS = [
  "manifestVersion",
  "name",
  "version",
  "engineVersion",
  "license",
  "author",
  "font",
  "palette",
  "glyphAllowlist",
] as const;

function validateManifest(obj: unknown, name: string): SkinManifest {
  if (typeof obj !== "object" || obj === null) {
    throw new Error(`[skin:${name}] manifest is not an object`);
  }
  const m = obj as Record<string, unknown>;

  for (const key of REQUIRED_MANIFEST_KEYS) {
    if (!(key in m)) {
      throw new Error(`[skin:${name}] manifest missing required field: ${key}`);
    }
  }
  if (m.manifestVersion !== 1) {
    throw new Error(`[skin:${name}] manifestVersion must be 1, got: ${String(m.manifestVersion)}`);
  }
  if (typeof m.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(m.name)) {
    throw new Error(`[skin:${name}] name must be a kebab-case string`);
  }
  if (typeof m.palette !== "object" || m.palette === null) {
    throw new Error(`[skin:${name}] palette must be an object`);
  }
  const palette = m.palette as Record<string, unknown>;
  for (const k of REQUIRED_PALETTE) {
    if (typeof palette[k] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(palette[k] as string)) {
      throw new Error(`[skin:${name}] palette.${k} must be a 6-digit hex color`);
    }
  }
  if (!Array.isArray(m.glyphAllowlist) || m.glyphAllowlist.length < 8) {
    throw new Error(`[skin:${name}] glyphAllowlist must be an array with at least 8 entries`);
  }
  if (!(m.glyphAllowlist as string[]).includes(" ")) {
    throw new Error(`[skin:${name}] glyphAllowlist must include a space character`);
  }

  return m as unknown as SkinManifest;
}

const cache = new Map<string, SkinAssets>();

export async function loadSkin(name: string): Promise<SkinAssets> {
  if (cache.has(name)) return cache.get(name)!;

  const base = `/skins/${name}`;

  const [manifestRes, spritesRes, habitatRes, vocabRes, tokensRes] = await Promise.all([
    fetch(`${base}/manifest.json`),
    fetch(`${base}/sprites.json`),
    fetch(`${base}/habitat.json`),
    fetch(`${base}/vocab.json`),
    fetch(`${base}/tokens.css`),
  ]);

  if (!manifestRes.ok) {
    throw new Error(`[skin:${name}] failed to load manifest.json (${manifestRes.status})`);
  }

  const rawManifest: unknown = await manifestRes.json();
  let manifest: SkinManifest;
  try {
    manifest = validateManifest(rawManifest, name);
  } catch (err) {
    console.error(`[squadquarium] skin validation failed for "${name}":`, err);
    throw err;
  }

  const sprites = spritesRes.ok ? await spritesRes.json() : {};
  const habitat = habitatRes.ok ? await habitatRes.json() : { bands: [] };
  const vocab = vocabRes.ok ? ((await vocabRes.json()) as Record<string, string>) : {};
  const tokensCSS = tokensRes.ok ? await tokensRes.text() : "";

  const assets: SkinAssets = { manifest, sprites, habitat, vocab, tokensCSS };
  cache.set(name, assets);
  return assets;
}

export function clearSkinCache(): void {
  cache.clear();
}
