import type { ColorValue } from "./palette.js";
import type { Rect } from "./types.js";

const MAX_LINES = 500;

export interface CopilotPaneColors {
  fg: ColorValue;
  bg: ColorValue;
  dim: ColorValue;
}

/**
 * Simple line-buffer renderer for PTY output in the copilot pane.
 * Strips ANSI escape sequences and renders as scrollable text.
 * Not a full terminal emulator — v1 upgrade path.
 */
export class CopilotPane {
  private lines: string[] = [];
  private scrollOffset = 0;
  private partial = "";

  get lineCount(): number {
    return this.lines.length;
  }

  /** Append raw PTY output (may contain partial lines, ANSI codes). */
  write(data: string): void {
    const clean = stripAnsi(this.partial + data);
    const parts = clean.split("\n");
    this.partial = parts.pop() ?? "";

    for (const part of parts) {
      this.lines.push(part);
    }

    // Trim to capacity
    if (this.lines.length > MAX_LINES) {
      this.lines.splice(0, this.lines.length - MAX_LINES);
    }

    // Auto-scroll to bottom on new output
    this.scrollOffset = 0;
  }

  /** Flush any partial line as a complete line. */
  flush(): void {
    if (this.partial.length > 0) {
      this.lines.push(this.partial);
      this.partial = "";
    }
  }

  clear(): void {
    this.lines = [];
    this.partial = "";
    this.scrollOffset = 0;
  }

  scroll(delta: number): void {
    const max = Math.max(0, this.lines.length - 1);
    this.scrollOffset = Math.max(0, Math.min(max, this.scrollOffset + delta));
  }

  /** Get visible lines for a given height. */
  getVisibleLines(height: number): string[] {
    const endIndex = this.lines.length - this.scrollOffset;
    const startIndex = Math.max(0, endIndex - height);
    return this.lines.slice(startIndex, endIndex);
  }

  /** Render into a ScreenBuffer-like object. */
  render(buffer: BufferWriter, rect: Rect, colors: CopilotPaneColors): void {
    buffer.fill({
      char: " ",
      attr: { color: colors.fg, bgColor: colors.bg },
      region: { x: 0, y: 0, width: rect.width, height: rect.height },
    });

    const visible = this.getVisibleLines(rect.height);
    const startY = Math.max(0, rect.height - visible.length);

    for (let i = 0; i < visible.length; i++) {
      const line = visible[i] ?? "";
      const y = startY + i;
      if (y >= rect.height) break;

      buffer.put(
        {
          x: 0,
          y,
          attr: { color: colors.fg, bgColor: colors.bg },
        },
        line.slice(0, rect.width),
      );
    }

    // Show scroll indicator if not at bottom
    if (this.scrollOffset > 0 && rect.height > 1) {
      const indicator = `↑ ${this.scrollOffset} more`;
      buffer.put(
        {
          x: Math.max(0, rect.width - indicator.length),
          y: 0,
          attr: { color: colors.dim, bgColor: colors.bg },
        },
        indicator,
      );
    }
  }
}

interface BufferWriter {
  fill(options?: unknown): void;
  put(options: { x: number; y: number; attr?: Record<string, unknown> }, text?: string): void;
}

/** Strip ANSI escape sequences from text. */
export function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*[A-Za-z]|\x1B\][^\x07]*\x07|\x1B[()][A-B012]|\r/g, "");
}
