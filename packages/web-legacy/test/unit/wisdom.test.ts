import { describe, it, expect } from "vitest";
import { parseWisdomPatterns } from "../../src/components/WisdomWing.js";

describe("parseWisdomPatterns", () => {
  it("returns [] for empty input", () => {
    expect(parseWisdomPatterns("")).toEqual([]);
  });

  it("parses one pattern", () => {
    expect(
      parseWisdomPatterns(
        "**Pattern:** Keep canvas and CSS motion separate. **Context:** Renderer overlays.",
      ),
    ).toEqual([{ title: "Keep canvas and CSS motion separate.", context: "Renderer overlays." }]);
  });

  it("parses actual wisdom.md style entries", () => {
    const markdown = `---
last_updated: 2026-05-05T22:30:00Z
---

# Team Wisdom

<!-- Append entries below. Format: **Pattern:** description. **Context:** when it applies. -->

**Pattern:** Always run \`pnpm install --frozen-lockfile\` in CI. **Context:** Every CI job that installs deps.

**Pattern:** In vitest configs for packages that share a directory with Playwright e2e specs, always exclude e2e specs.
**Context:** packages/web and any future UI package.
`;
    expect(parseWisdomPatterns(markdown)).toEqual([
      {
        title: "Always run `pnpm install --frozen-lockfile` in CI.",
        context: "Every CI job that installs deps.",
      },
      {
        title:
          "In vitest configs for packages that share a directory with Playwright e2e specs, always exclude e2e specs.",
        context: "packages/web and any future UI package.",
      },
    ]);
  });
});
