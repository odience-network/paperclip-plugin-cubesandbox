# Development

This package is a standalone npm package, intentionally outside any Paperclip monorepo workspace, so it can be
published independently to the public npm registry.

## Setup

```bash
pnpm install
```

Use pnpm only. This repo does not commit `package-lock.json`; only `pnpm-lock.yaml` is tracked.

## Commands

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
pnpm build       # tsc, emits dist/
```

Run all three before opening a PR:
```bash
pnpm typecheck && pnpm test && pnpm build
```

## Structure

- `src/manifest.ts` — the plugin manifest: id, capabilities, and the `cubesandbox` environment driver's config schema.
- `src/plugin.ts` — the environment driver implementation (validate config, probe, acquire/resume/release/destroy
  lease, realize workspace, execute), built on the `e2b` SDK pointed at a self-hosted CubeAPI via `apiUrl`/`domain`.
- `src/worker.ts` — the worker entrypoint (`runWorker(plugin, import.meta.url)`).
- `src/plugin.test.ts` — unit tests with `e2b` mocked via `vi.mock`.
- `templates/paperclip-agent/` — the Dockerfile and build script for a CubeSandbox template that satisfies
  Paperclip's sandbox contract for the Claude Code CLI.

## Testing against a real CubeSandbox deployment

`pnpm test` runs both the mocked unit suite (`src/plugin.test.ts`, never makes network calls) and
`tests/integration.test.ts`, which is skipped automatically unless `CUBE_API_URL` and `CUBE_TEMPLATE_ID` are set. To
exercise it against a real deployment:

```bash
CUBE_API_URL=http://<cube-host>:3000 CUBE_TEMPLATE_ID=<template-id> pnpm test
```

See `tests/integration.test.ts` for what it covers (probe → lease → execute → write/read a file → destroy).

## Adding a config field

1. Add the field to `configSchema` in `src/manifest.ts`.
2. Add it to `CubeSandboxDriverConfig` and `parseDriverConfig` in `src/plugin.ts`.
3. Wire it into `connectionOpts`, lease metadata, or wherever else it affects behavior.
4. Add validation to `onEnvironmentValidateConfig` if the field has constraints.
5. Cover the new behavior in `src/plugin.test.ts`.
