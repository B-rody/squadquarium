import { describe, expect, it } from "vitest";
import { startApp, stopApp } from "../src/app.js";

describe("app", () => {
  it("starts and stops in headless smoke mode", async () => {
    await expect(
      startApp({ headless: true, smokeTest: true, headlessSize: { width: 80, height: 24 } }),
    ).resolves.toBeUndefined();

    await expect(stopApp()).resolves.toBeUndefined();
  }, 15_000);
});
