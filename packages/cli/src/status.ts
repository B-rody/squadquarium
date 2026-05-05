import { SquadStateAdapter } from "@squadquarium/core";

export interface StatusOptions {
  cwd?: string;
  personal?: boolean;
  skinsDir?: string;
}

export async function printStatus(opts: StatusOptions): Promise<number> {
  const adapter = await SquadStateAdapter.create(opts);
  if (!adapter) {
    console.log("squadquarium status: no squad found");
    return 1;
  }

  try {
    const snapshot = await adapter.getSnapshot();
    const lines = [
      `Squad root: ${adapter.getSquadRoot()}`,
      `Squad version: ${adapter.getSquadVersion() ?? "unknown"}`,
      "",
      "Agents:",
      ...snapshot.agents.map(
        (agent) => `- ${agent.name}: ${agent.role || "unknown role"} (${agent.status})`,
      ),
      "",
      "Last decisions:",
      ...snapshot.decisions
        .slice(0, 3)
        .map((decision) => `- ${decision.date} ${decision.what} — ${decision.by}`),
      "",
      "Log tail:",
      ...snapshot.logTail
        .slice(0, 5)
        .map(
          (entry) =>
            `- ${entry.timestamp} [${entry.source}] ${entry.agent ?? "unknown"}: ${entry.body.split(/\r?\n/)[0] ?? ""}`,
        ),
    ];
    console.log(lines.join("\n"));
    return 0;
  } finally {
    await adapter.dispose();
  }
}
