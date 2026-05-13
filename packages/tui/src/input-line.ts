import { EventEmitter } from "node:events";

import type { ColorValue } from "./palette.js";
import type { Rect } from "./types.js";

const TAB_COMPLETIONS = ["help", "inspect", "team", "clear", "exit", "quit", "status"];

export interface InputLineColors {
  promptColor: ColorValue;
  textColor: ColorValue;
  hintColor: ColorValue;
  bgColor: ColorValue;
}

export class InputLine extends EventEmitter<{ command: [string] }> {
  private readonly prompt: string;
  private readonly history: string[] = [];
  private value = "";
  private cursor = 0;
  private historyIndex: number | null = null;
  private focused = true;

  public constructor(prompt = "sqq> ") {
    super();
    this.prompt = prompt;
  }

  public focus(): void {
    this.focused = true;
  }

  public blur(): void {
    this.focused = false;
  }

  public isFocused(): boolean {
    return this.focused;
  }

  public getValue(): string {
    return this.value;
  }

  public getPrompt(): string {
    return this.prompt;
  }

  public handleKey(name: string): boolean {
    if (!this.focused) {
      return false;
    }

    switch (name) {
      case "ENTER": {
        const command = this.value.trim();
        if (command.length > 0) {
          this.history.push(command);
        }
        this.historyIndex = null;
        this.value = "";
        this.cursor = 0;
        this.emit("command", command);
        return true;
      }
      case "BACKSPACE": {
        if (this.cursor > 0) {
          this.value = `${this.value.slice(0, this.cursor - 1)}${this.value.slice(this.cursor)}`;
          this.cursor -= 1;
        }
        return true;
      }
      case "DELETE": {
        if (this.cursor < this.value.length) {
          this.value = `${this.value.slice(0, this.cursor)}${this.value.slice(this.cursor + 1)}`;
        }
        return true;
      }
      case "LEFT": {
        this.cursor = Math.max(0, this.cursor - 1);
        return true;
      }
      case "RIGHT": {
        this.cursor = Math.min(this.value.length, this.cursor + 1);
        return true;
      }
      case "HOME": {
        this.cursor = 0;
        return true;
      }
      case "END": {
        this.cursor = this.value.length;
        return true;
      }
      case "UP": {
        this.recallHistory(-1);
        return true;
      }
      case "DOWN": {
        this.recallHistory(1);
        return true;
      }
      case "TAB": {
        this.applyTabCompletion();
        return true;
      }
      default: {
        if (isPrintableCharacter(name)) {
          this.value = `${this.value.slice(0, this.cursor)}${name}${this.value.slice(this.cursor)}`;
          this.cursor += name.length;
          this.historyIndex = null;
          return true;
        }
        return false;
      }
    }
  }

  public render(buffer: BufferWriter, rect: Rect, colors: InputLineColors): void {
    const textAttr = { color: colors.textColor, bgColor: colors.bgColor };
    buffer.fill({
      char: " ",
      attr: textAttr,
      region: { x: 0, y: 0, width: rect.width, height: rect.height },
    });

    const prompt = this.prompt.slice(0, rect.width);
    buffer.put(
      { x: 0, y: 0, attr: { color: colors.promptColor, bgColor: colors.bgColor } },
      prompt,
    );

    const availableWidth = Math.max(0, rect.width - prompt.length);
    if (availableWidth > 0) {
      const inputText = injectCursor(this.value, this.cursor);
      const visibleInput =
        inputText.length > availableWidth
          ? inputText.slice(inputText.length - availableWidth)
          : inputText;
      buffer.put({ x: prompt.length, y: 0, attr: textAttr }, visibleInput);
    }

    if (rect.height > 1) {
      const hint = "Enter=send  Try: inspect Lambert  Chat bridge: @Dallas <msg>";
      buffer.put(
        { x: 0, y: 1, attr: { color: colors.hintColor, bgColor: colors.bgColor } },
        hint.slice(0, rect.width),
      );
    }
  }

  private recallHistory(direction: -1 | 1): void {
    if (this.history.length === 0) {
      return;
    }

    if (direction === -1) {
      this.historyIndex =
        this.historyIndex === null ? this.history.length - 1 : Math.max(0, this.historyIndex - 1);
      this.value = this.history[this.historyIndex] ?? "";
    } else if (this.historyIndex === null) {
      this.value = "";
    } else {
      const nextIndex = this.historyIndex + 1;
      if (nextIndex >= this.history.length) {
        this.historyIndex = null;
        this.value = "";
      } else {
        this.historyIndex = nextIndex;
        this.value = this.history[nextIndex] ?? "";
      }
    }

    this.cursor = this.value.length;
  }

  private applyTabCompletion(): void {
    const prefix = this.value.trim();
    if (prefix.length === 0) {
      return;
    }

    const matches = TAB_COMPLETIONS.filter((candidate) => candidate.startsWith(prefix));
    if (matches.length === 1) {
      this.value = matches[0] ?? this.value;
      this.cursor = this.value.length;
    }
  }
}

interface BufferWriter {
  fill(options?: unknown): void;
  put(options: { x: number; y: number; attr?: Record<string, unknown> }, text?: string): void;
}

function injectCursor(text: string, index: number): string {
  const clampedIndex = Math.max(0, Math.min(index, text.length));
  return `${text.slice(0, clampedIndex)}_${text.slice(clampedIndex)}`;
}

function isPrintableCharacter(name: string): boolean {
  return name.length === 1 && name >= " " && name !== "\u007f";
}
