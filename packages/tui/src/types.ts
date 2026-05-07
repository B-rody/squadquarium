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
}

export interface Capabilities {
  truecolor: boolean;
  mouse: boolean;
  unicode: boolean;
  termProgram: string;
  windowsTerminal: boolean;
}

export interface LogEntry {
  timestamp: string;
  message: string;
}
