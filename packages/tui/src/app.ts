import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import termkit, { type ScreenBufferHD as TerminalScreenBufferHD } from "terminal-kit";
import { ActivityLog } from "./activity-log.js";
import { detectCapabilities } from "./adaptive.js";
import { Aquarium, type ActorLabel } from "./aquarium.js";
import { drawChrome } from "./chrome.js";
import { CommandCenterPane, normalizeAgentId } from "./command-center-pane.js";
import { CopilotPane } from "./copilot-pane.js";
import { CopilotSdkManager, type CopilotModalPrompt } from "./copilot-sdk-manager.js";
import { loadHalfBlockSpritesSync, type HalfBlockSpriteSheet } from "./halfblock-sprites.js";
import { calculateLayout, type Layout } from "./layout.js";
import { MouseHandler, type MouseEventData } from "./mouse.js";
import { DEFAULT_PALETTE, Palette, type ColorValue } from "./palette.js";
import { loadSpritesSync, type SpriteSheet } from "./sprites.js";
import { SquadWatcher, type AgentInfo, type SquadState } from "./squad-watcher.js";
import type { AppConfig, Capabilities, Rect } from "./types.js";

const { terminal, ScreenBufferHD } = termkit;
const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 30;
const AQUARIUM_ACTIVE_HOLD_SECONDS = 0.75;

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
  commandCenterBuffer: ScreenBufferLike;
  aquariumScene: Aquarium;
  activityLog: ActivityLog;
  copilotPane: CopilotPane;
  commandCenterPane: CommandCenterPane;
  copilotManager: CopilotSdkManager | null;
  modalPrompt: CopilotModalPrompt | null;
  modelAutocompleteIds: string[] | null;
  loadingModelAutocomplete: boolean;
  mouseHandler: MouseHandler;
  uiColors: UiColors;
  capabilities: Capabilities;
  squadWatcher: SquadWatcher;
  squadState: SquadState;
  aquariumActiveUntil: Map<string, number>;
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

const LOCAL_SLASH_COMMANDS = [
  { name: "help", usage: "/help or /commands", description: "Show this help." },
  { name: "commands", usage: "/commands", description: "Show this help." },
  { name: "status", usage: "/status", description: "Show SDK state, mode, model, and approvals." },
  {
    name: "models",
    usage: "/models [filter]",
    description: "List available Copilot models, optionally filtered.",
  },
  { name: "model", usage: "/model", description: "Show the active model." },
  {
    name: "model",
    usage: "/model <id>",
    description: "Switch the active model when Copilot is idle.",
  },
  { name: "clear", usage: "/clear", description: "Clear the transcript." },
  {
    name: "copy",
    usage: "/copy",
    description: "Copy the chat transcript to the system clipboard.",
  },
  { name: "//<text>", usage: "//<text>", description: "Send a prompt that starts with /." },
] as const;

