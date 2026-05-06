import { resolveSquad } from "@bradygaster/squad-sdk";

export function resolveSquadRoot(cwd: string = process.cwd()): string | null {
  try {
    return resolveSquad(cwd) ?? null;
  } catch {
    return null;
  }
}
