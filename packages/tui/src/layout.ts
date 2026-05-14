import type { Rect } from "./types.js";

const MIN_AQUARIUM_HEIGHT = 5;
const MIN_COPILOT_HEIGHT = 8;
const AQUARIUM_RATIO = 0.4;
const MIN_COPILOT_WIDTH = 48;
const MIN_COMMAND_CENTER_WIDTH = 24;
const COMMAND_CENTER_RATIO = 0.28;
const BORDER_THICKNESS = 1;
const STATUS_BAR_HEIGHT = 1;
const SEPARATOR_HEIGHT = 1;
const VERTICAL_SEPARATOR_WIDTH = 1;

export interface Layout {
  width: number;
  height: number;
  aquarium: Rect;
  copilot: Rect;
  commandCenter: Rect;
  statusBar: Rect;
  /** @deprecated use copilot instead — kept for chrome/test compat */
  log: Rect;
  /** @deprecated no longer a separate region — input is rendered in the SDK pane */
  input: Rect;
}

/**
 * Calculate the split layout: aquarium (~40% top) + copilot/command center bottom.
 * A status bar sits at the very bottom. Regions never overlap.
 */
export function calculateLayout(width: number, height: number): Layout {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const innerWidth = Math.max(1, safeWidth - BORDER_THICKNESS * 2);

  // Usable = total minus top border, bottom border, status bar, separator
  const usable = Math.max(
    0,
    safeHeight - BORDER_THICKNESS * 2 - STATUS_BAR_HEIGHT - SEPARATOR_HEIGHT,
  );

  // Target: aquarium ≈ 40%, lower command/chat area ≈ 60%
  let aquariumHeight = Math.round(usable * AQUARIUM_RATIO);
  let copilotHeight = usable - aquariumHeight;

  // Enforce minimums when there's enough space
  if (usable >= MIN_AQUARIUM_HEIGHT + MIN_COPILOT_HEIGHT) {
    aquariumHeight = Math.max(MIN_AQUARIUM_HEIGHT, aquariumHeight);
    copilotHeight = Math.max(MIN_COPILOT_HEIGHT, usable - aquariumHeight);
    aquariumHeight = usable - copilotHeight;
  } else if (usable > 0) {
    // Very small: give copilot priority
    copilotHeight = Math.max(1, Math.round(usable * 0.7));
    aquariumHeight = Math.max(0, usable - copilotHeight);
  } else {
    aquariumHeight = 0;
    copilotHeight = 0;
  }

  const aquarium: Rect = {
    x: BORDER_THICKNESS,
    y: BORDER_THICKNESS,
    width: innerWidth,
    height: aquariumHeight,
  };

  const copilotY = aquarium.y + aquariumHeight + SEPARATOR_HEIGHT;
  const canShowCommandCenter =
    innerWidth >= MIN_COPILOT_WIDTH + MIN_COMMAND_CENTER_WIDTH + VERTICAL_SEPARATOR_WIDTH;
  const commandCenterWidth = canShowCommandCenter
    ? Math.max(MIN_COMMAND_CENTER_WIDTH, Math.round(innerWidth * COMMAND_CENTER_RATIO))
    : 0;
  const commandSeparatorWidth = commandCenterWidth > 0 ? VERTICAL_SEPARATOR_WIDTH : 0;
  const copilotWidth = innerWidth - commandCenterWidth - commandSeparatorWidth;

  const copilot: Rect = {
    x: BORDER_THICKNESS,
    y: copilotY,
    width: copilotWidth,
    height: copilotHeight,
  };

  const commandCenter: Rect = {
    x: copilot.x + copilot.width + commandSeparatorWidth,
    y: copilotY,
    width: commandCenterWidth,
    height: copilotHeight,
  };

  const statusBar: Rect = {
    x: 0,
    y: safeHeight - 1,
    width: safeWidth,
    height: STATUS_BAR_HEIGHT,
  };

  return {
    width: safeWidth,
    height: safeHeight,
    aquarium,
    copilot,
    commandCenter,
    statusBar,
    // Compat aliases — copilot pane replaces both log and input
    log: copilot,
    input: { x: copilot.x, y: copilot.y + copilot.height - 1, width: innerWidth, height: 1 },
  };
}
