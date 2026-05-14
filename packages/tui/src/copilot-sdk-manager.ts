import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import type {
  CopilotClientOptions,
  CustomAgentConfig,
  ElicitationResult,
  ModelInfo,
  PermissionRequest,
  PermissionRequestResult,
  SessionConfig,
  SessionEvent,
} from "@github/copilot-sdk";
import type { AgentInfo, SquadState } from "./squad-watcher.js";

export type CopilotSdkMode = "chat" | "triage" | "loop";
export type CopilotSdkState = "idle" | "starting" | "streaming" | "closed" | "error";

export interface CopilotModalPrompt {
  kind: "permission" | "user-input";
  message: string;
  choices?: string[];
}

export interface CopilotSdkManagerEvents {
  output: [string];
  status: [string];
  modal: [CopilotModalPrompt | null];
  state: [CopilotSdkState];
  agent: [
    string,
    "working" | "idle" | "error",
    { displayName?: string; role?: string; task?: string; model?: string },
  ];
}

export interface CopilotSdkStartOptions {
  cwd: string;
  yolo?: boolean;
  model?: string;
  mode?: CopilotSdkMode;
  extraArgs?: string[];
  squadState: SquadState;
  debug?: boolean;
}

export interface CopilotClientLike {
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  forceStop?(): Promise<void>;
  listModels?(): Promise<ModelInfo[]>;
  createSession(config: SessionConfig): Promise<CopilotSessionLike>;
}

export interface CopilotSessionLike {
  sessionId: string;
  send(options: { prompt: string; mode?: "enqueue" | "immediate" }): Promise<string>;
  abort(): Promise<void>;
  disconnect(): Promise<void>;
  rpc?: {
    model?: {
      getCurrent?(): Promise<{ modelId?: string }>;
      switchTo?(params: {
        modelId: string;
        reasoningEffort?: string;
      }): Promise<{ modelId?: string }>;
    };
  };
}

export type CopilotClientFactory = (options: CopilotClientOptions) => CopilotClientLike;

interface UserInputRequestLike {
  question: string;
  choices?: string[];
  allowFreeform?: boolean;
}

interface UserInputResponseLike {
  answer: string;
  wasFreeform: boolean;
}

interface PendingPermission {
  kind: "permission";
  resolve: (result: PermissionRequestResult) => void;
}

interface PendingUserInput {
  kind: "user-input";
  resolve: (result: UserInputResponseLike) => void;
}

type PendingModal = PendingPermission | PendingUserInput;

const COORDINATOR_AGENT_NAME = "squad";

export class CopilotSdkManager extends EventEmitter<CopilotSdkManagerEvents> {
  private client: CopilotClientLike | null = null;
  private session: CopilotSessionLike | null = null;
  private state: CopilotSdkState = "closed";
  private pendingModal: PendingModal | null = null;
  private readonly streamedMessages = new Map<string, string>();
  private readonly printedAssistantContents: string[] = [];
  private readonly factory: CopilotClientFactory | null;
  private autoApprove = false;
  private debugOutput = false;
  private activityStatus: string | undefined;
  private selectedModel: string | undefined;

  constructor(factory?: CopilotClientFactory) {
    super();
    this.factory = factory ?? null;
  }

  get currentState(): CopilotSdkState {
    return this.state;
  }

  get busy(): boolean {
    return this.state === "starting" || this.state === "streaming";
  }

  get waitingForModal(): boolean {
    return this.pendingModal !== null;
  }

  get currentModel(): string | undefined {
    return this.selectedModel;
  }

  get currentActivity(): string | undefined {
    return this.activityStatus;
  }

