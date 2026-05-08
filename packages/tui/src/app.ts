import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import termkit, { type ScreenBufferHD as TerminalScreenBufferHD } from "terminal-kit";
import { ActivityLog } from "./activity-log.js";
import { detectCapabilities } from "./adaptive.js";
import { Aquarium } from "./aquarium.js";
import { drawChrome } from "./chrome.js";
import { InputLine } from "./input-line.js";
import { calculateLayout, type Layout } from "./layout.js";
import { MouseHandler, type MouseEventData } from "./mouse.js";
import { DEFAULT_PALETTE, Palette, type ColorValue } from "./palette.js";
import { loadSpritesSync, type SpriteSheet } from "./sprites.js";
import type { AppConfig, Rect } from "./types.js";

const { terminal, ScreenBufferHD } = termkit;
const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 30;

interface ScreenBufferLike {
  fill(options?: unknown): void;
  put(options: Record<string, unknown>, text?: string): void;
  draw(options?: Record<string, unknown>): void;
}

type EventListener = (...args: unknown[]) => void;

interface SkinManifest {
  palette?: Record<string, string>;
  fallbacks?: Record<string, string>;
}

interface UiColors {
  bg: ColorValue;
  fg: ColorValue;
  accent: ColorValue;
  dim: ColorValue;
}

interface RuntimeState {
  config: Required<Pick<AppConfig, "fps" | "inputPrompt" | "headless" | "smokeTest">> & AppConfig;
  layout: Layout;
  root: ScreenBufferLike;
  aquarium: ScreenBufferLike;
  log: ScreenBufferLike;
  input: ScreenBufferLike;
  activityLog: ActivityLog;
  inputLine: InputLine;
  mouseHandler: MouseHandler;
  aquariumScene: Aquarium;
  uiColors: UiColors;
  capabilities: ReturnType<typeof detectCapabilities>;
  interval: NodeJS.Timeout | null;
  running: boolean;
  frame: number;
  resolve: (() => void) | null;
  reject: ((error: unknown) => void) | null;
  cleanupHandlers: Array<
    [NodeJS.Signals | "uncaughtException" | "unhandledRejection", EventListener]
  >;
  keyListener: ((name: string) => void) | null;
  mouseListener: ((name: string, data: MouseEventData) => void) | null;
  resizeListener: (() => void) | null;
}

let runtime: RuntimeState | null = null;

const ACTOR_CLICK_MESSAGES: Record<string, string> = {
  lead: "Anglerfish noticed you!",
  frontend: "Seahorse did a quick twirl for you!",
  backend: "Octopus flashed a curious wave!",
  scribe: "Squid scribbled your hello!",
};

const HELP_MESSAGES = [
  "Commands:",
  "  help   Show this guide",
  "  status Show aquarium panel size",
  "  clear  Clear the activity log",
  "  exit   Close Squadquarium",
  "  quit   Same as exit",
] as const;

export function createStartupMessages(config: AppConfig, agentCount: number): string[] {
  const watchTarget = config.personal ? "your personal squad" : (config.cwd ?? process.cwd());
  const attachedCount = config.attachPaths?.length ?? 0;
  const messages = [
    "Welcome to Squadquarium.",
    `Watching: ${watchTarget}`,
    `${agentCount} agent${agentCount === 1 ? "" : "s"} swimming.`,
  ];

  if (attachedCount > 0) {
    messages.push(`${attachedCount} extra squad${attachedCount === 1 ? "" : "s"} linked.`);
  }

  messages.push("Tank ready. Type help for commands, clear to wipe the log, exit to leave.");
  return messages;
}

export function createHelpMessages(): string[] {
  return [...HELP_MESSAGES];
}

export function describeAquariumClick(role: string): string {
  return ACTOR_CLICK_MESSAGES[role] ?? `${formatRoleName(role)} noticed you!`;
}

