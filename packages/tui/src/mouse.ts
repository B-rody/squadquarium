import type { Rect } from "./types.js";

export interface MouseDispatchTarget {
  aquarium: Rect;
  log: Rect;
  input: Rect;
}

export interface MouseEventData {
  x: number;
  y: number;
}

interface MouseHandlerOptions {
  getRegions: () => MouseDispatchTarget;
  onAquariumClick: (x: number, y: number) => void;
  onLogScroll: (direction: "up" | "down") => void;
  onInputFocus: () => void;
}

export class MouseHandler {
  private readonly options: MouseHandlerOptions;

  public constructor(options: MouseHandlerOptions) {
    this.options = options;
  }

  public dispatch(name: string, data: MouseEventData): boolean {
    const regions = this.options.getRegions();

    if (isWithin(data, regions.input)) {
      this.options.onInputFocus();
      return true;
    }

    if (isWithin(data, regions.log) && name.includes("WHEEL")) {
      this.options.onLogScroll(name.includes("UP") ? "up" : "down");
      return true;
    }

    if (isWithin(data, regions.aquarium) && name.includes("LEFT_BUTTON")) {
      this.options.onAquariumClick(data.x - regions.aquarium.x, data.y - regions.aquarium.y);
      return true;
    }

    return false;
  }
}

function isWithin(point: MouseEventData, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  );
}