  async start(options: CopilotSdkStartOptions): Promise<void> {
    if (this.client || this.session) {
      throw new Error("Copilot SDK session is already running.");
    }

    this.autoApprove = options.yolo === true;
    this.debugOutput = options.debug === true;
    this.selectedModel = options.model;
    this.setState("starting");

    const client = await this.createClient({
      cwd: options.cwd,
      useStdio: true,
      logLevel: options.debug ? "debug" : "warning",
    });
    this.client = client;

    await client.start();

    const customAgents = buildSquadCustomAgents(options.squadState);
    const initialPrompt = buildInitialPrompt(options.mode ?? "chat", options.extraArgs ?? []);
    const skillDirectories = collectExistingDirectories([
      options.squadState.squadRoot ? path.join(options.squadState.squadRoot, "skills") : null,
    ]);

    this.session = await client.createSession({
      clientName: "squadquarium",
      workingDirectory: options.cwd,
      ...(options.model ? { model: options.model } : {}),
      streaming: true,
      includeSubAgentStreamingEvents: false,
      enableConfigDiscovery: true,
      ...(customAgents.length > 0
        ? {
            customAgents,
            agent: COORDINATOR_AGENT_NAME,
          }
        : {}),
      ...(skillDirectories.length > 0 ? { skillDirectories } : {}),
      systemMessage: {
        mode: "append",
        content: buildSquadquariumSystemMessage(options.squadState),
      },
      onPermissionRequest: (request) => this.handlePermissionRequest(request),
      onUserInputRequest: (request) => this.handleUserInputRequest(request),
      onElicitationRequest: (context): ElicitationResult => {
        this.emit(
          "output",
          `\n[sqq] Structured input requested: ${context.message}. This TUI cannot render forms yet, so the request was declined.\n`,
        );
        return { action: "decline" };
      },
      onEvent: (event) => this.handleEvent(event),
    });

    this.emit("output", `[sqq] Copilot SDK connected (session ${this.session.sessionId}).\n`);
    await this.refreshCurrentModel();
    this.emit("status", this.selectedModel ? `model: ${this.selectedModel}` : "");
    this.setState("idle");

    if (initialPrompt) {
      await this.send(initialPrompt, { echo: false });
    }
  }

  async send(prompt: string, options: { echo?: boolean } = {}): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (!this.session) {
      this.emit("output", "[sqq] Copilot SDK session is not connected yet.\n");
      return;
    }
    if (this.pendingModal) {
      this.emit("output", "[sqq] Answer the pending prompt before sending another message.\n");
      return;
    }
    if (this.state === "streaming") {
      this.emit("output", "[sqq] Copilot is still working. Wait for it to become idle.\n");
      return;
    }

    this.streamedMessages.clear();
    this.printedAssistantContents.length = 0;
    this.activityStatus = undefined;
    if (options.echo !== false) {
      this.emit("output", `\nYou: ${trimmed}\n`);
    }
    this.setState("streaming");

