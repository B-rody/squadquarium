import { describe, expect, it } from "vitest";
import { detectCapabilities } from "../src/adaptive.js";

describe("detectCapabilities", () => {
  it("detects truecolor from COLORTERM", () => {
    const caps = detectCapabilities({ COLORTERM: "truecolor" });

    expect(caps.truecolor).toBe(true);
  });

  it("treats missing COLORTERM as non-truecolor by default", () => {
    const caps = detectCapabilities({ TERM: "xterm-256color" });

    expect(caps.truecolor).toBe(false);
  });

  it("captures TERM_PROGRAM when present", () => {
    const caps = detectCapabilities({ TERM_PROGRAM: "WindowsTerminal", LANG: "en_US.UTF-8" });

    expect(caps.termProgram).toBe("windowsterminal");
    expect(caps.unicode).toBe(true);
  });

  it("detects Windows Terminal via WT_SESSION", () => {
    const caps = detectCapabilities({ WT_SESSION: "1" });

    expect(caps.windowsTerminal).toBe(true);
  });
});
