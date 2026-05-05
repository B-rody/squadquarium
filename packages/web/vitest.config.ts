import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Exclude Playwright e2e specs — those run via `pnpm test:e2e`
    exclude: ["test/e2e/**", "**/node_modules/**"],
  },
});
