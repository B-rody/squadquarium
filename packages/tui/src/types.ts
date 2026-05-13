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
  /** Which process to spawn in the PTY pane. Default: "copilot" */
  ptyMode?: "copilot" | "triage" | "loop";
  /** Extra args passed through to the child process */
  ptyExtraArgs?: string[];
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
