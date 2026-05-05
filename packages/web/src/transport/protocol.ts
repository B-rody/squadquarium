// Re-export from core once Parker lands transport/protocol.
// If the import fails, core hasn't published the types yet — adjust path.
export type {
  AgentSummary,
  DecisionEntry,
  LogEntry,
  Snapshot,
  ServerFrame,
  ClientFrame,
} from "@squadquarium/core";
