export { ActivityLog } from "./activity-log.js";
export * from "./actor.js";
export { detectCapabilities } from "./adaptive.js";
export {
  startApp,
  stopApp,
  createStartupMessages,
  createDebugMessages,
  createHelpMessages,
  createSlashCommandHelpMessages,
  completeSlashInput,
} from "./app.js";
export type { SlashAutocompleteResult } from "./app.js";
export * from "./aquarium.js";
export * from "./chrome.js";
export { CommandCenterPane, normalizeAgentId } from "./command-center-pane.js";
export type {
  AgentCommandRow,
  AgentStatusUpdate,
  AgentWorkStatus,
  CommandCenterColors,
} from "./command-center-pane.js";
export { CopilotPane, stripAnsi } from "./copilot-pane.js";
export type { CopilotPaneColors } from "./copilot-pane.js";
export {
  CopilotSdkManager,
  buildInitialPrompt,
  buildSquadCustomAgents,
} from "./copilot-sdk-manager.js";
export type {
  CopilotClientFactory,
  CopilotClientLike,
  CopilotModalPrompt,
  CopilotSdkMode,
  CopilotSdkStartOptions,
  CopilotSdkState,
  CopilotSessionLike,
} from "./copilot-sdk-manager.js";
export { HalfBlockCanvas, colorsEqual } from "./halfblock.js";
export type { Pixel, HalfBlockBuffer } from "./halfblock.js";
export {
  loadHalfBlockSpritesSync,
  parseHalfBlockSheet,
  resolveFramePixels,
  getFrameSize,
  resolveHalfBlockState,
} from "./halfblock-sprites.js";
export type { HalfBlockSpriteSheet, HalfBlockFrame } from "./halfblock-sprites.js";
export { InputLine } from "./input-line.js";
export { calculateLayout } from "./layout.js";
export type { Layout } from "./layout.js";
export { MouseHandler } from "./mouse.js";
export * from "./palette.js";
export { SquadWatcher } from "./squad-watcher.js";
export type { AgentInfo, SquadState } from "./squad-watcher.js";
export * from "./sprites.js";
export type { AppConfig, Capabilities, PanelConfig, Rect } from "./types.js";
