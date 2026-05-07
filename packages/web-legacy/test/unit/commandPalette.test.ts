import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import CommandPalette, {
  completeCommandVerb,
  parseCommand,
} from "../../src/components/CommandPalette.js";

describe("CommandPalette", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("parses commands", () => {
    expect(parseCommand(":skin aquarium")).toEqual({ verb: "skin", args: ["aquarium"] });
  });

  it("cycles history backwards with arrow-up", () => {
    localStorage.setItem("squadquarium:cmd-history", JSON.stringify([":skin aquarium", ":wisdom"]));
    act(() => {
      root.render(
        React.createElement(CommandPalette, {
          open: true,
          onClose: vi.fn(),
          onSkinChange: vi.fn(),
          onInteractive: vi.fn(),
          onOpenScrubber: vi.fn(),
          onOpenWisdom: vi.fn(),
          onOpenSettings: vi.fn(),
          onRalphStop: vi.fn(),
        }),
      );
    });
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    act(() => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });
    expect(input?.value).toBe(":wisdom");
  });

  it("completes the verb on tab", () => {
    expect(completeCommandVerb(":wi")).toBe(":wisdom");
  });
});
