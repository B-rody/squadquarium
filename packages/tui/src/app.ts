import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import termkit, { type ScreenBufferHD as TerminalScreenBufferHD } from "terminal-kit";
import { ActivityLog } from "./activity-log.js";
import { detectCapabilities } from "./adaptive.js";
import { Aquarium, type ActorLabel } from "./aquarium.js";
import { drawChrome } from "./chrome.js";
import { CopilotPane } from "./copilot-pane.js";
import { loadHalfBlockSpritesSync, type HalfBlockSpriteSheet } from "./halfblock-sprites.js";
import { calculateLayout, type Layout } from "./layout.js";
import { MouseHandler, type MouseEventData } from "./mouse.js";
import { DEFAULT_PALETTE, Palette, type ColorValue } from "./palette.js";
import { PtyManager } from "./pty-manager.js";
import { loadSpritesSync, type SpriteSheet } from "./sprites.js";
import { SquadWatcher, type AgentInfo, type SquadState } from "./squad-watcher.js";
import type { AppConfig, Capabilities, Rect } from "./types.js";

const { terminal, ScreenBufferHD } = termkit;
const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 30;

// --- Sprite role mapping ---
// Maps squad agent roles (from charter.md) to sprite role keys in skins/
const ROLE_TO_SPRITE: Record<string, string> = {
  lead: "lead",
  "tech lead": "lead",
  architect: "lead",
  "senior architect": "lead",
  "frontend dev": "frontend",
  "frontend developer": "frontend",
  "ui engineer": "frontend",
  "backend dev": "backend",
  "backend developer": "backend",
  "api engineer": "backend",
  tester: "scribe", // fallback — no tester sprite yet
  "session logger": "scribe",
  scribe: "scribe",
};

function spriteRoleFor(agentRole: string, availableRoles: string[]): string {
  const lower = agentRole.toLowerCase().trim();
  const mapped = ROLE_TO_SPRITE[lower];
  if (mapped && availableRoles.includes(mapped)) return mapped;
  // Fuzzy: check if any key is a substring
  for (const [key, sprite] of Object.entries(ROLE_TO_SPRITE)) {
    if (lower.includes(key) && availableRoles.includes(sprite)) return sprite;
  }
  // Fallback to first available
  return availableRoles[0] ?? "lead";
}

// --- Screen buffer abstraction ---

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

// --- Runtime state ---

interface RuntimeState {
  config: Required<Pick<AppConfig, "fps" | "headless" | "smokeTest" | "debug">> & AppConfig;
  layout: Layout;
  root: ScreenBufferLike;
  aquariumBuffer: ScreenBufferLike;
  copilotBuffer: ScreenBufferLike;
  aquariumScene: Aquarium;
  activityLog: ActivityLog;
  copilotPane: CopilotPane;
  ptyManager: PtyManager | null;
  mouseHandler: MouseHandler;
  uiColors: UiColors;
  capabilities: Capabilities;
  squadWatcher: SquadWatcher;
  squadState: SquadState;
  interval: NodeJS.Timeout | null;
  running: boolean;
  frame: number;
  resolve: (() => void) | null;
  reject: ((error: unknown) => void) | null;
  cleanupHandlers: Array<[string, EventListener]>;
  keyListener: EventListener | null;
  mouseListener: EventListener | null;
  resizeListener: EventListener | null;
}

let runtime: RuntimeState | null = null;

// --- Public API ---

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

  // Spawn the PTY child process (non-headless only)
  if (!runtime.config.headless && runtime.config.ptyMode) {
    await spawnPty(runtime);
  }

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
  if (!current || !current.running) return;

  current.running = false;
  if (current.interval) {
    clearInterval(current.interval);
    current.interval = null;
  }

  // Kill PTY child
  if (current.ptyManager?.running) {
    current.ptyManager.kill();
  }

  current.squadWatcher.stop();
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

