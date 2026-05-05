# squadquarium

> Terminal-styled ambient diorama for [brady/squad](https://github.com/bradygaster/squad) — glanceable agent status from across the room.

## Install

```sh
npm install -g squadquarium   # or: pnpm add -g squadquarium
```

## Launch

```sh
squadquarium [path-to-squad-project]
# aliases:
sqq [path-to-squad-project]
```

Options:

- `--personal` — show only your own sessions
- `--headless-smoke` — boot, verify, exit 0 (CI/smoke use)
- `--version` / `-V` — print version
- `--help` / `-h` — show help

## Development

```sh
pnpm install
pnpm dev         # Vite dev server for packages/web
pnpm build       # tsc + vite build workspace-wide
pnpm test        # vitest workspace-wide
pnpm lint        # eslint + prettier check
```

## Roadmap

See [plan.md](./plan.md) for the full v0 roadmap.
