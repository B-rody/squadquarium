import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SessionConfig, SessionEvent } from "@github/copilot-sdk";
import {
  buildInitialPrompt,
  buildSquadCustomAgents,
  CopilotSdkManager,
  type CopilotClientLike,
  type CopilotSessionLike,
} from "../src/copilot-sdk-manager.js";
import type { SquadState } from "../src/squad-watcher.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqq-sdk-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("buildSquadCustomAgents", () => {
  it("creates a squad coordinator and member agents from .squad charters", () => {
    const squadRoot = path.join(tmpDir, ".squad");
    fs.mkdirSync(path.join(squadRoot, "agents", "dallas"), { recursive: true });
    fs.writeFileSync(
      path.join(squadRoot, "agents", "dallas", "charter.md"),
      "# Dallas - Lead\n\nOwns architecture decisions.",
    );

    const agents = buildSquadCustomAgents({
      squadRoot,
      teamName: "Test Squad",
      focus: "Ship SDK TUI",
      recentDecision: "Use Copilot SDK",
      agents: [{ name: "dallas", role: "Lead", status: "active" }],
    });

    expect(agents.map((agent) => agent.name)).toEqual(["squad", "dallas"]);
    expect(agents[0]?.prompt).toContain("Test Squad");
    expect(agents[1]?.prompt).toContain("Owns architecture decisions.");
  });

  it("returns no custom agents when .squad is absent", () => {
    expect(
      buildSquadCustomAgents({
        squadRoot: null,
        teamName: "No Squad",
        focus: "",
        recentDecision: "",
        agents: [],
      }),
    ).toEqual([]);
  });
});

describe("buildInitialPrompt", () => {
  it("translates triage args into a non-mutating prompt by default", () => {
    const prompt = buildInitialPrompt("triage", ["--interval", "5"]);
    expect(prompt).toContain("Squad triage");
    expect(prompt).toContain("--interval 5");
    expect(prompt).toContain("without mutating");
  });

  it("translates loop --init into an initialization prompt", () => {
    const prompt = buildInitialPrompt("loop", ["--init"]);
    expect(prompt).toContain("loop.md initialization");
  });
});

