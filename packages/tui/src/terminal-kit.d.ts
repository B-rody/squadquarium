declare module "terminal-kit" {
  export interface TerminalSupport {
    deltaEscapeSequence?: boolean;
    "256colors"?: boolean;
    "24bitsColors"?: boolean;
    trueColor?: boolean;
  }

  export interface Terminal {
    width: number;
    height: number;
    appId?: string;
    generic?: string;
    termconfigFile?: string;
    isTTY?: boolean;
    support?: TerminalSupport;
    optimized: {
      color24bits: (r: number, g: number, b: number) => string;
      bgColor24bits: (r: number, g: number, b: number) => string;
    };
    fullscreen?: (enabled?: boolean) => void;
    hideCursor?: () => void;
    showCursor?: () => void;
    styleReset?: () => void;
    grabInput?: (options?: unknown) => void;
    on: (event: string, listener: (...args: unknown[]) => void) => this;
    off?: (event: string, listener: (...args: unknown[]) => void) => this;
    removeListener?: (event: string, listener: (...args: unknown[]) => void) => this;
  }

  export class ScreenBufferHD {
    static create(options: Record<string, unknown>): ScreenBufferHD;
    bitsPerColor: number;
    fill(options?: unknown): void;
    put(options: Record<string, unknown>, text?: string): void;
    draw(options?: Record<string, unknown>): void;
  }

  export class InputField {}

  const terminalKit: {
    terminal: Terminal;
    ScreenBufferHD: typeof ScreenBufferHD;
    InputField: typeof InputField;
  };

  export default terminalKit;
}
