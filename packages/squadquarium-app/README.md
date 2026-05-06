# squadquarium-app

Native window wrapper for [squadquarium](../cli) built with [Tauri 2](https://tauri.app/).

This package is **intentionally separate** from the `squadquarium` npm package. It is an opt-in
desktop wrapper that gives users a native OS window with:

- Frameless, transparent chrome (styled entirely by the web bundle's skin)
- System tray icon (always-on-top toggle, quit)
- Native platform bundling (`.app` on macOS, `.exe` installer on Windows, `.AppImage`/`.deb` on Linux)

Users who are happy with a browser tab do not need this package.

---

## Prerequisites

### 1 — Rust toolchain (required to build)

Tauri 2 requires a Rust toolchain **and** the platform system dependencies. Brody's host does not
have Rust installed by policy (offline), so this package is **scaffold-only** in the monorepo.

Install Rust via rustup:

```
https://rustup.rs/
```

On **Windows** you also need the MSVC build tools:

```
winget install Microsoft.VisualStudio.2022.BuildTools
```

On **Linux** you need `build-essential`, `libwebkit2gtk-4.1-dev`, `libssl-dev`, etc. — see
[Tauri 2 prerequisites](https://tauri.app/start/prerequisites/).

### 2 — squadquarium CLI built

The CLI (`packages/cli`) must be built before the Tauri app can serve its web bundle:

```bash
pnpm --filter squadquarium build
```

### 3 — Node.js ≥ 22.5.0 and pnpm

Same requirement as the rest of the monorepo.

---

## Development

```bash
# From repo root — build the CLI first:
pnpm --filter squadquarium build

# Then, from this directory:
pnpm dev
# or from repo root:
pnpm --filter squadquarium-app dev
```

`pnpm dev` runs `tauri dev`, which:

1. Reads `src-tauri/tauri.conf.json` — `devUrl: "http://127.0.0.1:6280"`
2. Compiles the Rust sidecar in debug mode
3. Opens a native window pointing at `http://127.0.0.1:6280`

You **must** start the CLI server separately (or it must already be running):

```bash
node ../cli/dist/index.js --serve-only --port=6280
```

---

## Producing platform binaries

```bash
# From this directory:
pnpm build
# or from repo root:
pnpm --filter squadquarium-app build
```

`pnpm build` runs `tauri build`, which:

1. Compiles the Rust binary in release mode
2. Bundles `../../cli/dist` as `resources/cli-dist` inside the app bundle
3. Produces platform-native installers in `src-tauri/target/release/bundle/`

The app bundle assumes the `squadquarium` CLI server is available. At runtime, production builds
should launch `resources/cli-dist/index.js --serve-only` via a Tauri shell command and then load
the window from `http://127.0.0.1:6280`. Wiring the sidecar launch is a v2 follow-on (see plan.md
`### squadquarium-app sidecar wiring`).

---

## Configuration

`src-tauri/tauri.conf.json` controls the window and bundle:

| Setting                   | Value                   | Notes                                             |
| ------------------------- | ----------------------- | ------------------------------------------------- |
| `decorations`             | `false`                 | Frameless — skin provides all chrome              |
| `transparent`             | `true`                  | Transparent background blends with skin           |
| `alwaysOnTop`             | `false`                 | Toggleable at runtime via tray menu (v2)          |
| `devUrl` / `frontendDist` | `http://127.0.0.1:6280` | Points at CLI server both in dev and prod         |
| `trayIcon.iconPath`       | `icons/32x32.png`       | Platform icon (not yet generated — scaffold only) |

---

## Workspace

This package lives in `packages/squadquarium-app/` and is included in the pnpm workspace via the
`"packages/*"` glob in `pnpm-workspace.yaml`. Running `pnpm install` from the repo root installs
`@tauri-apps/cli` here — but **does not compile the Rust side** (that requires the Rust toolchain).

---

## Why separate from `squadquarium` (the npm CLI)?

The npm-published `squadquarium` package is a pure Node.js CLI that serves the diorama web bundle
over localhost. It is the primary distribution vector — one `npm install -g squadquarium` and you
have everything.

`squadquarium-app` is an opt-in layer for users who want:

- A dedicated OS window instead of a browser tab
- System tray, always-on-top, OS-native keyboard shortcuts
- Platform app bundle (`.app`, `.exe`, `.AppImage`) for desktop integration

The two packages share the same web bundle; `squadquarium-app` bundles `packages/cli/dist` as a
resource and launches the same HTTP server under the hood.
