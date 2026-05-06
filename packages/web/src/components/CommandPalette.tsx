import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { ObsMode } from "../settings/store.js";

export interface ParsedCommand {
  verb: string;
  args: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSkinChange: (name: string) => void;
  onInteractive: (cmd: string, args: string[], seed?: string) => void;
  onOpenScrubber: () => void;
  onOpenWisdom: () => void;
  onOpenSettings: () => void;
  onRalphStop: () => void;
  onOpenMarketplace: () => void;
  onOpenSkins: () => void;
  onOpenGame: () => void;
  onObsMode: (mode: ObsMode) => void;
  onStandup: () => void;
  availableSkins?: string[];
  agentNames?: string[];
}

const HISTORY_KEY = "squadquarium:cmd-history";
const KNOWN_COMMANDS = [
  "skin",
  "hatch",
  "inscribe",
  "quit",
  "scrub",
  "wisdom",
  "settings",
  "trace",
  "why",
  "inspect",
  "diorama",
  "aspire",
  "marketplace",
  "marketplace browse",
  "ralph",
  "ralph start",
  "ralph stop",
  "skins",
  "game",
  "obs",
  "obs off",
  "obs transparent",
  "obs chroma-green",
  "obs chroma-magenta",
  "standup",
];

export function parseCommand(cmd: string): ParsedCommand {
  const trimmed = cmd.replace(/^:/, "").trim();
  if (!trimmed) return { verb: "", args: [] };
  const [verb = "", ...args] = trimmed.split(/\s+/);
  return { verb, args };
}

export function completeCommandVerb(input: string): string {
  const hasColon = input.startsWith(":");
  const raw = hasColon ? input.slice(1) : input;
  const leading = hasColon ? ":" : "";
  const [verbPrefix = "", ...rest] = raw.split(/\s+/);
  if (!verbPrefix) return input;
  const match = KNOWN_COMMANDS.map((cmd) => cmd.split(" ")[0] ?? cmd).find((verb) =>
    verb.startsWith(verbPrefix),
  );
  if (!match) return input;
  return `${leading}${match}${rest.length > 0 ? ` ${rest.join(" ")}` : ""}`;
}

function loadHistory(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-50)));
}

export default function CommandPalette({
  open,
  onClose,
  onSkinChange,
  onInteractive,
  onOpenScrubber,
  onOpenWisdom,
  onOpenSettings,
  onRalphStop,
  onOpenMarketplace,
  onOpenSkins,
  onOpenGame,
  onObsMode,
  onStandup,
  availableSkins = [],
  agentNames = [],
}: Props) {
  const [input, setInput] = useState(":");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput(":");
      setHistory(loadHistory());
      setHistoryIndex(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const persistCommand = useCallback(
    (cmd: string) => {
      if (!cmd.trim() || cmd.trim() === ":") return;
      const next = [...history.filter((entry) => entry !== cmd), cmd].slice(-50);
      setHistory(next);
      saveHistory(next);
    },
    [history],
  );

  const execute = useCallback(
    (cmd: string) => {
      const { verb, args } = parseCommand(cmd);
      persistCommand(cmd);

      switch (verb) {
        case "skin":
          if (args[0]) onSkinChange(args[0]);
          break;
        case "hatch":
          onInteractive("squad", [], "add a new agent");
          break;
        case "inscribe":
          onInteractive("squad", [], "add a new skill");
          break;
        case "scrub":
          onOpenScrubber();
          break;
        case "wisdom":
          onOpenWisdom();
          break;
        case "settings":
          onOpenSettings();
          break;
        case "trace":
        case "inspect":
          if (args[0]) onInteractive("squad", ["trace", args[0]]);
          break;
        case "why":
          if (args[0]) onInteractive("squad", ["why", args.join(" ")]);
          break;
        case "diorama":
          onInteractive("squad", ["diorama"]);
          break;
        case "aspire":
          onInteractive("squad", ["aspire"]);
          break;
        case "marketplace":
          if (args[0] === "browse" && args[1]) {
            onInteractive("squad", ["marketplace", "browse", args.slice(1).join(" ")]);
          } else {
            onOpenMarketplace();
          }
          break;
        case "ralph":
          if (args[0] === "start") onInteractive("squad", ["watch"]);
          if (args[0] === "stop") onRalphStop();
          break;
        case "skins":
          onOpenSkins();
          break;
        case "game":
          onOpenGame();
          break;
        case "obs": {
          const mode = (args[0] ?? "off") as ObsMode;
          onObsMode(mode);
          break;
        }
        case "standup":
          onStandup();
          break;
        case "quit":
          window.close();
          break;
        default:
          if (verb) console.warn(`[commandpalette] unknown command: ${verb}`);
      }
      onClose();
    },
    [
      persistCommand,
      onSkinChange,
      onInteractive,
      onOpenScrubber,
      onOpenWisdom,
      onOpenSettings,
      onRalphStop,
      onOpenMarketplace,
      onOpenSkins,
      onOpenGame,
      onObsMode,
      onStandup,
      onClose,
    ],
  );

  const suggestions = useMemo(() => {
    const { verb, args } = parseCommand(input);
    if (!verb) return KNOWN_COMMANDS.slice(0, 6);
    const commandSuggestions = KNOWN_COMMANDS.filter((cmd) =>
      cmd.startsWith(`${verb}${args.length ? ` ${args.join(" ")}` : ""}`),
    );
    const skinSuggestions = verb === "skin" ? availableSkins.map((skin) => `skin ${skin}`) : [];
    const agentSuggestions = ["trace", "inspect"].includes(verb)
      ? agentNames.map((name) => `${verb} ${name}`)
      : [];
    return [...commandSuggestions, ...skinSuggestions, ...agentSuggestions].slice(0, 6);
  }, [input, availableSkins, agentNames]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") execute(input);
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        e.preventDefault();
        setInput((value) => completeCommandVerb(value));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length === 0) return;
        const nextIndex =
          historyIndex === null
            ? history.length - 1
            : (historyIndex - 1 + history.length) % history.length;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex] ?? ":");
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (history.length === 0 || historyIndex === null) return;
        const nextIndex = (historyIndex + 1) % history.length;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex] ?? ":");
      }
    },
    [input, execute, onClose, history, historyIndex],
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "20vh",
        backgroundColor: "rgba(0,0,0,0.6)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--skin-bg, #001f1c)",
          border: "1px solid var(--skin-fg, #00bfa5)",
          padding: "8px",
          minWidth: "360px",
          fontFamily: "var(--skin-font-family, monospace)",
          fontSize: "var(--skin-font-size, 14px)",
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            background: "transparent",
            color: "var(--skin-fg, #00bfa5)",
            border: "none",
            outline: "none",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
          placeholder=":skin aquarium | :hatch | :scrub | :marketplace | :skins | :game | :obs transparent"
        />
        <div
          style={{
            marginTop: "4px",
            color: "var(--skin-dim, #004d40)",
            fontSize: "12px",
          }}
        >
          {suggestions.length > 0
            ? suggestions.map((s) => `:${s}`).join(" · ")
            : ":skin · :hatch · :quit"}
        </div>
      </div>
    </div>
  );
}
