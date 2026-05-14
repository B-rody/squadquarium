export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanelConfig {
  rect: Rect;
  title: string;
}

export interface AppConfig {
  cwd?: string;
  personal?: boolean;
  attachPaths?: string[];
  fps?: number;
  inputPrompt?: string;
  headless?: boolean;
  headlessSize?: { width: number; height: number };
  smokeTest?: boolean;
  skinsDir?: string;
  debug?: boolean;
  debugLogPath?: string;
  /** Which SDK workflow to start. Default: "chat" */
  sdkMode?: "chat" | "triage" | "loop";
  /** CLI-style args translated into the SDK workflow prompt. */
  sdkExtraArgs?: string[];
  /** Auto-approve Copilot SDK permission requests. */
  yolo?: boolean;
  /** Copilot model id to request for the SDK session. */
  model?: string;
  /** Enable terminal mouse capture for clicks/scrolling. Disabled by default so native text selection works. */
  enableMouse?: boolean;
}

export type ColorSupportLevel = "truecolor" | "ansi256" | "ansi16" | "none";

export interface Capabilities {
  truecolor: boolean;
  colorLevel: ColorSupportLevel;
  mouse: boolean;
  unicode: boolean;
  termProgram: string;
  windowsTerminal: boolean;
}

export interface LogEntry {
  timestamp: string;
  message: string;
}
