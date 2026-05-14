export type ActorDirection = -1 | 1;

export class Actor {
  role: string;
  x: number;
  y: number;
  state: string;
  frameIndex: number;
  tickCounter: number;
  phaseTick: number;
  direction: ActorDirection;
  blinkVisible: boolean;

  constructor(
    role: string,
    x: number,
    y: number,
    state = "idle",
    direction: ActorDirection = x % 2 === 0 ? 1 : -1,
  ) {
    this.role = role;
    this.x = x;
    this.y = y;
    this.state = state;
    this.frameIndex = 0;
    this.tickCounter = 0;
    this.phaseTick = 0;
    this.direction = direction;
    this.blinkVisible = true;
  }

  setState(state: string): void {
    if (this.state === state) {
      return;
    }

    this.state = state;
    this.frameIndex = 0;
    this.phaseTick = 0;
  }
}

interface ActorManagerOptions {
  spriteWidth?: number;
  spriteHeight?: number;
  driftEveryTicks?: number;
  idleDurationTicks?: number;
  workingDurationTicks?: number;
  celebrateDurationTicks?: number;
  blinkEveryTicks?: number;
  autoCycleStates?: boolean;
}

const DEFAULTS = {
  spriteWidth: 7,
  spriteHeight: 2,
  driftEveryTicks: 6,
  idleDurationTicks: 24,
  workingDurationTicks: 12,
  celebrateDurationTicks: 8,
  blinkEveryTicks: 12,
  autoCycleStates: true,
} satisfies Required<ActorManagerOptions>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class ActorManager {
  private readonly actors: Actor[] = [];
  private readonly width: number;
  private readonly height: number;
  private readonly options: Required<ActorManagerOptions>;

  constructor(width: number, height: number, options: ActorManagerOptions = {}) {
    this.width = width;
    this.height = height;
    this.options = {
      ...DEFAULTS,
      ...options,
    };
  }

  private clampX(x: number): number {
    return clamp(x, 0, Math.max(0, this.width - this.options.spriteWidth));
  }

  private clampY(y: number): number {
    return clamp(y, 0, Math.max(0, this.height - this.options.spriteHeight));
  }

  addActor(role: string, x: number, y: number, state = "idle"): Actor {
    const actor = new Actor(role, this.clampX(x), this.clampY(y), state);
    this.actors.push(actor);
    return actor;
  }

  getActors(): readonly Actor[] {
    return this.actors;
  }

  tick(getFrameCount: (actor: Actor) => number): void {
    for (const actor of this.actors) {
      actor.tickCounter += 1;
      actor.phaseTick += 1;

      if (this.options.autoCycleStates) {
        if (actor.state === "idle" && actor.phaseTick >= this.options.idleDurationTicks) {
          actor.setState("working");
        } else if (
          actor.state === "working" &&
          actor.phaseTick >= this.options.workingDurationTicks
        ) {
          actor.setState("celebrate");
        } else if (
          actor.state === "celebrate" &&
          actor.phaseTick >= this.options.celebrateDurationTicks
        ) {
          actor.setState("idle");
        }
      }

      const frameDivisor = actor.state === "working" ? 1 : 4;
      const frameCount = Math.max(1, getFrameCount(actor));
      if (actor.tickCounter % frameDivisor === 0) {
        actor.frameIndex = (actor.frameIndex + 1) % frameCount;
      }

      if (actor.tickCounter % this.options.blinkEveryTicks === 0) {
        actor.blinkVisible = !actor.blinkVisible;
      }

      if (actor.state !== "blocked" && actor.tickCounter % this.options.driftEveryTicks === 0) {
        const nextX = actor.x + actor.direction;
        const maxX = Math.max(0, this.width - this.options.spriteWidth);

        if (nextX < 0 || nextX > maxX) {
          actor.direction = actor.direction === 1 ? -1 : 1;
          actor.x = clamp(actor.x + actor.direction, 0, maxX);
        } else {
          actor.x = nextX;
        }
      }
    }
  }
}