    try {
      await this.session.send({ prompt: trimmed });
    } catch (error) {
      this.setState("error");
      this.emit("output", `[sqq] Failed to send prompt: ${formatError(error)}\n`);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.client?.listModels) {
      throw new Error("Model listing is unavailable in this Copilot SDK runtime.");
    }
    return this.client.listModels();
  }

  async switchModel(modelId: string): Promise<void> {
    const trimmed = modelId.trim();
    if (!trimmed) {
      throw new Error("Model id is required.");
    }
    if (!this.session) {
      throw new Error("Copilot SDK session is not connected yet.");
    }
    if (this.pendingModal) {
      throw new Error("Answer the pending prompt before switching models.");
    }
    if (this.state === "streaming" || this.state === "starting") {
      throw new Error("Wait for Copilot to become idle before switching models.");
    }

    const switchTo = this.session.rpc?.model?.switchTo;
    if (!switchTo) {
      throw new Error("Model switching is unavailable in this Copilot SDK runtime.");
    }

    const result = await switchTo({ modelId: trimmed });
    this.selectedModel = result.modelId ?? trimmed;
    this.emit("output", `[sqq] Model switched to ${this.selectedModel}.\n`);
    this.emit("status", `model: ${this.selectedModel}`);
  }

  async abort(): Promise<void> {
    if (!this.session) return;
    if (this.pendingModal) {
      this.cancelPendingModal();
      return;
    }
    try {
      await this.session.abort();
      this.emit("output", "\n[sqq] Abort requested.\n");
    } catch (error) {
      this.emit("output", `[sqq] Failed to abort: ${formatError(error)}\n`);
    }
  }

  resolveModal(value: string): void {
    const pending = this.pendingModal;
    if (!pending) return;

    if (pending.kind === "permission") {
      const approved = /^y(?:es)?$/i.test(value.trim());
      this.pendingModal = null;
      this.emit("modal", null);
      pending.resolve(approved ? { kind: "approve-once" } : { kind: "reject" });
      this.emit("output", approved ? "[sqq] Permission approved.\n" : "[sqq] Permission denied.\n");
      return;
    }

    this.pendingModal = null;
    this.emit("modal", null);
    pending.resolve({ answer: value, wasFreeform: true });
  }

  async stop(): Promise<void> {
    this.cancelPendingModal();

    const session = this.session;
    const client = this.client;
    this.session = null;
    this.client = null;
    this.setState("closed");

    if (session) {
      await session.disconnect().catch((error: unknown) => {
        this.emit("output", `[sqq] Session disconnect failed: ${formatError(error)}\n`);
      });
    }

    if (client) {
      const errors = await client.stop().catch(async (error: unknown) => {
        this.emit("output", `[sqq] Copilot SDK stop failed: ${formatError(error)}\n`);
        await client.forceStop?.();
        return [];
      });
      for (const error of errors) {
        this.emit("output", `[sqq] Copilot SDK cleanup warning: ${error.message}\n`);
      }
    }
  }

  private async createClient(options: CopilotClientOptions): Promise<CopilotClientLike> {
    if (this.factory) return this.factory(options);
    const { CopilotClient } = await import("@github/copilot-sdk");
    return new CopilotClient(options) as CopilotClientLike;
  }

  private async refreshCurrentModel(): Promise<void> {
    const getCurrent = this.session?.rpc?.model?.getCurrent;
    if (!getCurrent) return;
    try {
      const current = await getCurrent();
      this.selectedModel = current.modelId ?? this.selectedModel;
    } catch (error) {
      this.emit("output", `[sqq] Could not read current model: ${formatError(error)}\n`);
    }
  }

  private handlePermissionRequest(
    request: PermissionRequest,
  ): Promise<PermissionRequestResult> | PermissionRequestResult {
    const label = formatPermissionRequest(request);

    if (this.autoApprove) {
      this.emit("output", `[sqq] --yolo approved ${label}.\n`);
      return { kind: "approve-once" };
    }

    if (this.pendingModal) {
      this.emit("output", `[sqq] Denied ${label}: another prompt is already pending.\n`);
      return { kind: "user-not-available" };
    }

    this.emit("output", `\n[sqq] Permission requested: ${label}\n`);
    this.emit("output", "[sqq] Press y to approve once, or n to deny.\n");
    this.emit("modal", { kind: "permission", message: `Approve ${label}?`, choices: ["y", "n"] });

    return new Promise<PermissionRequestResult>((resolve) => {
      this.pendingModal = { kind: "permission", resolve };
    });
  }

  private handleUserInputRequest(request: UserInputRequestLike): Promise<UserInputResponseLike> {
    if (this.pendingModal) {
      this.emit(
        "output",
        "[sqq] User input request could not be shown: another prompt is pending.\n",
      );
      return Promise.resolve({ answer: "", wasFreeform: true });
    }

    const choices = request.choices?.length ? request.choices : undefined;
    const suffix = choices ? ` (${choices.join("/")})` : "";
    this.emit("output", `\nCopilot asks: ${request.question}${suffix}\n`);
    this.emit("modal", { kind: "user-input", message: request.question, choices });

    return new Promise<UserInputResponseLike>((resolve) => {
      this.pendingModal = { kind: "user-input", resolve };
    });
  }

  private cancelPendingModal(): void {
    const pending = this.pendingModal;
    if (!pending) return;

    this.pendingModal = null;
    this.emit("modal", null);
    if (pending.kind === "permission") {
      pending.resolve({ kind: "user-not-available" });
    } else {
      pending.resolve({ answer: "", wasFreeform: true });
    }
  }

  private handleEvent(event: SessionEvent): void {
    switch (event.type) {
      case "session.idle":
        this.activityStatus = undefined;
        this.setState("idle");
        this.emit("status", "");
        break;
      case "session.error":
        this.setState("error");
        this.emit("output", `\n[sqq] Copilot error: ${event.data.message}\n`);
        break;
      case "session.model_change":
        this.selectedModel = event.data.newModel;
        if (this.debugOutput) {
          this.emit("output", `\n[sqq] Model changed to ${event.data.newModel}.\n`);
        }
        this.emit("status", `model: ${event.data.newModel}`);
        break;
      case "assistant.intent":
        this.activityStatus = event.data.intent;
        this.emit("status", event.data.intent);
        break;
      case "assistant.message_delta":
        if (event.agentId) {
          if (this.debugOutput) {
            this.emit("output", event.data.deltaContent);
          }
          break;
        }
        this.streamedMessages.set(
          event.data.messageId,
          `${this.streamedMessages.get(event.data.messageId) ?? ""}${event.data.deltaContent}`,
        );
        this.emit("output", event.data.deltaContent);
        break;
      case "assistant.message":
        if (event.agentId) {
          if (this.debugOutput && event.data.content) {
            this.emit("output", `${event.data.content}\n`);
          }
          break;
        }
        if (this.streamedMessages.has(event.data.messageId)) {
          const streamed = this.streamedMessages.get(event.data.messageId) ?? "";
          this.streamedMessages.delete(event.data.messageId);
          if (normalizeStreamedContent(streamed)) {
            this.rememberAssistantContent(streamed);
            this.emit("output", "\n");
          } else if (event.data.content) {
            this.writeAssistantContent(event.data.content);
          }
        } else if (event.data.content && this.deleteMatchingStreamedContent(event.data.content)) {
          this.rememberAssistantContent(event.data.content);
          this.emit("output", "\n");
        } else if (event.data.content) {
          this.writeAssistantContent(event.data.content);
        }
        break;
      case "tool.execution_start":
        this.activityStatus = `running ${event.data.toolName}...`;
        this.emit("status", this.activityStatus);
        if (this.debugOutput) {
          this.emit("output", `\n[tool] ${event.data.toolName} started.\n`);
        }
        break;
      case "tool.execution_partial_result":
        if (this.debugOutput) {
          this.emit("output", event.data.partialOutput);
        }
        break;
      case "tool.execution_progress":
        this.activityStatus = event.data.progressMessage;
        this.emit("status", this.activityStatus);
        if (this.debugOutput) {
          this.emit("output", `[tool] ${event.data.progressMessage}\n`);
        }
        break;
      case "tool.execution_complete":
        this.activityStatus = undefined;
        this.emit("status", "");
        if (this.debugOutput || !event.data.success) {
          this.emit(
            "output",
            `[tool] ${event.data.toolCallId} ${event.data.success ? "completed" : "failed"}.\n`,
          );
        }
        break;
      case "subagent.started": {
        const name = event.data.agentDisplayName ?? event.data.agentName;
        this.activityStatus = `${name} is working...`;
        this.emit("agent", event.data.agentName, "working", {
          displayName: name,
          role: event.data.agentDescription,
          task: "delegated by Copilot",
          model: event.data.model,
        });
        this.emit("status", this.activityStatus);
        if (this.debugOutput) {
          this.emit("output", `\n[agent] ${name} started.\n`);
        }
        break;
      }
      case "subagent.completed": {
        const name = event.data.agentDisplayName ?? event.data.agentName;
        this.activityStatus = undefined;
        this.emit("agent", event.data.agentName, "idle", {
          displayName: name,
          task: event.data.durationMs
            ? `completed in ${formatDuration(event.data.durationMs)}`
            : "standing by",
          model: event.data.model,
        });
        this.emit("status", "");
        if (this.debugOutput) {
          this.emit("output", `[agent] ${name} completed.\n`);
        }
        break;
      }
      case "subagent.failed": {
        const name = event.data.agentDisplayName ?? event.data.agentName;
        this.activityStatus = undefined;
        this.emit("agent", event.data.agentName, "error", {
          displayName: name,
          task: event.data.error,
          model: event.data.model,
        });
        this.emit("status", "");
        this.emit("output", `[agent] ${name} failed: ${event.data.error}\n`);
        break;
      }
      default:
        break;
    }
  }

  private setState(state: CopilotSdkState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit("state", state);
  }

  private deleteMatchingStreamedContent(content: string): boolean {
    const normalizedContent = normalizeAssistantContent(content);
    for (const [messageId, streamed] of this.streamedMessages) {
      const normalizedStreamed = normalizeAssistantContent(streamed);
      if (!normalizedStreamed || !normalizedContent) {
        continue;
      }
      const longEnoughForFuzzyMatch =
        Math.min(normalizedStreamed.length, normalizedContent.length) >= 8;
      if (
        normalizedStreamed === normalizedContent ||
        (longEnoughForFuzzyMatch &&
          (normalizedContent.includes(normalizedStreamed) ||
            normalizedStreamed.includes(normalizedContent)))
      ) {
        this.streamedMessages.delete(messageId);
        return true;
      }
    }
    return false;
  }

  private writeAssistantContent(content: string): void {
    if (this.isDuplicateAssistantContent(content)) {
      return;
    }
    this.rememberAssistantContent(content);
    this.emit("output", `${content}\n`);
  }

  private rememberAssistantContent(content: string): void {
    const normalized = normalizeAssistantContent(content);
    if (normalized.length < 8) {
      return;
    }
    this.printedAssistantContents.push(normalized);
    if (this.printedAssistantContents.length > 8) {
      this.printedAssistantContents.splice(0, this.printedAssistantContents.length - 8);
    }
  }

  private isDuplicateAssistantContent(content: string): boolean {
    const normalized = normalizeAssistantContent(content);
    if (normalized.length < 8) {
      return false;
    }
    return this.printedAssistantContents.some((printed) => {
      if (printed === normalized) {
        return true;
      }
      const longEnoughForWrappedRepeat = Math.min(printed.length, normalized.length) >= 12;
      return (
        longEnoughForWrappedRepeat && (normalized.includes(printed) || printed.includes(normalized))
      );
    });
  }
}