export async function startApp(config: AppConfig = {}): Promise<void> {
  if (runtime?.running) {
    throw new Error("TUI app is already running.");
  }

  if (!config.headless && !process.stdout.isTTY) {
    throw new Error(
      "TUI mode requires an interactive terminal. Use a real TTY or run a non-TUI subcommand.",
    );
  }

  runtime = createRuntime(config);
  initializeTerminal(runtime);
  bindEvents(runtime);
  render(runtime);

  return new Promise<void>((resolve, reject) => {
    if (!runtime) {
      resolve();
      return;
    }

    runtime.resolve = resolve;
    runtime.reject = reject;

    runtime.interval = setInterval(
      () => {
        if (runtime) {
          render(runtime);
          if (runtime.config.smokeTest && runtime.frame > 1) {
            void stopApp();
          }
        }
      },
      Math.max(1, Math.round(1000 / runtime.config.fps)),
    );
  });
}

export async function stopApp(): Promise<void> {
  const current = runtime;
  if (!current || !current.running) {
    return;
  }

  current.running = false;
  if (current.interval) {
    clearInterval(current.interval);
    current.interval = null;
  }

  unbindEvents(current);

  if (!current.config.headless) {
    terminal.grabInput?.(false);
    terminal.styleReset?.();
    terminal.showCursor?.();
    terminal.fullscreen?.(false);
  }

  runtime = null;
  current.resolve?.();
}

function createRuntime(config: AppConfig): RuntimeState {
  const effectiveConfig = {
    ...config,
    fps: config.fps ?? 12,
    inputPrompt: config.inputPrompt ?? "sqq> ",
    headless: config.headless ?? false,
    smokeTest: config.smokeTest ?? false,
  };

  const size = getTerminalSize(effectiveConfig);
  const layout = calculateLayout(size.width, size.height);
  const capabilities = detectCapabilities();
  const uiColors = loadUiColors(effectiveConfig.skinsDir, capabilities.truecolor);
  const root = createBuffer(size.width, size.height, undefined, effectiveConfig.headless);
  const aquarium = createBuffer(
    layout.aquarium.width,
    layout.aquarium.height,
    { dst: root, x: layout.aquarium.x, y: layout.aquarium.y },
    effectiveConfig.headless,
  );
  const log = createBuffer(
    layout.log.width,
    layout.log.height,
    { dst: root, x: layout.log.x, y: layout.log.y },
    effectiveConfig.headless,
  );
  const input = createBuffer(
    layout.input.width,
    layout.input.height,
    { dst: root, x: layout.input.x, y: layout.input.y },
    effectiveConfig.headless,
  );
  const activityLog = new ActivityLog();
  const inputLine = new InputLine(effectiveConfig.inputPrompt);
  const aquariumScene = createAquariumScene(
    layout.aquarium,
    capabilities.truecolor,
    effectiveConfig.skinsDir,
  );

  for (const message of createStartupMessages(effectiveConfig, aquariumScene.getActors().length)) {
    activityLog.add(message);
  }

  const mouseHandler = new MouseHandler({
    getRegions: () => layout,
    onAquariumClick: (x, y) => handleAquariumClick(aquariumScene, activityLog, x, y),
    onLogScroll: (direction) => activityLog.handleWheel(direction),
    onInputFocus: () => inputLine.focus(),
  });

  return {
    config: effectiveConfig,
    layout,
    root,
    aquarium,
    log,
    input,
    activityLog,
    inputLine,
    mouseHandler,
    aquariumScene,
    uiColors,
    capabilities,
    interval: null,
    running: true,
    frame: 0,
    resolve: null,
    reject: null,
    cleanupHandlers: [],
    keyListener: null,
    mouseListener: null,
    resizeListener: null,
  };
}

function initializeTerminal(state: RuntimeState): void {
  if (state.config.headless) {
    return;
  }

  terminal.fullscreen?.(true);
  terminal.hideCursor?.();
  terminal.grabInput?.({ mouse: "button" });
}

