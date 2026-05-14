import type { ColorValue } from "./palette.js";
import type { Rect } from "./types.js";

const MAX_LINES = 500;

export interface CopilotPaneColors {
  fg: ColorValue;
  bg: ColorValue;
  dim: ColorValue;
  accent?: ColorValue;
}

/**
 * Scrollable transcript renderer for Copilot SDK output plus a single-line prompt.
 */
export class CopilotPane {
  private lines: string[] = [];
  private scrollOffset = 0;
  private partial = "";
  private input = "";
  private inputHint: string | null = null;
  private inputStatus: string | null = null;
  private inputSuggestion: string | null = null;

  get lineCount(): number {
    return this.lines.length;
  }

  /** Append streamed output (ANSI is stripped defensively for SDK/tool output). */
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

  appendInput(text: string): void {
    this.input += text;
  }

  setInput(text: string): void {
    this.input = text;
  }

  backspaceInput(): void {
    this.input = this.input.slice(0, -1);
  }

  clearInput(): void {
    this.input = "";
  }

  consumeInput(): string {
    const value = this.input;
    this.input = "";
    return value;
  }

  getInput(): string {
    return this.input;
  }

  setInputHint(hint: string | null): void {
    this.inputHint = hint;
  }

  setInputStatus(status: string | null): void {
    this.inputStatus = status;
  }

  setInputSuggestion(suggestion: string | null): void {
    this.inputSuggestion = suggestion;
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

  getTranscriptText(): string {
    const lines = [...this.lines];
    if (this.partial.length > 0) {
      lines.push(this.partial);
    }
    return lines.join("\n");
  }

  /** Render into a ScreenBuffer-like object. */
  render(buffer: BufferWriter, rect: Rect, colors: CopilotPaneColors): void {
    buffer.fill({
      char: " ",
      attr: { color: colors.fg, bgColor: colors.bg },
      region: { x: 0, y: 0, width: rect.width, height: rect.height },
    });

    const transcriptHeight = Math.max(0, rect.height - 1);
    const visible = this.getVisibleLines(transcriptHeight);
    const startY = Math.max(0, transcriptHeight - visible.length);

    for (let i = 0; i < visible.length; i++) {
      const line = visible[i] ?? "";
      const y = startY + i;
      if (y >= transcriptHeight) break;

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
    if (this.scrollOffset > 0 && transcriptHeight > 1) {
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

    if (rect.height > 0) {
      const inputPrefix = `> ${this.input}`;
      const inputLine = this.inputHint ?? inputPrefix;
      const inputY = rect.height - 1;
      buffer.put(
        {
          x: 0,
          y: inputY,
          attr: { color: colors.accent ?? colors.fg, bgColor: colors.bg },
        },
        inputLine.slice(0, rect.width),
      );

      if (!this.inputHint && this.inputSuggestion && inputPrefix.length < rect.width) {
        buffer.put(
          {
            x: inputPrefix.length,
            y: inputY,
            attr: { color: colors.dim, bgColor: colors.bg },
          },
          this.inputSuggestion.slice(0, rect.width - inputPrefix.length),
        );
      }

      const decoratedInputLength =
        inputLine.length +
        (!this.inputHint && this.inputSuggestion ? this.inputSuggestion.length : 0);
      if (!this.inputHint && this.inputStatus && rect.width > decoratedInputLength + 4) {
        const status = truncateLeft(
          this.inputStatus,
          Math.max(0, rect.width - decoratedInputLength - 4),
        );
        buffer.put(
          {
            x: Math.max(decoratedInputLength + 2, rect.width - status.length),
            y: inputY,
            attr: { color: colors.dim, bgColor: colors.bg },
          },
          status,
        );
      }
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

function truncateLeft(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return text.slice(0, maxLength);
  return `…${text.slice(-(maxLength - 1))}`;
}
