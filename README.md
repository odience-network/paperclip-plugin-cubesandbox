# @odience/paperclip-plugin-cubesandbox

[![npm version](https://img.shields.io/npm/v/@odience/paperclip-plugin-cubesandbox)](https://www.npmjs.com/package/@odience/paperclip-plugin-cubesandbox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Paperclip [sandbox-provider environment driver](https://docs.paperclip.ai/plugins) that provisions sandboxes on a
self-hosted [Tencent CubeSandbox](https://github.com/TencentCloud/CubeSandbox) deployment. CubeSandbox exposes an
E2B-compatible REST API (CubeAPI), so this driver talks to it using the official [`e2b`](https://www.npmjs.com/package/e2b)
JS SDK pointed at your own CubeAPI instance instead of the e2b.app SaaS.

Paperclip agents use this plugin to acquire a sandbox lease, sync a workspace into it, and run commands inside it —
the same environment-driver contract Paperclip's first-party E2B driver implements.

## What this is not

This plugin does not ship a mock or reference CubeSandbox server, a UI, or any generic sandbox client API. It is a
worker-only plugin: one environment driver (`cubesandbox`) registered against the real, self-hosted CubeAPI.

## Requirements

- A running CubeSandbox deployment (CubeAPI, CubeProxy, CubeMaster/Cubelet) reachable from the Paperclip host — see
  [`docs/SELF_HOSTING.md`](./docs/SELF_HOSTING.md) for the full install/wiring runbook.
- A sandbox template built to satisfy Paperclip's execution contract (`node` and your agent CLIs on `PATH`, `sh`,
  `tar`, writable home/cache/tmp/workspace). A ready-made Claude Code template lives in
  [`templates/paperclip-agent/`](./templates/paperclip-agent/).
- Node.js ≥ 24.11 and pnpm on the Paperclip host.

## Install

```bash
pnpm add @odience/paperclip-plugin-cubesandbox
# or, from a local checkout:
pnpm paperclipai plugin install /path/to/paperclip-plugin-cubesandbox
```

## Configure

Create a CubeSandbox environment in Paperclip (*Instance Settings → Environments → New → CubeSandbox*) with:

| Field | Required | Notes |
|---|---|---|
| API URL | ✅ | Base URL of your CubeAPI, e.g. `http://cube-host:3000` |
| Template | ✅ | Template ID or alias, e.g. `paperclip-agent-v1` |
| Sandbox domain | | Domain CubeProxy serves sandboxes on. Defaults to `cube.app` |
| API key | | Only needed if the deployment enables `AUTH_CALLBACK_URL`. CubeAPI accepts unauthenticated requests by default |
| Timeout (ms) | | Sandbox lifetime, refreshed on every command. Defaults to `3600000` |
| Reuse lease | | Pause and reuse sandboxes across runs instead of killing them. Defaults to off |

See [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md) for the full config schema and TLS notes.

## Documentation

- [`docs/SELF_HOSTING.md`](./docs/SELF_HOSTING.md) — install CubeSandbox, build a template, wire DNS/TLS, install the plugin
- [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md) — config schema, secrets handling, TLS trust
- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) — building and testing this plugin
- [`CHANGELOG.md`](./CHANGELOG.md)

## License

MIT — see [LICENSE](./LICENSE).
