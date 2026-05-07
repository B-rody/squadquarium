const DEFAULT_PALETTE = {
  bg: "#001b2e",
  fg: "#f4fbff",
  accent: "#ffd166",
  alert: "#ef476f",
  dim: "#6b8ca3",
} satisfies Record<string, string>;

const ANSI_16 = [
  [0x00, 0x00, 0x00],
  [0x80, 0x00, 0x00],
  [0x00, 0x80, 0x00],
  [0x80, 0x80, 0x00],
  [0x00, 0x00, 0x80],
  [0x80, 0x00, 0x80],
  [0x00, 0x80, 0x80],
  [0xc0, 0xc0, 0xc0],
  [0x80, 0x80, 0x80],
  [0xff, 0x00, 0x00],
  [0x00, 0xff, 0x00],
  [0xff, 0xff, 0x00],
  [0x00, 0x00, 0xff],
  [0xff, 0x00, 0xff],
  [0x00, 0xff, 0xff],
  [0xff, 0xff, 0xff],
] as const;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHex(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : DEFAULT_PALETTE.fg;
}

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, "0")).join("")}`;
}

function dimRgb(rgb: Rgb): Rgb {
  return {
    r: clamp(rgb.r * 0.6),
    g: clamp(rgb.g * 0.6),
    b: clamp(rgb.b * 0.6),
  };
}

function distance(a: Rgb, b: Rgb): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

function toAnsi16(rgb: Rgb): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  ANSI_16.forEach((candidate, index) => {
    const candidateRgb = { r: candidate[0], g: candidate[1], b: candidate[2] };
    const candidateDistance = distance(rgb, candidateRgb);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function toAnsi256(rgb: Rgb): number {
  const components = [rgb.r, rgb.g, rgb.b];
  const cube = components.map((value) => Math.round((value / 255) * 5));
  const cubeIndex = 16 + 36 * cube[0] + 6 * cube[1] + cube[2];

  const average = Math.round((rgb.r + rgb.g + rgb.b) / 3);
  const grayscaleStep =
    average < 8 ? 0 : average > 248 ? 23 : Math.round(((average - 8) / 247) * 23);
  const grayscaleIndex = 232 + grayscaleStep;

  const cubeRgb = {
    r: cube[0] === 0 ? 0 : 55 + cube[0] * 40,
    g: cube[1] === 0 ? 0 : 55 + cube[1] * 40,
    b: cube[2] === 0 ? 0 : 55 + cube[2] * 40,
  };
  const grayLevel = grayscaleStep === 0 ? 8 : 8 + grayscaleStep * 10;
  const grayRgb = { r: grayLevel, g: grayLevel, b: grayLevel };

  return distance(rgb, cubeRgb) <= distance(rgb, grayRgb) ? cubeIndex : grayscaleIndex;
}

function supports256ColorFallback(): boolean {
  const term = process.env.TERM ?? "";
  return (
    /256(color)?/i.test(term) ||
    Boolean(process.env.WT_SESSION) ||
    Boolean(process.env.KONSOLE_VERSION)
  );
}

export class Palette {
  private readonly palette: Record<string, string>;
  private readonly truecolor: boolean;
  private readonly use256Color: boolean;

  constructor(skinPalette: Record<string, string>, capabilities: { truecolor: boolean }) {
    this.palette = {
      ...DEFAULT_PALETTE,
      ...skinPalette,
    };
    this.truecolor = capabilities.truecolor;
    this.use256Color = !capabilities.truecolor && supports256ColorFallback();
  }

  private resolveHex(token: string): string {
    if (token === "dim") {
      return normalizeHex(
        this.palette.dim ?? rgbToHex(dimRgb(hexToRgb(this.palette.fg ?? DEFAULT_PALETTE.fg))),
      );
    }

    const value = this.palette[token] ?? (token.startsWith("#") ? token : this.palette.fg);
    return normalizeHex(value);
  }

  resolve(token: string): number | string {
    const hex = this.resolveHex(token);
    if (this.truecolor) {
      return hex;
    }

    const rgb = hexToRgb(hex);
    return this.use256Color ? toAnsi256(rgb) : toAnsi16(rgb);
  }
}

export { DEFAULT_PALETTE };
