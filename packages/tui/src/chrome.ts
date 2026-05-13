import type { ScreenBufferHD } from "terminal-kit";

import type { Layout } from "./layout.js";
import type { ColorValue } from "./palette.js";

export interface ChromeConfig {
  teamName: string;
  skinName: string;
  agentCount: number;
  rounded?: boolean;
  statusBarPosition?: "top" | "bottom";
  color?: ColorValue;
  bgColor?: ColorValue;
  chromeColor?: ColorValue;
  labelColor?: ColorValue;
}

interface TextAttr {
  color?: ColorValue;
  bgColor?: ColorValue;
  inverse?: boolean;
}

function put(
  buffer: ScreenBufferHD,
  x: number,
  y: number,
  text: string,
  attr: TextAttr = {},
): void {
  if (text.length === 0) {
    return;
  }

  buffer.put({ x, y, attr, wrap: false, dx: 0, dy: 0 }, text);
}

function drawHorizontal(
  buffer: ScreenBufferHD,
  x: number,
  y: number,
  width: number,
  left: string,
  middle: string,
  right: string,
  attr: TextAttr = {},
): void {
  if (width <= 1) {
    return;
  }

  put(buffer, x, y, `${left}${middle.repeat(Math.max(0, width - 2))}${right}`, attr);
}

function drawBox(
  buffer: ScreenBufferHD,
  x: number,
  y: number,
  width: number,
  height: number,
  chars: { tl: string; tr: string; bl: string; br: string; h: string; v: string },
  attr: TextAttr = {},
): void {
  if (width < 2 || height < 2) {
    return;
  }

  drawHorizontal(buffer, x, y, width, chars.tl, chars.h, chars.tr, attr);
  drawHorizontal(buffer, x, y + height - 1, width, chars.bl, chars.h, chars.br, attr);

  for (let offset = 1; offset < height - 1; offset += 1) {
    put(buffer, x, y + offset, chars.v, attr);
    put(buffer, x + width - 1, y + offset, chars.v, attr);
  }
}

function drawDivider(
  buffer: ScreenBufferHD,
  y: number,
  width: number,
  left: string,
  middle: string,
  right: string,
  title: string,
  lineAttr: TextAttr = {},
  titleAttr: TextAttr = lineAttr,
): void {
  if (width < 2) {
    return;
  }

  put(buffer, 0, y, `${left}${middle.repeat(Math.max(0, width - 2))}${right}`, lineAttr);
  put(buffer, 2, y, title.slice(0, Math.max(0, width - 4)), titleAttr);
}

function drawStatusBar(buffer: ScreenBufferHD, layout: Layout, config: ChromeConfig): void {
  const y = config.statusBarPosition === "bottom" ? layout.height - 1 : 0;
  const text = `${config.teamName} · skin:${config.skinName} · agents:${config.agentCount}`;
  const attr: TextAttr = { inverse: true };
  if (config.color !== undefined) {
    attr.color = config.color;
  }
  if (config.bgColor !== undefined) {
    attr.bgColor = config.bgColor;
  }

  put(
    buffer,
    0,
    y,
    text.length > layout.width ? text.slice(0, layout.width) : text.padEnd(layout.width, " "),
    attr,
  );
}

export function drawChrome(buffer: ScreenBufferHD, layout: Layout, config: ChromeConfig): void {
  const chars = config.rounded
    ? { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│", lt: "├", rt: "┤" }
    : { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│", lt: "├", rt: "┤" };
  const chromeAttr: TextAttr = {
    color: config.chromeColor ?? config.color,
    bgColor: config.bgColor,
  };
  const labelAttr: TextAttr = {
    color: config.labelColor ?? config.color,
    bgColor: config.bgColor,
  };

  drawBox(buffer, 0, 0, layout.width, layout.height, chars, chromeAttr);

  // Divider between aquarium and copilot pane
  const copilotY = layout.copilot.y;
  drawDivider(
    buffer,
    copilotY - 1,
    layout.width,
    chars.lt,
    chars.h,
    chars.rt,
    " COPILOT ",
    chromeAttr,
    labelAttr,
  );

  drawStatusBar(buffer, layout, config);
}