export function buildSquadCustomAgents(squadState: SquadState): CustomAgentConfig[] {
  if (!squadState.squadRoot || squadState.agents.length === 0) return [];

  const agents = dedupeAgents(squadState.agents);
  const memberAgents = agents.map((agent) => buildMemberAgent(squadState.squadRoot!, agent));

  return [
    {
      name: COORDINATOR_AGENT_NAME,
      displayName: squadState.teamName || "Squad",
      description:
        "Coordinates the local .squad team, routes work to member sub-agents, and keeps the user informed.",
      prompt: buildCoordinatorPrompt(squadState, memberAgents),
      tools: null,
      infer: false,
    },
    ...memberAgents,
  ];
}

export function buildInitialPrompt(mode: CopilotSdkMode, extraArgs: string[]): string | null {
  const args = extraArgs.length > 0 ? extraArgs.join(" ") : "(none)";

  if (mode === "triage") {
    return [
      "Run a Squad triage pass for this workspace using the local .squad team.",
      `CLI-style arguments supplied to sqq triage: ${args}.`,
      extraArgs.includes("--execute")
        ? "The user supplied --execute, so you may perform approved mutations needed for triage."
        : "The user did not supply --execute, so analyze and propose triage actions without mutating files or remote state.",
    ].join("\n");
  }

  if (mode === "loop") {
    return [
      "Run one Squad loop cycle for this workspace using the local .squad team.",
      `CLI-style arguments supplied to sqq loop: ${args}.`,
      extraArgs.includes("--init")
        ? "The user supplied --init. Help draft or explain loop.md initialization, but request approval before creating or editing files."
        : "This TUI starts an interactive SDK session, not a background daemon; complete one useful loop cycle and then wait for the next user prompt.",
    ].join("\n");
  }

  return null;
}