function bindEvents(state: RuntimeState): void {
  state.inputLine.on("command", (command) => {
    const trimmed = command.trim();
    if (trimmed === "") {
      return;
    }

    if (trimmed === "exit" || trimmed === "quit") {
      void stopApp();
      return;
    }

    if (trimmed === "clear") {
      state.activityLog.clear();
      state.activityLog.add("log cleared");
      return;
    }

    if (trimmed === "help") {
      for (const message of createHelpMessages()) {
        state.activityLog.add(message);
      }
      return;
    }

    if (trimmed === "status") {
      state.activityLog.add(
        `layout ${state.layout.aquarium.width}x${state.layout.aquarium.height}`,
      );
      return;
    }

    state.activityLog.add(`command: ${trimmed}`);
  });

  state.keyListener = (name: string) => {
    if (name === "CTRL_C") {
      void stopApp();
      return;
    }
    state.inputLine.handleKey(name);
  };

  state.mouseListener = (name: string, data: MouseEventData) => {
    state.mouseHandler.dispatch(name, data);
  };

  state.resizeListener = () => {
    if (!runtime) {
      return;
    }
    rebuildBuffers(runtime);
    render(runtime);
  };

  if (!state.config.headless) {
    terminal.on("key", state.keyListener as EventListener);
    terminal.on("mouse", state.mouseListener as EventListener);
    terminal.on("resize", state.resizeListener as EventListener);
  }

  const onSignal = () => {
    void stopApp();
  };
  const onException = (error: unknown) => {
    void stopApp().finally(() => {
      state.reject?.(error);
    });
  };

  const onResizeSignal = () => {
    if (!runtime) {
      return;
    }
    rebuildBuffers(runtime);
    render(runtime);
  };

  state.cleanupHandlers.push(["SIGINT", onSignal]);
  state.cleanupHandlers.push(["SIGTERM", onSignal]);
  state.cleanupHandlers.push(["uncaughtException", onException]);
  state.cleanupHandlers.push(["unhandledRejection", onException]);
  state.cleanupHandlers.push(["SIGWINCH", onResizeSignal]);

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  process.on("uncaughtException", onException);
  process.on("unhandledRejection", onException);
  process.on("SIGWINCH", onResizeSignal);
}

function unbindEvents(state: RuntimeState): void {
  if (!state.config.headless) {
    removeTerminalListener("key", state.keyListener as EventListener | null);
    removeTerminalListener("mouse", state.mouseListener as EventListener | null);
    removeTerminalListener("resize", state.resizeListener as EventListener | null);
  }

  state.cleanupHandlers.forEach(([event, handler]) => {
    process.off(event, handler);
  });
  state.cleanupHandlers = [];
}

function removeTerminalListener(event: string, listener: EventListener | null): void {
  if (!listener) {
    return;
  }
  if (terminal.off) {
    terminal.off(event, listener);
  } else {
    terminal.removeListener?.(event, listener);
  }
}

function rebuildBuffers(state: RuntimeState): void {
  const size = getTerminalSize(state.config);
  state.layout = calculateLayout(size.width, size.height);
  state.root = createBuffer(size.width, size.height, undefined, state.config.headless);
  state.aquarium = createBuffer(
    state.layout.aquarium.width,
    state.layout.aquarium.height,
    { dst: state.root, x: state.layout.aquarium.x, y: state.layout.aquarium.y },
    state.config.headless,
  );
  state.log = createBuffer(
    state.layout.log.width,
    state.layout.log.height,
    { dst: state.root, x: state.layout.log.x, y: state.layout.log.y },
    state.config.headless,
  );
  state.input = createBuffer(
    state.layout.input.width,
    state.layout.input.height,
    { dst: state.root, x: state.layout.input.x, y: state.layout.input.y },
    state.config.headless,
  );
  state.aquariumScene = createAquariumScene(
    state.layout.aquarium,
    state.capabilities.truecolor,
    state.config.skinsDir,
  );
  state.mouseHandler = new MouseHandler({
    getRegions: () => state.layout,
    onAquariumClick: (x, y) => handleAquariumClick(state.aquariumScene, state.activityLog, x, y),
    onLogScroll: (direction) => state.activityLog.handleWheel(direction),
    onInputFocus: () => state.inputLine.focus(),
  });
}