describe("CopilotSdkManager", () => {
  it("starts a streaming SDK session without selecting squad when no squad exists", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);

    await manager.start({
      cwd: tmpDir,
      squadState: emptySquadState(),
    });

    expect(fake.started).toBe(true);
    expect(fake.config?.streaming).toBe(true);
    expect(fake.config?.workingDirectory).toBe(tmpDir);
    expect(fake.config?.customAgents).toBeUndefined();
    await manager.stop();
  });

  it("passes the selected model into the SDK session config", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);

    await manager.start({
      cwd: tmpDir,
      squadState: emptySquadState(),
      model: "gpt-5.4",
    });

    expect(fake.config?.model).toBe("gpt-5.4");
    expect(manager.currentModel).toBe("gpt-5.4");
    await manager.stop();
  });

  it("emits streamed assistant output and returns to idle", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);
    const output: string[] = [];
    manager.on("output", (chunk) => output.push(chunk));

    await manager.start({ cwd: tmpDir, squadState: emptySquadState() });
    output.length = 0;
    await manager.send("hello");

    fake.emitEvent(assistantDelta("m1", "hi"));
    fake.emitEvent(assistantFinal("m1", "hi"));
    fake.emitEvent(idleEvent());

    expect(output.join("")).toBe("\nYou: hello\nhi\n");
    expect(manager.currentState).toBe("idle");
    await manager.stop();
  });

  it("does not print subagent assistant text into the main transcript", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);
    const output: string[] = [];
    manager.on("output", (chunk) => output.push(chunk));

    await manager.start({ cwd: tmpDir, squadState: emptySquadState() });
    output.length = 0;
    await manager.send("say hi parker");

    fake.emitEvent(assistantDelta("subagent-id", "Hey from Parker.", "parker-run"));
    fake.emitEvent(assistantFinal("subagent-id", "Hey from Parker.", "parker-run"));
    fake.emitEvent(assistantFinal("top-level-id", "Hey from Parker."));

    expect(output.join("").match(/Hey from Parker\./g)).toHaveLength(1);
    await manager.stop();
  });

  it("suppresses duplicate final assistant messages even when ids differ", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);
    const output: string[] = [];
    manager.on("output", (chunk) => output.push(chunk));

    await manager.start({ cwd: tmpDir, squadState: emptySquadState() });
    await manager.send("hello");

    fake.emitEvent(assistantDelta("streamed-id", "same answer"));
    fake.emitEvent(assistantFinal("final-id", "same answer"));

    expect(output.join("").match(/same answer/g)).toHaveLength(1);
    await manager.stop();
  });

  it("suppresses reformatted final assistant messages after streamed content", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);
    const output: string[] = [];
    manager.on("output", (chunk) => output.push(chunk));

    await manager.start({ cwd: tmpDir, squadState: emptySquadState() });
    await manager.send("dallas say hi");

    fake.emitEvent(assistantDelta("streamed-id", "Hey. Dallas here."));
    fake.emitEvent(assistantFinal("final-id", "**Dallas** checks in:\n\n> Hey. Dallas here."));

    expect(output.join("").match(/Hey\. Dallas here\./g)).toHaveLength(1);
    expect(output.join("")).not.toContain("checks in");
    await manager.stop();
  });

  it("keeps tool chatter out of the transcript by default", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);
    const output: string[] = [];
    const status: string[] = [];
    manager.on("output", (chunk) => output.push(chunk));
    manager.on("status", (message) => status.push(message));

    await manager.start({ cwd: tmpDir, squadState: emptySquadState() });
    fake.emitEvent(toolStartEvent("powershell"));
    fake.emitEvent(toolProgressEvent("running tests"));
    fake.emitEvent(toolCompleteEvent("tool-1", true));

    expect(output.join("")).not.toContain("[tool]");
    expect(status).toContain("running powershell...");
    expect(status).toContain("running tests");
    await manager.stop();
  });

  it("emits tool chatter in debug mode and always surfaces failures", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);
    const output: string[] = [];
    manager.on("output", (chunk) => output.push(chunk));

    await manager.start({ cwd: tmpDir, squadState: emptySquadState(), debug: true });
    fake.emitEvent(toolStartEvent("powershell"));
    fake.emitEvent(toolCompleteEvent("tool-1", false));

    expect(output.join("")).toContain("[tool] powershell started");
    expect(output.join("")).toContain("[tool] tool-1 failed");
    await manager.stop();
  });

  it("updates agent status without transcript noise for normal subagent lifecycle", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);
    const output: string[] = [];
    const agents: string[] = [];
    manager.on("output", (chunk) => output.push(chunk));
    manager.on("agent", (name, status) => agents.push(`${name}:${status}`));

    await manager.start({ cwd: tmpDir, squadState: emptySquadState() });
    fake.emitEvent(subagentStartedEvent("lambert"));
    fake.emitEvent(subagentCompletedEvent("lambert"));
    fake.emitEvent(subagentFailedEvent("ripley", "tests failed"));

    expect(agents).toEqual(["lambert:working", "lambert:idle", "ripley:error"]);
    expect(output.join("")).not.toContain("lambert started");
    expect(output.join("")).not.toContain("lambert completed");
    expect(output.join("")).toContain("[agent] ripley failed: tests failed");
    await manager.stop();
  });

  it("does not write idle status into transcript", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);
    const output: string[] = [];
    manager.on("output", (chunk) => output.push(chunk));

    await manager.start({ cwd: tmpDir, squadState: emptySquadState() });
    fake.emitEvent(idleEvent());

    expect(output.join("")).not.toContain("[sqq] idle");
    await manager.stop();
  });

  it("waits for interactive permission approval when --yolo is not set", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);
    const modals: Array<string | null> = [];
    manager.on("modal", (modal) => modals.push(modal?.kind ?? null));

    await manager.start({ cwd: tmpDir, squadState: emptySquadState() });
    const permission = fake.config!.onPermissionRequest(
      { kind: "shell", fullCommandText: "pnpm test" } as never,
      { sessionId: "s1" },
    );

    expect(modals).toEqual(["permission"]);
    manager.resolveModal("y");
    await expect(permission).resolves.toEqual({ kind: "approve-once" });
    expect(modals).toEqual(["permission", null]);
    await manager.stop();
  });

  it("auto-approves permissions in --yolo mode", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);

    await manager.start({ cwd: tmpDir, squadState: emptySquadState(), yolo: true });
    const result = fake.config!.onPermissionRequest({ kind: "write" }, { sessionId: "s1" });

    await expect(Promise.resolve(result)).resolves.toEqual({ kind: "approve-once" });
    await manager.stop();
  });

  it("lists and switches models through SDK model APIs", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);

    await manager.start({ cwd: tmpDir, squadState: emptySquadState() });

    await expect(manager.listModels()).resolves.toEqual(fake.models);
    await expect(manager.switchModel("claude-sonnet-4.6")).resolves.toBeUndefined();
    expect(fake.session.currentModel).toBe("claude-sonnet-4.6");
    expect(manager.currentModel).toBe("claude-sonnet-4.6");
    await manager.stop();
  });

  it("reports model change events", async () => {
    const fake = new FakeCopilotClient();
    const manager = new CopilotSdkManager(() => fake);
    const output: string[] = [];
    const status: string[] = [];
    manager.on("output", (chunk) => output.push(chunk));
    manager.on("status", (message) => status.push(message));

    await manager.start({ cwd: tmpDir, squadState: emptySquadState() });
    output.length = 0;
    fake.emitEvent(modelChangeEvent("gpt-5.4"));

    expect(manager.currentModel).toBe("gpt-5.4");
    expect(output.join("")).not.toContain("Model changed to gpt-5.4");
    expect(status).toContain("model: gpt-5.4");
    await manager.stop();
  });
});