const AUTOCOMPLETE_COMMAND_NAMES = [...new Set(LOCAL_SLASH_COMMANDS.map((command) => command.name))]
  .filter((name) => !name.startsWith("//"))
  .sort();

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

  // Start the SDK only for real TTY sessions; smoke tests stay auth/network independent.
  if (!runtime.config.headless) {
    await startCopilotSdk(runtime);
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

  await current.copilotManager?.stop();

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

async function startCopilotSdk(state: RuntimeState): Promise<void> {
  const manager = new CopilotSdkManager();
  state.copilotManager = manager;

  manager.on("output", (data) => {
    state.copilotPane.write(data);
  });
  manager.on("modal", (prompt) => {
    state.modalPrompt = prompt;
    state.copilotPane.clearInput();
    state.copilotPane.setInputHint(prompt ? formatModalHint(prompt) : null);
    updateCopilotInputStatus(state);
  });
  manager.on("status", () => {
    updateCopilotInputStatus(state);
  });
  manager.on("agent", (name, status, detail) => {
    state.commandCenterPane.applyUpdate({
      name,
      displayName: detail.displayName,
      role: detail.role,
      status,
      task: detail.task,
      model: detail.model,
    });
    updateAquariumActivityHold(state, normalizeAgentId(name));
  });
  manager.on("state", (sdkState) => {
    if (sdkState === "idle" || sdkState === "closed") {
      holdWorkingAquariumActors(state);
      state.commandCenterPane.completeWorking();
    } else if (sdkState === "error") {
      holdWorkingAquariumActors(state);
      state.commandCenterPane.completeWorking("session error");
    }
    updateCopilotInputStatus(state);
  });

  try {
    await manager.start({
      cwd: state.config.cwd ?? process.cwd(),
      yolo: state.config.yolo,
      mode: state.config.sdkMode ?? "chat",
      extraArgs: state.config.sdkExtraArgs ?? [],
      squadState: state.squadState,
      debug: state.config.debug,
      model: state.config.model,
    });
    updateCopilotInputStatus(state);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    state.copilotPane.write(`[sqq] Failed to start Copilot SDK: ${msg}\n`);
    state.copilotPane.write(
      "[sqq] Check Copilot authentication with `copilot auth status` or `gh auth status`.\n",
    );
  }
}

// --- Exported helpers for tests ---

export function createStartupMessages(config: AppConfig, agentCount: number): string[] {
  const cwd = config.cwd ?? process.cwd();
  return [
    "Welcome to Squadquarium.",
    `Watching: ${cwd}`,
    `${agentCount} agent${agentCount === 1 ? "" : "s"} detected.`,
    "Copilot pane: GitHub Copilot SDK stream. Aquarium: ambient agent state.",
    `Model: ${config.model ?? "default"} (use --model <id> before launch or /model <id> in the TUI).`,
  ];
}

export function createDebugMessages(): string[] {
  return ["[DEBUG] debug messages not yet reimplemented for v1 architecture"];
}

export function createHelpMessages(): string[] {
  return [
    "Squadquarium uses the GitHub Copilot SDK.",
    "Type a prompt and press Enter. Use --yolo to auto-approve SDK tool calls.",
    "Without --yolo, permission prompts are modal: press y or n.",
    "Local slash commands are available: type /help for the full list.",
    "Press Tab to autocomplete local commands and model ids.",
    "Use --model <id> before launch or /model <id> inside the TUI to select a model.",
  ];
}

export function createSlashCommandHelpMessages(): string[] {
  const width = Math.max(...LOCAL_SLASH_COMMANDS.map((command) => command.usage.length)) + 2;
  return [
    "Local slash commands:",
    ...LOCAL_SLASH_COMMANDS.map(
      (command) => `${command.usage.padEnd(width)}${command.description}`,
    ),
    "Press Tab to autocomplete commands and model ids.",
  ];
}

export type SlashAutocompleteResult =
  | { kind: "none" }
  | { kind: "complete"; value: string }
  | { kind: "suggest"; message: string }
  | { kind: "need-models" };

export function completeSlashInput(
  input: string,
  commands: readonly string[] = AUTOCOMPLETE_COMMAND_NAMES,
  modelIds: readonly string[] = [],
): SlashAutocompleteResult {
  if (!input.startsWith("/") || input.startsWith("//")) return { kind: "none" };

  const commandMatch = input.match(/^\/([^\s/]*)$/);
  if (commandMatch) {
    const prefix = commandMatch[1]?.toLowerCase() ?? "";
    const matches = commands.filter((command) => command.startsWith(prefix));
    if (matches.length === 1) return { kind: "complete", value: `/${matches[0]} ` };
    const common = commonPrefix(matches.map((command) => `/${command}`));
    if (matches.length > 1 && common.length > input.length) {
      return { kind: "complete", value: common };
    }
    if (matches.length > 1) {
      return {
        kind: "suggest",
        message: `[sqq] Commands: ${matches.map((m) => `/${m}`).join(" ")}`,
      };
    }
    return { kind: "suggest", message: `[sqq] No local command matches /${prefix}.` };
  }

  const modelMatch = input.match(/^\/models?\s+(.+)?$/);
  if (!modelMatch) return { kind: "none" };
  if (modelIds.length === 0) return { kind: "need-models" };

  const prefix = (modelMatch[1] ?? "").trim().toLowerCase();
  const baseCommand = input.startsWith("/models") ? "/models" : "/model";
  const matches = modelIds.filter((id) => id.toLowerCase().startsWith(prefix));
  if (matches.length === 1) return { kind: "complete", value: `${baseCommand} ${matches[0]}` };
  const common = commonPrefix(matches.map((id) => `${baseCommand} ${id}`));
  if (matches.length > 1 && common.length > input.length) {
    return { kind: "complete", value: common };
  }
  if (matches.length > 1) {
    return {
      kind: "suggest",
      message: `[sqq] Models: ${matches.slice(0, 8).join(" ")}${
        matches.length > 8 ? ` (${matches.length - 8} more)` : ""
      }`,
    };
  }
  return { kind: "suggest", message: `[sqq] No model id matches "${prefix}".` };
}

export function getSlashCompletionHint(
  input: string,
  commands: readonly string[] = AUTOCOMPLETE_COMMAND_NAMES,
  modelIds: readonly string[] = [],
): string | null {
  const result = completeSlashInput(input, commands, modelIds);
  if (result.kind !== "complete" || !result.value.startsWith(input)) {
    return null;
  }

  const suffix = result.value.slice(input.length);
  return suffix.length > 0 ? suffix : null;
}

function commonPrefix(values: readonly string[]): string {
  if (values.length === 0) return "";

  let prefix = values[0] ?? "";
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix) && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
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

function syncAquariumActorStates(state: RuntimeState): void {
  for (const row of state.commandCenterPane.getRows()) {
    const activeUntil = state.aquariumActiveUntil.get(row.id) ?? 0;
    const isHeldActive = activeUntil > state.frame;
    if (!isHeldActive && activeUntil > 0) {
      state.aquariumActiveUntil.delete(row.id);
    }
    const actorState =
      row.status === "working" || isHeldActive
        ? "working"
        : row.status === "error"
          ? "blocked"
          : "idle";
    state.aquariumScene.setActorStateById(row.id, actorState);
  }
}

function updateAquariumActivityHold(state: RuntimeState, id: string): void {
  const row = state.commandCenterPane.getRows().find((candidate) => candidate.id === id);
  if (row?.status === "working") {
    state.aquariumActiveUntil.set(id, Number.POSITIVE_INFINITY);
    return;
  }
  state.aquariumActiveUntil.set(id, state.frame + getAquariumActiveHoldFrames(state));
}

function holdWorkingAquariumActors(state: RuntimeState): void {
  const holdUntil = state.frame + getAquariumActiveHoldFrames(state);
  for (const row of state.commandCenterPane.getRows()) {
    if (row.status === "working") {
      state.aquariumActiveUntil.set(row.id, holdUntil);
    }
  }
}

function getAquariumActiveHoldFrames(state: RuntimeState): number {
  return Math.max(1, Math.round(state.config.fps * AQUARIUM_ACTIVE_HOLD_SECONDS));
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
  const commandCenterBuffer = createBuffer(
    Math.max(1, layout.commandCenter.width),
    Math.max(1, layout.commandCenter.height),
    { dst: root, x: layout.commandCenter.x, y: layout.commandCenter.y },
    effectiveConfig.headless,
  );

  const squadWatcher = new SquadWatcher(effectiveConfig.cwd ?? process.cwd());
  const squadState = squadWatcher.readState();

  const aquariumScene = createAquariumScene(layout.aquarium, capabilities, assets, squadState);
  const activityLog = new ActivityLog();
  const copilotPane = new CopilotPane();
  const commandCenterPane = new CommandCenterPane(
    squadState.agents.length > 0 ? squadState.agents : defaultAgents(),
  );

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
  copilotPane.write("\nCopilot SDK stream will appear here when connected.\n");

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
      runtime.commandCenterPane.updateRoster(
        newState.agents.length > 0 ? newState.agents : defaultAgents(),
      );
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
    commandCenterBuffer,
    aquariumScene,
    activityLog,
    copilotPane,
    commandCenterPane,
    copilotManager: null,
    modalPrompt: null,
    modelAutocompleteIds: null,
    loadingModelAutocomplete: false,
    mouseHandler,
    uiColors,
    capabilities,
    squadWatcher,
    squadState,
    aquariumActiveUntil: new Map(),
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
  terminal.grabInput?.(state.config.enableMouse ? { mouse: "button" } : true);
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
    handleKey(state, key);
  };

  state.mouseListener = (name: unknown, data: unknown) => {
    state.mouseHandler.dispatch(name as string, data as MouseEventData);
  };

  state.resizeListener = () => {
    if (!runtime) return;
    rebuildBuffers(runtime);
    render(runtime);
  };

  if (!state.config.headless) {
    terminal.on("key", state.keyListener as EventListener);
    if (state.config.enableMouse) {
      terminal.on("mouse", state.mouseListener as EventListener);
    }
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
  state.commandCenterBuffer = createBuffer(
    Math.max(1, state.layout.commandCenter.width),
    Math.max(1, state.layout.commandCenter.height),
    { dst: state.root, x: state.layout.commandCenter.x, y: state.layout.commandCenter.y },
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
  syncAquariumActorStates(state);
  state.aquariumScene.tick();
  state.aquariumScene.render(state.aquariumBuffer as unknown as TerminalScreenBufferHD);

  // Copilot pane — SDK transcript plus editable input line
  state.copilotPane.setInputSuggestion(
    getSlashCompletionHint(
      state.copilotPane.getInput(),
      AUTOCOMPLETE_COMMAND_NAMES,
      state.modelAutocompleteIds ?? [],
    ),
  );
  state.copilotPane.render(state.copilotBuffer, state.layout.copilot, {
    fg: state.uiColors.fg,
    bg: state.uiColors.bg,
    dim: state.uiColors.dim,
    accent: state.uiColors.accent,
  });

  if (state.layout.commandCenter.width > 0) {
    state.commandCenterPane.render(
      state.commandCenterBuffer,
      state.layout.commandCenter,
      {
        fg: state.uiColors.fg,
        bg: state.uiColors.bg,
        dim: state.uiColors.dim,
        accent: state.uiColors.accent,
      },
      state.frame,
    );
  }

  state.aquariumBuffer.draw();
  state.copilotBuffer.draw();
  if (state.layout.commandCenter.width > 0) {
    state.commandCenterBuffer.draw();
  }

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
    terminal.hideCursor?.();
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
    autoCycleStates: false,
  });

  const agents = squadState.agents.length > 0 ? squadState.agents : defaultAgents();
  const spacing = Math.max(1, Math.floor(rect.width / (agents.length + 1)));

  agents.forEach((agent, i) => {
    const sprite = spriteRoleFor(agent.role, spriteRoles);
    const x = Math.min(spacing * (i + 1), Math.max(0, rect.width - 12));
    const y = Math.max(0, Math.floor(rect.height / 2) - 2 + (i % 2 === 0 ? -1 : 1));
    const actor = aquarium.addActor(sprite, x, y, "idle");
    aquarium.setActorLabel(actor, {
      id: normalizeAgentId(agent.name),
      name: capitalize(agent.name),
      role: agent.role,
    });
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

function handleKey(state: RuntimeState, key: string): void {
  if (key === "CTRL_C") {
    if (state.copilotManager?.busy || state.copilotManager?.waitingForModal) {
      void state.copilotManager.abort();
    } else {
      void stopApp();
    }
    return;
  }

  if (state.modalPrompt?.kind === "permission") {
    if (/^[yYnN]$/.test(key)) {
      state.copilotManager?.resolveModal(key);
    } else if (key === "ESCAPE") {
      state.copilotManager?.resolveModal("n");
    }
    return;
  }

  switch (key) {
    case "ENTER": {
      const value = state.copilotPane.consumeInput();
      if (state.modalPrompt?.kind === "user-input") {
        state.copilotManager?.resolveModal(value);
        return;
      }
      if (value.startsWith("//")) {
        markPromptTargetAgentWorking(state, value.slice(1));
        void state.copilotManager?.send(value.slice(1));
        return;
      }
      if (value.startsWith("/") && handleLocalSlashCommand(state, value)) {
        return;
      }
      markPromptTargetAgentWorking(state, value);
      void state.copilotManager?.send(value);
      return;
    }
    case "BACKSPACE":
      state.copilotPane.backspaceInput();
      return;
    case "CTRL_U":
      state.copilotPane.clearInput();
      return;
    case "TAB":
      void autocompleteInput(state);
      return;
    case "UP":
    case "PAGE_UP":
      state.copilotPane.scroll(3);
      return;
    case "DOWN":
    case "PAGE_DOWN":
      state.copilotPane.scroll(-3);
      return;
    default:
      if (key.length === 1) {
        state.copilotPane.appendInput(key);
      }
  }
}

async function autocompleteInput(state: RuntimeState): Promise<void> {
  if (state.modalPrompt) return;

  const input = state.copilotPane.getInput();
  const result = completeSlashInput(
    input,
    AUTOCOMPLETE_COMMAND_NAMES,
    state.modelAutocompleteIds ?? [],
  );
  if (result.kind === "complete") {
    state.copilotPane.setInput(result.value);
    return;
  }
  if (result.kind === "suggest") {
    state.copilotPane.write(`\n${result.message}\n`);
    return;
  }
  if (result.kind !== "need-models" || state.loadingModelAutocomplete) return;

  const manager = state.copilotManager;
  if (!manager) {
    state.copilotPane.write("\n[sqq] Copilot SDK is not connected yet.\n");
    return;
  }

  state.loadingModelAutocomplete = true;
  state.copilotPane.write("\n[sqq] Loading model completions...\n");
  try {
    const models = await manager.listModels();
    state.modelAutocompleteIds = models.map((model) => model.id).sort();
    if (state.copilotPane.getInput() === input) {
      const retry = completeSlashInput(
        input,
        AUTOCOMPLETE_COMMAND_NAMES,
        state.modelAutocompleteIds,
      );
      if (retry.kind === "complete") {
        state.copilotPane.setInput(retry.value);
      } else if (retry.kind === "suggest") {
        state.copilotPane.write(`${retry.message}\n`);
      }
    }
  } catch (error) {
    state.copilotPane.write(`[sqq] Could not load model completions: ${formatError(error)}\n`);
  } finally {
    state.loadingModelAutocomplete = false;
  }
}

function updateCopilotInputStatus(state: RuntimeState): void {
  if (state.modalPrompt) {
    state.copilotPane.setInputStatus(null);
    return;
  }
  const manager = state.copilotManager;
  if (!manager) {
    state.copilotPane.setInputStatus("Copilot: disconnected");
    return;
  }
  if (manager.currentState === "starting") {
    state.copilotPane.setInputStatus("Copilot: connecting...");
    return;
  }
  if (manager.currentState === "streaming") {
    state.copilotPane.setInputStatus(manager.currentActivity ?? "Copilot is thinking...");
    return;
  }
  const model = manager.currentModel ?? state.config.model;
  state.copilotPane.setInputStatus(model ? `model: ${model}` : "Copilot: ready");
}

function handleLocalSlashCommand(state: RuntimeState, input: string): boolean {
  const trimmed = input.trim();
  const [rawName = "", ...rest] = trimmed.slice(1).split(/\s+/);
  const name = rawName.toLowerCase();
  const args = rest.join(" ").trim();

  switch (name) {
    case "help":
    case "commands":
      state.copilotPane.write(`\n${createSlashCommandHelpMessages().join("\n")}\n`);
      return true;
    case "clear":
      state.copilotPane.clear();
      state.copilotPane.write("[sqq] Transcript cleared.\n");
      return true;
    case "copy":
      void copyTranscriptToClipboard(state);
      return true;
    case "status":
      writeLocalStatus(state);
      return true;
    case "models":
      void listAvailableModels(state, args);
      return true;
    case "model":
      void showOrSwitchModel(state, args);
      return true;
    default:
      state.copilotPane.write(
        `\n[sqq] Unknown local command /${name}; sending it to Copilot. Type /help for local commands.\n`,
      );
      markPromptTargetAgentWorking(state, input);
      void state.copilotManager?.send(input);
      return true;
  }
}

function markPromptTargetAgentWorking(state: RuntimeState, prompt: string): void {
  if (!state.copilotManager || state.copilotManager.currentState === "closed") return;

  const targetId = detectPromptTargetAgentId(prompt, state.commandCenterPane.getRows());
  if (!targetId) return;

  const row = state.commandCenterPane.getRows().find((candidate) => candidate.id === targetId);
  state.commandCenterPane.applyUpdate({
    name: targetId,
    displayName: row?.name,
    role: row?.role,
    status: "working",
    task: "responding to prompt",
    model: state.copilotManager?.currentModel ?? state.config.model,
  });
  updateAquariumActivityHold(state, targetId);
}

export function detectPromptTargetAgentId(
  prompt: string,
  rows: readonly { id: string; name: string }[],
): string | null {
  const firstToken = prompt.trim().match(/^@?([A-Za-z][\w-]*)\b/)?.[1];
  if (!firstToken) return null;

  const normalized = normalizeAgentId(firstToken);
  return rows.some((row) => row.id === normalized) ? normalized : null;
}

async function copyTranscriptToClipboard(state: RuntimeState): Promise<void> {
  const transcript = state.copilotPane.getTranscriptText();
  if (!transcript.trim()) {
    state.copilotPane.write("\n[sqq] Nothing to copy yet.\n");
    return;
  }

  try {
    await copyTextToClipboard(transcript);
    state.copilotPane.write("\n[sqq] Copied chat transcript to clipboard.\n");
  } catch (error) {
    state.copilotPane.write(`[sqq] Could not copy transcript: ${formatError(error)}\n`);
  }
}

function copyTextToClipboard(text: string): Promise<void> {
  if (process.platform !== "win32") {
    return Promise.reject(new Error("clipboard copy is only implemented on Windows"));
  }

  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-Command", "Set-Clipboard -Value ([Console]::In.ReadToEnd())"],
      { stdio: ["pipe", "ignore", "pipe"], windowsHide: true },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `clipboard command exited with code ${code ?? "unknown"}`));
    });
    child.stdin.end(text);
  });
}