async function spawnPty(state: RuntimeState): Promise<void> {
  const pty = new PtyManager();
  state.ptyManager = pty;

  pty.on("data", (data: string) => {
    state.copilotPane.write(data);
  });

  pty.on("exit", (code: number) => {
    state.copilotPane.write(`\n[Process exited with code ${code}]\n`);
  });

  try {
    await pty.spawn({
      mode: state.config.ptyMode ?? "copilot",
      cwd: state.config.cwd ?? process.cwd(),
      cols: state.layout.copilot.width,
      rows: state.layout.copilot.height,
      extraArgs: state.config.ptyExtraArgs ?? [],
    });
    state.copilotPane.write("PTY connected. Waiting for output...\n\n");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    state.copilotPane.write(`Failed to spawn PTY: ${msg}\n`);
    state.copilotPane.write("Make sure 'copilot' or 'squad' is on your PATH.\n");
    state.copilotPane.write("You can still use squad directly in another terminal.\n");
  }
}

// --- Exported helpers for tests ---

export function createStartupMessages(config: AppConfig, agentCount: number): string[] {
  const cwd = config.cwd ?? process.cwd();
  return [
    "Welcome to Squadquarium.",
    `Watching: ${cwd}`,
    `${agentCount} agent${agentCount === 1 ? "" : "s"} detected.`,
    "Copilot pane: real PTY output. Aquarium: ambient agent state.",
  ];
}

export function createDebugMessages(): string[] {
  return ["[DEBUG] debug messages not yet reimplemented for v1 architecture"];
}

export function createHelpMessages(): string[] {
  return [
    "Squadquarium wraps copilot --agent squad.",
    "All input goes to the Copilot PTY. Use Squad slash commands:",
    "  /status  /agents  /help  /history  /clear  /quit",
  ];
}

export function describeAquariumClick(role: string): string {
  return `Clicked ${formatRoleName(role)}.`;
}

export function handleAquariumClick(
  aquarium: Aquarium,
  activityLog: ActivityLog,
  x: number,
  y: number,
): void {
  const actor = aquarium.hitTest(x, y);
  if (!actor) return;
  actor.setState("celebrate");
  activityLog.add(describeAquariumClick(actor.role));
}

// --- Runtime creation ---

