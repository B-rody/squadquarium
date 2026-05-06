import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { browseMarketplace, listMarketplaces } from "../src/plugins/marketplace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, "fixtures");
const runtimeRoot = path.join(__dirname, ".runtime", "marketplace");

afterEach(() => {
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
});

describe("plugin marketplace backend", () => {
  it("lists default marketplaces plus configured entries", async () => {
    const marketplaces = await listMarketplaces(fixtureRoot);

    expect(marketplaces.map((entry) => entry.name)).toEqual([
      "anthropics/skills",
      "awesome-copilot",
      "internal-tools",
    ]);
  });

  it("browses marketplace index files when present", async () => {
    const indexDir = path.join(runtimeRoot, "plugins", "internal-tools");
    fs.mkdirSync(indexDir, { recursive: true });
    fs.writeFileSync(
      path.join(indexDir, "index.json"),
      JSON.stringify({ plugins: [{ name: "reef-metrics", version: "1.0.0" }] }),
    );

    await expect(browseMarketplace(runtimeRoot, "internal-tools")).resolves.toEqual([
      { name: "reef-metrics", version: "1.0.0", marketplace: "internal-tools" },
    ]);
  });

  it("returns an empty list for missing marketplace indexes", async () => {
    await expect(browseMarketplace(runtimeRoot, "missing")).resolves.toEqual([]);
  });
});
