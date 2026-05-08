import type { ColorValue } from "./palette.js";
import type { LogEntry, Rect } from "./types.js";

const DEFAULT_CAPACITY = 500;

export interface ActivityLogColors {
  timestampColor: ColorValue;
  color: ColorValue;
  bgColor: ColorValue;
}

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
    return this.getVisibleEntries(height).map(formatEntry);
  }

  public render(buffer: BufferWriter, rect: Rect, colors: ActivityLogColors): void {
    fillRegion(buffer, rect.width, rect.height, {
      color: colors.color,
      bgColor: colors.bgColor,
    });
    const visibleEntries = this.getVisibleEntries(rect.height);
    const startY = Math.max(0, rect.height - visibleEntries.length);

    visibleEntries.forEach((entry, index) => {
      renderEntry(buffer, startY + index, rect.width, entry, colors);
    });
  }

  private getVisibleEntries(height: number): LogEntry[] {
    const visible: LogEntry[] = [];
    const lastIndex = this.entries.length - 1 - this.scrollOffset;

    for (let index = lastIndex; index >= 0 && visible.length < height; index -= 1) {
      const entry = this.entries[index];
      if (entry) {
        visible.unshift(entry);
      }
    }

    return visible;
  }

  private getMaxScrollOffset(): number {
    return Math.max(0, this.entries.length - 1);
  }
}

interface BufferWriter {
  fill(options?: unknown): void;
  put(options: { x: number; y: number; attr?: Record<string, unknown> }, text?: string): void;
}

function fillRegion(
  buffer: BufferWriter,
  width: number,
  height: number,
  attr: Record<string, unknown>,
): void {
  buffer.fill({ char: " ", attr, region: { x: 0, y: 0, width, height } });
}

function renderEntry(
  buffer: BufferWriter,
  y: number,
  width: number,
  entry: LogEntry,
  colors: ActivityLogColors,
): void {
  if (width <= 0) {
    return;
  }

  const timestampText = `[${entry.timestamp}] `;
  const visibleTimestamp = timestampText.slice(0, width);
  buffer.put(
    {
      x: 0,
      y,
      attr: { color: colors.timestampColor, bgColor: colors.bgColor },
    },
    visibleTimestamp,
  );

  if (visibleTimestamp.length >= width) {
    return;
  }

  const message = entry.message.slice(0, width - visibleTimestamp.length);
  buffer.put(
    {
      x: visibleTimestamp.length,
      y,
      attr: { color: colors.color, bgColor: colors.bgColor },
    },
    message,
  );
}

function formatEntry(entry: LogEntry): string {
  return `[${entry.timestamp}] ${entry.message}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatTimestamp(date: Date): string {
  return date.toTimeString().slice(0, 8);
}