function createRuntime(config: AppConfig): RuntimeState {
  const effectiveConfig = {
    ...config,
    fps: config.fps ?? 12,
    headless: config.headless ?? false,
    smokeTest: config.smokeTest ?? false,
    debug: config.debug ?? false,
  };

  const size = getTerminalSize(effectiveConfig);
  const layout = calculateLayout(size.width, size.height);
  const capabilities = detectCapabilities();
  const assets = loadAquariumAssets(effectiveConfig.skinsDir);
  const palette = new Palette(assets.manifest.palette ?? DEFAULT_PALETTE, capabilities);
  const uiColors: UiColors = {
    bg: palette.resolve("bg"),
    fg: palette.resolve("fg"),
    accent: palette.resolve("accent"),
    dim: palette.resolve("dim"),
  };

  const root = createBuffer(size.width, size.height, undefined, effectiveConfig.headless);
  const aquariumBuffer = createBuffer(
    layout.aquarium.width,
    layout.aquarium.height,
    { dst: root, x: layout.aquarium.x, y: layout.aquarium.y },
    effectiveConfig.headless,
  );
  const copilotBuffer = createBuffer(
    layout.copilot.width,
    layout.copilot.height,
    { dst: root, x: layout.copilot.x, y: layout.copilot.y },
    effectiveConfig.headless,
  );

  const squadWatcher = new SquadWatcher(effectiveConfig.cwd ?? process.cwd());
  const squadState = squadWatcher.readState();

  const aquariumScene = createAquariumScene(layout.aquarium, capabilities, assets, squadState);
  const activityLog = new ActivityLog();
  const copilotPane = new CopilotPane();

  // Feed startup info into the copilot pane
  const startupLines = createStartupMessages(effectiveConfig, squadState.agents.length);
  copilotPane.write(startupLines.join("\n") + "\n");

  if (squadWatcher.detected) {
    copilotPane.write(`Squad root: ${squadState.squadRoot}\n`);
    if (squadState.focus) copilotPane.write(`Focus: ${squadState.focus}\n`);
    if (squadState.recentDecision)
      copilotPane.write(`Last decision: ${squadState.recentDecision}\n`);
  } else {
    copilotPane.write("No .squad/ found. Run squad init to create a team.\n");
  }
  copilotPane.write("\nCopilot PTY output will appear here when connected.\n");

  // Use late-binding through runtime reference so resize updates are reflected
  const mouseHandler = new MouseHandler({
    getRegions: () => runtime?.layout ?? layout,
    onAquariumClick: (x, y) =>
      handleAquariumClick(runtime?.aquariumScene ?? aquariumScene, activityLog, x, y),
    onLogScroll: (direction) => {
      const cp = runtime?.copilotPane;
      if (cp) cp.scroll(direction === "up" ? 3 : -3);
    },
    onInputFocus: () => {},
  });

  // Start watching for filesystem changes
  squadWatcher.on("change", (newState) => {
    if (runtime) {
      runtime.squadState = newState;
      // Rebuild aquarium actors on roster change
      runtime.aquariumScene = createAquariumScene(
        runtime.layout.aquarium,
        runtime.capabilities,
        loadAquariumAssets(runtime.config.skinsDir),
        newState,
      );
    }
  });
  squadWatcher.start();

  return {
    config: effectiveConfig,
    layout,
    root,
    aquariumBuffer,
    copilotBuffer,
    aquariumScene,
    activityLog,
    copilotPane,
    ptyManager: null,
    mouseHandler,
    uiColors,
    capabilities,
    squadWatcher,
    squadState,
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

// --- Terminal initialization ---

function initializeTerminal(state: RuntimeState): void {
  if (state.config.headless) return;

  ensureTerminalColorEscapes();
  terminal.fullscreen?.(true);
  terminal.hideCursor?.();
  terminal.grabInput?.({ mouse: "button" });
}

function ensureTerminalColorEscapes(): void {
  if (process.env.NO_COLOR) return;

  if (terminal.optimized.color24bits(1, 2, 3) === "") {
    terminal.optimized.color24bits = (r: number, g: number, b: number) =>
      `\x1B[38;2;${clampByte(r)};${clampByte(g)};${clampByte(b)}m`;
  }
  if (terminal.optimized.bgColor24bits(1, 2, 3) === "") {
    terminal.optimized.bgColor24bits = (r: number, g: number, b: number) =>
      `\x1B[48;2;${clampByte(r)};${clampByte(g)};${clampByte(b)}m`;
  }
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

// --- Event binding ---

function bindEvents(state: RuntimeState): void {
  state.keyListener = (name: unknown) => {
    const key = name as string;

    // Ctrl+C: if PTY is running, forward it; otherwise quit
    if (key === "CTRL_C") {
      if (state.ptyManager?.running) {
        state.ptyManager.write("\x03");
      } else {
        void stopApp();
      }
      return;
    }

    // Forward all other keys to PTY
    if (state.ptyManager?.running) {
      const mapped = mapKeyToPty(key);
      if (mapped) state.ptyManager.write(mapped);
    }
  };

  state.mouseListener = (name: unknown, data: unknown) => {
    state.mouseHandler.dispatch(name as string, data as MouseEventData);
  };

  state.resizeListener = () => {
    if (!runtime) return;
    rebuildBuffers(runtime);
    // Forward resize to PTY
    if (runtime.ptyManager?.running) {
      runtime.ptyManager.resize(runtime.layout.copilot.width, runtime.layout.copilot.height);
    }
    render(runtime);
  };

  if (!state.config.headless) {
    terminal.on("key", state.keyListener as EventListener);
    terminal.on("mouse", state.mouseListener as EventListener);
    terminal.on("resize", state.resizeListener as EventListener);
  }

  const onSignal = () => void stopApp();
  const onException = (error: unknown) => {
    void stopApp().finally(() => state.reject?.(error));
  };

  state.cleanupHandlers.push(["SIGINT", onSignal]);
  state.cleanupHandlers.push(["SIGTERM", onSignal]);
  state.cleanupHandlers.push(["uncaughtException", onException]);
  state.cleanupHandlers.push(["unhandledRejection", onException]);

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  process.on("uncaughtException", onException);
  process.on("unhandledRejection", onException);
}

function unbindEvents(state: RuntimeState): void {
  if (!state.config.headless) {
    removeTerminalListener("key", state.keyListener);
    removeTerminalListener("mouse", state.mouseListener);
    removeTerminalListener("resize", state.resizeListener);
  }

  state.cleanupHandlers.forEach(([event, handler]) => {
    process.off(event, handler);
  });
  state.cleanupHandlers = [];
}

function removeTerminalListener(event: string, listener: EventListener | null): void {
  if (!listener) return;
  if (terminal.off) terminal.off(event, listener);
  else terminal.removeListener?.(event, listener);
}

// --- Buffer rebuild on resize ---

function rebuildBuffers(state: RuntimeState): void {
  const size = getTerminalSize(state.config);
  state.layout = calculateLayout(size.width, size.height);
  state.root = createBuffer(size.width, size.height, undefined, state.config.headless);
  state.aquariumBuffer = createBuffer(
    state.layout.aquarium.width,
    state.layout.aquarium.height,
    { dst: state.root, x: state.layout.aquarium.x, y: state.layout.aquarium.y },
    state.config.headless,
  );
  state.copilotBuffer = createBuffer(
    state.layout.copilot.width,
    state.layout.copilot.height,
    { dst: state.root, x: state.layout.copilot.x, y: state.layout.copilot.y },
    state.config.headless,
  );
  state.aquariumScene = createAquariumScene(
    state.layout.aquarium,
    state.capabilities,
    loadAquariumAssets(state.config.skinsDir),
    state.squadState,
  );
}

// --- Render loop ---

function render(state: RuntimeState): void {
  state.frame += 1;
  state.root.fill({ char: " ", attr: baseAttr(state.uiColors) });

  // Aquarium
  state.aquariumScene.tick();
  state.aquariumScene.render(state.aquariumBuffer as unknown as TerminalScreenBufferHD);

  // Copilot pane — CopilotPane renders stripped PTY output
  state.copilotPane.render(state.copilotBuffer, state.layout.copilot, {
    fg: state.uiColors.fg,
    bg: state.uiColors.bg,
    dim: state.uiColors.dim,
  });

  state.aquariumBuffer.draw();
  state.copilotBuffer.draw();

  // Chrome
  drawChrome(state.root as unknown as TerminalScreenBufferHD, state.layout, {
    teamName: state.squadState.teamName,
    skinName: "aquarium",
    agentCount: state.squadState.agents.length,
    rounded: state.capabilities.unicode,
    statusBarPosition: "bottom",
    color: state.uiColors.fg,
    bgColor: state.uiColors.bg,
    chromeColor: state.uiColors.dim,
    labelColor: state.uiColors.accent,
  });

  if (!state.config.headless) {
    state.root.draw({ delta: true });
  }
}

// --- Aquarium scene from Squad state ---

function createAquariumScene(
  rect: Rect,
  capabilities: Capabilities,
  assets: LoadedAquariumAssets,
  squadState: SquadState,
): Aquarium {
  // Prefer half-block sprite roles when available
  const hbRoles = assets.halfBlockSprites ? Object.keys(assets.halfBlockSprites.roles) : [];
  const asciiRoles = assets.spriteSheet ? Object.keys(assets.spriteSheet.roles) : [];
  const spriteRoles = hbRoles.length > 0 ? hbRoles : asciiRoles.length > 0 ? asciiRoles : ["lead"];
  const roleLabels: Record<string, ActorLabel> = {};

  const aquarium = new Aquarium(rect.width, rect.height, {
    capabilities,
    spriteSheet: assets.spriteSheet,
    halfBlockSprites: assets.halfBlockSprites,
    skinPalette: assets.manifest.palette,
    fallbacks: assets.manifest.fallbacks,
    roleLabels,
  });

  const agents = squadState.agents.length > 0 ? squadState.agents : defaultAgents();
  const spacing = Math.max(1, Math.floor(rect.width / (agents.length + 1)));

  agents.forEach((agent, i) => {
    const sprite = spriteRoleFor(agent.role, spriteRoles);
    const x = Math.min(spacing * (i + 1), Math.max(0, rect.width - 12));
    const y = Math.max(0, Math.floor(rect.height / 2) - 2 + (i % 2 === 0 ? -1 : 1));
    const actor = aquarium.addActor(sprite, x, y, "idle");
    aquarium.setActorLabel(actor, { name: capitalize(agent.name), role: agent.role });
  });

  return aquarium;
}

function defaultAgents(): AgentInfo[] {
  return [
    { name: "lead", role: "Lead", status: "active" },
    { name: "frontend", role: "Frontend Dev", status: "active" },
    { name: "backend", role: "Backend Dev", status: "active" },
    { name: "scribe", role: "Scribe", status: "active" },
  ];
}

// --- Asset loading ---

interface LoadedAquariumAssets {
  baseDir: string;
  manifest: SkinManifest;
  spriteSheet: SpriteSheet | undefined;
  halfBlockSprites: HalfBlockSpriteSheet | undefined;
}

function defaultSkinsDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skins");
}

function loadAquariumAssets(skinsDir: string | undefined): LoadedAquariumAssets {
  const baseDir = skinsDir ?? defaultSkinsDir();
  const manifestPath = path.join(baseDir, "aquarium", "manifest.json");
  const spritesPath = path.join(baseDir, "aquarium", "sprites.json");
  const halfBlockPath = path.join(baseDir, "aquarium", "sprites-halfblock.json");

  const manifest = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SkinManifest)
    : {};
  const spriteSheet = fs.existsSync(spritesPath) ? loadSpritesSync(spritesPath) : undefined;
  const halfBlockSprites = fs.existsSync(halfBlockPath)
    ? loadHalfBlockSpritesSync(halfBlockPath)
    : undefined;

  return { baseDir, manifest, spriteSheet, halfBlockSprites };
}

// --- Utility ---

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
  if (config.headlessSize) return config.headlessSize;
  if (config.headless) return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  return {
    width: Math.max(40, terminal.width ?? process.stdout.columns ?? DEFAULT_WIDTH),
    height: Math.max(16, terminal.height ?? process.stdout.rows ?? DEFAULT_HEIGHT),
  };
}

