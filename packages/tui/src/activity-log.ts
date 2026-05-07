import type { LogEntry, Rect } from "./types.js";

const DEFAULT_CAPACITY = 500;

export class ActivityLog {
  private readonly capacity: number;
  private readonly entries: LogEntry[] = [];
  private scrollOffset = 0;

  public constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity;
  }

  public add(message: string, timestamp = formatTimestamp(new Date())): void {
    this.entries.push({ timestamp, message });
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
    this.scrollOffset = 0;
  }

  public clear(): void {
    this.entries.length = 0;
    this.scrollOffset = 0;
  }

  public scroll(delta: number): void {
    this.scrollOffset = clamp(this.scrollOffset + delta, 0, this.getMaxScrollOffset());
  }

  public handleWheel(direction: "up" | "down"): void {
    this.scroll(direction === "up" ? 1 : -1);
  }

  public getEntries(): readonly LogEntry[] {
    return this.entries;
  }

  public getScrollOffset(): number {
    return this.scrollOffset;
  }

  public getVisibleLines(height: number): string[] {
    const lines = this.entries.map((entry) => `[${entry.timestamp}] ${entry.message}`);
    const visible: string[] = [];
    const lastIndex = lines.length - 1 - this.scrollOffset;

    for (let index = lastIndex; index >= 0 && visible.length < height; index -= 1) {
      visible.unshift(lines[index]);
    }

    return visible;
  }

  public render(buffer: BufferWriter, rect: Rect): void {
    fillRegion(buffer, rect.width, rect.height);
    const visibleLines = this.getVisibleLines(rect.height);
    const startY = Math.max(0, rect.height - visibleLines.length);

    visibleLines.forEach((line, index) => {
      buffer.put({ x: 0, y: startY + index }, fitToWidth(line, rect.width));
    });
  }

  private getMaxScrollOffset(): number {
    return Math.max(0, this.entries.length - 1);
  }
}

interface BufferWriter {
  fill(options?: unknown): void;
  put(options: { x: number; y: number }, text?: string): void;
}

function fillRegion(buffer: BufferWriter, width: number, height: number): void {
  buffer.fill({ char: " ", region: { x: 0, y: 0, width, height } });
}

function fitToWidth(text: string, width: number): string {
  return text.length > width ? text.slice(0, width) : text.padEnd(width, " ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatTimestamp(date: Date): string {
  return date.toTimeString().slice(0, 8);
}
