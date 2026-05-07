export interface PutCall {
  x: number;
  y: number;
  attr: unknown;
  char: string;
}

export interface FillCall {
  attr: unknown;
  char: string;
}

export interface MockCell {
  char: string;
  attr: unknown;
}

export interface MockScreenBuffer {
  width: number;
  height: number;
  putCalls: PutCall[];
  fillCalls: FillCall[];
  drawCalls: number;
  cells: Map<string, MockCell>;
  put(options: { x: number; y: number; attr?: unknown }, text: string): MockScreenBuffer;
  fill(options: { attr?: unknown; char?: string }): MockScreenBuffer;
  draw(): void;
  charAt(x: number, y: number): string | undefined;
  attrAt(x: number, y: number): unknown;
  readLine(y: number): string;
}

function keyFor(x: number, y: number): string {
  return `${x},${y}`;
}

export function createMockBuffer(width: number, height: number): MockScreenBuffer {
  const cells = new Map<string, MockCell>();
  const putCalls: PutCall[] = [];
  const fillCalls: FillCall[] = [];

  const buffer: MockScreenBuffer = {
    width,
    height,
    putCalls,
    fillCalls,
    drawCalls: 0,
    cells,
    put({ x, y, attr }, text) {
      putCalls.push({ x, y, attr, char: text });

      for (const [offset, glyph] of Array.from(text).entries()) {
        const drawX = x + offset;
        if (drawX < 0 || drawX >= width || y < 0 || y >= height) {
          continue;
        }

        cells.set(keyFor(drawX, y), { char: glyph, attr });
      }

      return buffer;
    },
    fill({ attr, char = " " }) {
      fillCalls.push({ attr, char });

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          cells.set(keyFor(x, y), { char, attr });
        }
      }

      return buffer;
    },
    draw() {
      buffer.drawCalls += 1;
    },
    charAt(x, y) {
      return cells.get(keyFor(x, y))?.char;
    },
    attrAt(x, y) {
      return cells.get(keyFor(x, y))?.attr;
    },
    readLine(y) {
      let line = "";
      for (let x = 0; x < width; x += 1) {
        line += cells.get(keyFor(x, y))?.char ?? " ";
      }
      return line;
    },
  };

  return buffer;
}