function formatRoleName(role: string): string {
  return role.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Map terminal-kit key names to PTY-compatible escape sequences. */
function mapKeyToPty(key: string): string | null {
  // Single printable character
  if (key.length === 1) return key;

  switch (key) {
    case "ENTER":
      return "\r";
    case "BACKSPACE":
      return "\x7f";
    case "DELETE":
      return "\x1B[3~";
    case "TAB":
      return "\t";
    case "ESCAPE":
      return "\x1B";
    case "UP":
      return "\x1B[A";
    case "DOWN":
      return "\x1B[B";
    case "RIGHT":
      return "\x1B[C";
    case "LEFT":
      return "\x1B[D";
    case "HOME":
      return "\x1B[H";
    case "END":
      return "\x1B[F";
    case "PAGE_UP":
      return "\x1B[5~";
    case "PAGE_DOWN":
      return "\x1B[6~";
    case "CTRL_A":
      return "\x01";
    case "CTRL_B":
      return "\x02";
    case "CTRL_D":
      return "\x04";
    case "CTRL_E":
      return "\x05";
    case "CTRL_F":
      return "\x06";
    case "CTRL_K":
      return "\x0B";
    case "CTRL_L":
      return "\x0C";
    case "CTRL_N":
      return "\x0E";
    case "CTRL_P":
      return "\x10";
    case "CTRL_R":
      return "\x12";
    case "CTRL_U":
      return "\x15";
    case "CTRL_W":
      return "\x17";
    default:
      return null;
  }
}