function writeLocalStatus(state: RuntimeState): void {
  const manager = state.copilotManager;
  const lines = [
    "[sqq] Status",
    `  SDK: ${manager?.currentState ?? "disconnected"}`,
    `  mode: ${state.config.sdkMode ?? "chat"}`,
    `  model: ${manager?.currentModel ?? state.config.model ?? "default"}`,
    `  approvals: ${state.config.yolo ? "auto (--yolo)" : "prompt"}`,
    `  squad: ${state.squadState.squadRoot ?? "not detected"}`,
  ];
  state.copilotPane.write(`\n${lines.join("\n")}\n`);
}

async function listAvailableModels(state: RuntimeState, filter: string): Promise<void> {
  const manager = state.copilotManager;
  if (!manager) {
    state.copilotPane.write("\n[sqq] Copilot SDK is not connected yet.\n");
    return;
  }
  try {
    const models = await manager.listModels();
    state.modelAutocompleteIds = models.map((model) => model.id).sort();
    const normalizedFilter = filter.toLowerCase();
    const filtered = normalizedFilter
      ? models.filter(
          (model) =>
            model.id.toLowerCase().includes(normalizedFilter) ||
            model.name.toLowerCase().includes(normalizedFilter),
        )
      : models;
    const shown = filtered.slice(0, 15);
    const lines = shown.map((model) =>
      model.name === model.id ? `  ${model.id}` : `  ${model.id} — ${model.name}`,
    );
    const suffix =
      filtered.length > shown.length ? `\n  Showing ${shown.length} of ${filtered.length}.` : "";
    state.copilotPane.write(
      `\n[sqq] Available models${filter ? ` matching "${filter}"` : ""}:\n${
        lines.join("\n") || "  (none)"
      }${suffix}\n`,
    );
  } catch (error) {
    state.copilotPane.write(`[sqq] Could not list models: ${formatError(error)}\n`);
  }
}

async function showOrSwitchModel(state: RuntimeState, modelId: string): Promise<void> {
  const manager = state.copilotManager;
  if (!manager) {
    state.copilotPane.write("\n[sqq] Copilot SDK is not connected yet.\n");
    return;
  }
  if (!modelId) {
    state.copilotPane.write(
      `\n[sqq] Current model: ${manager.currentModel ?? state.config.model ?? "default"}.\n`,
    );
    state.copilotPane.write("[sqq] Use /models to discover ids, then /model <id> to switch.\n");
    return;
  }
  try {
    await manager.switchModel(modelId);
    updateCopilotInputStatus(state);
  } catch (error) {
    state.copilotPane.write(`[sqq] Could not switch model: ${formatError(error)}\n`);
  }
}

function formatModalHint(prompt: CopilotModalPrompt): string {
  if (prompt.kind === "permission") {
    return `${prompt.message} [y/n]`;
  }
  const choices = prompt.choices?.length ? ` (${prompt.choices.join("/")})` : "";
  return `${prompt.message}${choices}: `;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
