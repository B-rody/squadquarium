import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(__dirname, "..", "..");
export const repoRoot = path.resolve(packageRoot, "..", "..");
const srcRoot = path.join(packageRoot, "src");

export function moduleExists(moduleBaseName: string): boolean {
  const normalized = moduleBaseName.replace(/\.(?:[cm]?[jt]sx?)$/, "");
  const candidates = [
    path.join(srcRoot, `${normalized}.ts`),
    path.join(srcRoot, `${normalized}.tsx`),
    path.join(srcRoot, normalized, "index.ts"),
  ];

  return candidates.some((candidate) => existsSync(candidate));
}

export function repoPath(...segments: string[]): string {
  return path.join(repoRoot, ...segments);
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  throw new TypeError("Expected an object value.");
}

export function pickExport<T>(moduleExports: Record<string, unknown>, names: string[]): T {
  for (const name of names) {
    const value = moduleExports[name];
    if (value !== undefined) {
      return value as T;
    }
  }

  throw new Error(`Expected module to export one of: ${names.join(", ")}`);
}

export function maybeNumber(root: unknown, keys: string[]): number | undefined {
  const record = asRecord(root);

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") {
      return value;
    }
  }

  return undefined;
}

export function getNumber(root: unknown, keys: string[]): number {
  const value = maybeNumber(root, keys);
  if (value === undefined) {
    throw new Error(`Expected numeric property: ${keys.join(", ")}`);
  }

  return value;
}

export function maybeBoolean(root: unknown, keys: string[]): boolean | undefined {
  const record = asRecord(root);

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

export function maybeString(root: unknown, keys: string[]): string | undefined {
  const record = asRecord(root);

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

export function maybeRecord(root: unknown, keys: string[]): Record<string, unknown> | undefined {
  const record = asRecord(root);

  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === "object") {
      return value as Record<string, unknown>;
    }
  }

  return undefined;
}