function buildMemberAgent(squadRoot: string, agent: AgentInfo): CustomAgentConfig {
  const charter = readAgentCharter(squadRoot, agent.name);
  const safeName = sanitizeAgentName(agent.name);

  return {
    name: safeName === COORDINATOR_AGENT_NAME ? `${safeName}-member` : safeName,
    displayName: capitalize(agent.name),
    description: `${agent.role || "Squad member"} for the local .squad team.`,
    prompt: appendMemberBrevityGuidance(
      charter ||
        `You are ${capitalize(agent.name)}, ${agent.role || "a member"} of this repository's .squad team. Follow the team's routing rules and keep changes focused.`,
    ),
    tools: null,
    infer: true,
  };
}

function buildCoordinatorPrompt(squadState: SquadState, memberAgents: CustomAgentConfig[]): string {
  const roster = memberAgents
    .map((agent) => `- ${agent.displayName ?? agent.name}: ${agent.description ?? "Squad member"}`)
    .join("\n");

  return [
    `You are the Squad coordinator for ${squadState.teamName || "this repository"}.`,
    "Route work to the available .squad member agents when their role fits the user's request.",
    "Do not edit files inside .squad/ unless the user explicitly asks for a Squad decision/log artifact.",
    "Prefer the repository's existing instructions, tests, and validation gates.",
    "For casual direct member requests like 'Dallas say hi', return only the member's brief response. Do not add routing summaries, blockquote repeats, or charter recaps unless the user asks for them.",
    squadState.focus ? `Current team focus: ${squadState.focus}` : "",
    squadState.recentDecision ? `Recent decision: ${squadState.recentDecision}` : "",
    "Available members:",
    roster || "- No member agents were discovered.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSquadquariumSystemMessage(squadState: SquadState): string {
  return [
    "You are running inside Squadquarium, a rich terminal TUI backed by the GitHub Copilot SDK.",
    "The user sees your streamed responses in the main pane and an ambient aquarium visualization of the .squad team.",
    "Treat this as a prompt/response SDK session, not as an ANSI terminal emulator.",
    squadState.squadRoot
      ? `Squad root detected at ${squadState.squadRoot}. Squadquarium observes .squad files for UI state.`
      : "No .squad root was detected; behave like a normal Copilot coding session.",
  ].join("\n");
}

function readAgentCharter(squadRoot: string, name: string): string {
  const charterPath = path.join(squadRoot, "agents", name, "charter.md");
  try {
    return fs.readFileSync(charterPath, "utf8").trim();
  } catch {
    return "";
  }
}

function sanitizeAgentName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "agent";
}