class FakeCopilotClient implements CopilotClientLike {
  started = false;
  stopped = false;
  config: SessionConfig | null = null;
  readonly session = new FakeCopilotSession();
  readonly models = [
    { id: "gpt-5.4", name: "GPT-5.4", capabilities: {} },
    { id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6", capabilities: {} },
  ];

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<Error[]> {
    this.stopped = true;
    return [];
  }

  async createSession(config: SessionConfig): Promise<CopilotSessionLike> {
    this.config = config;
    return this.session;
  }

  async listModels() {
    return this.models;
  }

  emitEvent(event: SessionEvent): void {
    this.config?.onEvent?.(event);
  }
}

class FakeCopilotSession implements CopilotSessionLike {
  sessionId = "s1";
  sent: string[] = [];
  aborted = false;
  disconnected = false;
  currentModel = "gpt-5.4";
  rpc = {
    model: {
      getCurrent: async () => ({ modelId: this.currentModel }),
      switchTo: async ({ modelId }: { modelId: string }) => {
        this.currentModel = modelId;
        return { modelId };
      },
    },
  };

  async send(options: { prompt: string }): Promise<string> {
    this.sent.push(options.prompt);
    return `msg-${this.sent.length}`;
  }

  async abort(): Promise<void> {
    this.aborted = true;
  }

  async disconnect(): Promise<void> {
    this.disconnected = true;
  }
}

function emptySquadState(): SquadState {
  return { squadRoot: null, agents: [], teamName: "No Squad", focus: "", recentDecision: "" };
}

function assistantDelta(messageId: string, deltaContent: string, agentId?: string): SessionEvent {
  return {
    id: "e1",
    timestamp: new Date(0).toISOString(),
    parentId: null,
    ephemeral: true,
    ...(agentId ? { agentId } : {}),
    type: "assistant.message_delta",
    data: { messageId, deltaContent },
  } as SessionEvent;
}

function assistantFinal(messageId: string, content: string, agentId?: string): SessionEvent {
  return {
    id: "e2",
    timestamp: new Date(0).toISOString(),
    parentId: "e1",
    ...(agentId ? { agentId } : {}),
    type: "assistant.message",
    data: { messageId, content },
  } as SessionEvent;
}

function idleEvent(): SessionEvent {
  return {
    id: "e3",
    timestamp: new Date(0).toISOString(),
    parentId: "e2",
    ephemeral: true,
    type: "session.idle",
    data: {},
  } as SessionEvent;
}

function modelChangeEvent(newModel: string): SessionEvent {
  return {
    id: "e4",
    timestamp: new Date(0).toISOString(),
    parentId: "e3",
    type: "session.model_change",
    data: { newModel },
  } as SessionEvent;
}

function toolStartEvent(toolName: string): SessionEvent {
  return {
    id: "tool-start",
    timestamp: new Date(0).toISOString(),
    parentId: null,
    type: "tool.execution_start",
    data: { toolName, toolCallId: "tool-1" },
  } as SessionEvent;
}

function toolProgressEvent(progressMessage: string): SessionEvent {
  return {
    id: "tool-progress",
    timestamp: new Date(0).toISOString(),
    parentId: "tool-start",
    type: "tool.execution_progress",
    data: { toolCallId: "tool-1", progressMessage },
  } as SessionEvent;
}

function toolCompleteEvent(toolCallId: string, success: boolean): SessionEvent {
  return {
    id: "tool-complete",
    timestamp: new Date(0).toISOString(),
    parentId: "tool-progress",
    type: "tool.execution_complete",
    data: { toolCallId, success },
  } as SessionEvent;
}

function subagentStartedEvent(agentName: string): SessionEvent {
  return {
    id: `subagent-started-${agentName}`,
    timestamp: new Date(0).toISOString(),
    parentId: null,
    type: "subagent.started",
    data: {
      agentName,
      agentDisplayName: agentName,
      agentDescription: "Frontend",
      model: "gpt-5.4",
    },
  } as SessionEvent;
}

function subagentCompletedEvent(agentName: string): SessionEvent {
  return {
    id: `subagent-completed-${agentName}`,
    timestamp: new Date(0).toISOString(),
    parentId: null,
    type: "subagent.completed",
    data: {
      agentName,
      agentDisplayName: agentName,
      durationMs: 1200,
      model: "gpt-5.4",
    },
  } as SessionEvent;
}

function subagentFailedEvent(agentName: string, error: string): SessionEvent {
  return {
    id: `subagent-failed-${agentName}`,
    timestamp: new Date(0).toISOString(),
    parentId: null,
    type: "subagent.failed",
    data: {
      agentName,
      agentDisplayName: agentName,
      error,
      model: "gpt-5.4",
    },
  } as SessionEvent;
}
