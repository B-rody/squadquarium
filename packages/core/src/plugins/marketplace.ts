import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface MarketplaceEntry {
  name: string;
  url?: string;
  description?: string;
}

export interface PluginMeta {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  marketplace: string;
}

export interface MarketplacesConfig {
  marketplaces: MarketplaceEntry[];
}

const DEFAULT_MARKETPLACES: MarketplaceEntry[] = [
  { name: "anthropics/skills", description: "Official Anthropic skill collection" },
  { name: "awesome-copilot", description: "Community-curated Copilot plugins" },
];

export async function listMarketplaces(squadRoot: string): Promise<MarketplaceEntry[]> {
  const configured = await readMarketplacesConfig(
    path.join(squadRoot, "plugins", "marketplaces.json"),
  );
  const merged = new Map<string, MarketplaceEntry>();
  for (const entry of DEFAULT_MARKETPLACES) merged.set(entry.name, entry);
  for (const entry of configured.marketplaces) merged.set(entry.name, entry);
  return [...merged.values()];
}

export async function browseMarketplace(squadRoot: string, name: string): Promise<PluginMeta[]> {
  const indexPath = path.join(squadRoot, "plugins", name, "index.json");
  try {
    const raw = await fs.promises.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as {
      plugins?: Array<Omit<PluginMeta, "marketplace"> & { marketplace?: string }>;
    };
    return (parsed.plugins ?? [])
      .filter((plugin) => typeof plugin.name === "string")
      .map((plugin) => ({ ...plugin, marketplace: plugin.marketplace ?? name }));
  } catch {
    return [];
  }
}

export function installPlugin(
  squadRoot: string,
  marketplace: string,
  pluginName: string,
  onData: (data: string) => void,
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("squad", ["plugin", "install", `${marketplace}/${pluginName}`], {
      cwd: path.dirname(squadRoot),
      shell: process.platform === "win32",
    });

    child.stdout?.on("data", (chunk: Buffer) => onData(chunk.toString("utf8")));
    child.stderr?.on("data", (chunk: Buffer) => onData(chunk.toString("utf8")));
    child.on("error", (err) => {
      onData(`${err.message}\n`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function readMarketplacesConfig(file: string): Promise<MarketplacesConfig> {
  try {
    const raw = await fs.promises.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<MarketplacesConfig>;
    return { marketplaces: (parsed.marketplaces ?? []).filter(isMarketplaceEntry) };
  } catch {
    return { marketplaces: [] };
  }
}

function isMarketplaceEntry(value: unknown): value is MarketplaceEntry {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === "string";
}