function dedupeAgents(agents: AgentInfo[]): AgentInfo[] {
  const seen = new Set<string>();
  return agents.filter((agent) => {
    const name = sanitizeAgentName(agent.name);
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

function collectExistingDirectories(paths: Array<string | null>): string[] {
  return paths.filter((value): value is string => {
    if (!value) return false;
    try {
      return fs.statSync(value).isDirectory();
    } catch {
      return false;
    }
  });
}

function formatPermissionRequest(request: PermissionRequest): string {
  const data = request as PermissionRequest & Record<string, unknown>;
  if (request.kind === "shell" && typeof data.fullCommandText === "string") {
    return `shell command: ${data.fullCommandText}`;
  }
  if (request.kind === "write" && typeof data.fileName === "string") {
    return `write: ${data.fileName}`;
  }
  if (request.kind === "read" && typeof data.path === "string") {
    return `read: ${data.path}`;
  }
  if (request.kind === "url" && typeof data.url === "string") {
    return `fetch URL: ${data.url}`;
  }
  if (request.kind === "mcp" && typeof data.toolName === "string") {
    return `MCP tool: ${data.toolName}`;
  }
  if (request.kind === "custom-tool" && typeof data.toolName === "string") {
    return `custom tool: ${data.toolName}`;
  }
  return request.kind;
}

function normalizeStreamedContent(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function appendMemberBrevityGuidance(prompt: string): string {
  return `${prompt}\n\nFor casual greeting or check-in requests, answer in one or two short sentences. Do not recite this charter unless asked.`;
}

function normalizeAssistantContent(value: string): string {
  return normalizeStreamedContent(
    value
      .replace(/^>\s?/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1"),
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