function render(state: RuntimeState): void {
  state.frame += 1;
  state.root.fill({ char: " ", attr: baseAttr(state.uiColors) });
  state.aquariumScene.tick();
  state.aquariumScene.render(state.aquarium as unknown as TerminalScreenBufferHD);
  state.activityLog.render(state.log, state.layout.log, {
    timestampColor: state.uiColors.dim,
    color: state.uiColors.fg,
    bgColor: state.uiColors.bg,
  });
  state.inputLine.render(state.input, state.layout.input, {
    promptColor: state.uiColors.accent,
    textColor: state.uiColors.fg,
    hintColor: state.uiColors.dim,
    bgColor: state.uiColors.bg,
  });
  state.aquarium.draw();
  state.log.draw();
  state.input.draw();
  drawChrome(state.root as unknown as TerminalScreenBufferHD, state.layout, {
    teamName: "Squadquarium",
    skinName: "aquarium",
    agentCount: state.aquariumScene.getActors().length,
    rounded: state.capabilities.unicode,
    statusBarPosition: "top",
    color: state.uiColors.fg,
    bgColor: state.uiColors.bg,
    chromeColor: state.uiColors.dim,
    labelColor: state.uiColors.accent,
  });
  if (!state.config.headless) {
    state.root.draw({ delta: true });
  }
}

function createAquariumScene(rect: Rect, truecolor: boolean, skinsDir?: string): Aquarium {
  const assets = loadAquariumAssets(skinsDir);
  const aquarium = new Aquarium(rect.width, rect.height, {
    capabilities: { truecolor },
    spriteSheet: assets.spriteSheet,
    skinPalette: assets.manifest.palette,
    fallbacks: assets.manifest.fallbacks,
  });
  const baseY = Math.max(0, Math.floor(rect.height / 2) - 1);

  aquarium.addActor("lead", 2, Math.max(0, baseY - 3), "idle");
  aquarium.addActor(
    "frontend",
    Math.max(0, Math.floor(rect.width * 0.25)),
    Math.max(0, baseY - 1),
    "working",
  );
  aquarium.addActor("backend", Math.max(0, Math.floor(rect.width * 0.5)), baseY, "idle");
  aquarium.addActor(
    "scribe",
    Math.max(0, rect.width - 10),
    Math.min(Math.max(0, rect.height - 2), baseY + 2),
    "celebrate",
  );

  return aquarium;
}

function loadUiColors(skinsDir: string | undefined, truecolor: boolean): UiColors {
  const { manifest } = loadAquariumAssets(skinsDir);
  const palette = new Palette(manifest.palette ?? DEFAULT_PALETTE, { truecolor });

  return {
    bg: palette.resolve("bg"),
    fg: palette.resolve("fg"),
    accent: palette.resolve("accent"),
    dim: palette.resolve("dim"),
  };
}

function defaultSkinsDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skins");
}

function loadAquariumAssets(skinsDir: string | undefined): {
  manifest: SkinManifest;
  spriteSheet: SpriteSheet | undefined;
} {
  const baseDir = skinsDir ?? defaultSkinsDir();
  const manifestPath = path.join(baseDir, "aquarium", "manifest.json");
  const spritesPath = path.join(baseDir, "aquarium", "sprites.json");

  const manifest = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SkinManifest)
    : {};
  const spriteSheet = fs.existsSync(spritesPath) ? loadSpritesSync(spritesPath) : undefined;

  return { manifest, spriteSheet };
}

export function handleAquariumClick(
  aquarium: Aquarium,
  activityLog: ActivityLog,
  x: number,
  y: number,
): void {
  const actor = aquarium.hitTest(x, y);
  if (!actor) {
    return;
  }

  actor.setState("celebrate");
  activityLog.add(describeAquariumClick(actor.role));
}

function formatRoleName(role: string): string {
  return role.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function createBuffer(
  width: number,
  height: number,
  options: Record<string, unknown> | undefined,
  headless: boolean,
): ScreenBufferLike {
  const bufferOptions: Record<string, unknown> = { width, height, ...(options ?? {}) };
  if (!headless && !options) {
    bufferOptions.dst = terminal;
    bufferOptions.x = 1;
    bufferOptions.y = 1;
  }
  return ScreenBufferHD.create(bufferOptions) as ScreenBufferLike;
}

function baseAttr(colors: UiColors): Record<string, unknown> {
  return { color: colors.fg, bgColor: colors.bg };
}

function getTerminalSize(config: AppConfig): { width: number; height: number } {
  if (config.headlessSize) {
    return config.headlessSize;
  }

  if (config.headless) {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }

  return {
    width: Math.max(40, terminal.width ?? process.stdout.columns ?? DEFAULT_WIDTH),
    height: Math.max(16, terminal.height ?? process.stdout.rows ?? DEFAULT_HEIGHT),
  };
}
