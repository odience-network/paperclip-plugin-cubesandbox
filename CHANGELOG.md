# Changelog

All notable changes to the CubeSandbox plugin for Paperclip will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-27

Full rewrite. The 1.0.0 release targeted a generic sandbox client API and a mock CubeSandbox server that no longer
exist; 2.0.0 replaces it with a proper Paperclip **sandbox-provider environment driver**, forked from Paperclip's
first-party E2B driver, that talks to a real self-hosted CubeSandbox deployment through its E2B-compatible API.

### Changed (breaking)

- Replaced the ad-hoc `CubeSandboxClient` worker API (`execute`, `getSandboxInfo`, `listSandboxes`,
  `terminateSandbox`) with the standard Paperclip environment-driver lifecycle hooks: `onEnvironmentValidateConfig`,
  `onEnvironmentProbe`, `onEnvironmentAcquireLease`, `onEnvironmentResumeLease`, `onEnvironmentReleaseLease`,
  `onEnvironmentDestroyLease`, `onEnvironmentRealizeWorkspace`, `onEnvironmentExecute`.
- Replaced the invented `/api/sandboxes/{id}/execute` REST client with the official `e2b` SDK, pointed at a
  self-hosted CubeAPI via the `apiUrl`/`sandboxDomain` config fields instead of e2b.app.
- Replaced the `serverUrl`/`apiKey`/`templateId` config schema and `CUBESANDBOX_*` environment variables with a
  single environment config: `apiUrl`, `template` (both required), `sandboxDomain`, `apiKey` (optional
  `secret-ref`), `timeoutMs`, `reuseLease`. The plugin no longer reads any configuration from `process.env`.
- Removed the web UI and its `page` slot. This is a worker-only plugin now.
- Bumped `@paperclipai/plugin-sdk` to a real published dependency (`definePlugin`/`runWorker`) instead of a
  hand-written `.d.ts` shim.
- Switched build tooling from esbuild/Vite to `tsc`, and package management to pnpm only (removed
  `package-lock.json`).
- Raised the minimum supported Node.js version to 24.11.

### Added

- `templates/paperclip-agent/` — a Dockerfile and build script for a CubeSandbox template that satisfies
  Paperclip's sandbox contract for the Claude Code CLI.
- `docs/SELF_HOSTING.md`, `docs/CONFIGURATION.md`, `docs/DEVELOPMENT.md`.
- `tests/integration.test.ts`, a real-deployment test (probe → lease → execute → write/read a file → destroy)
  skipped unless `CUBE_API_URL` and `CUBE_TEMPLATE_ID` are set.
- CI (`typecheck`, `test`, `build` on PRs) and release (npm publish with provenance on `v*` tags) GitHub Actions
  workflows.

### Removed

- `src/client/*`, the hand-written `PluginManifest`/`PluginWorkerApi` shim types, the React UI, `esbuild.config.cjs`,
  `.env.example`, `API_DOCS.md`, `INTEGRATION_GUIDE.md`, and the old `tests/e2e.sh` / `tests/plugin.spec.ts`, none of
  which matched the plugin's real runtime contract or a real CubeSandbox deployment.

### Migration

There is no compatible upgrade path from 1.0.0: it never worked against a real CubeSandbox deployment (it targeted
a mock server that has since been removed). Configure a new CubeSandbox environment using the fields documented in
[`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md) and [`docs/SELF_HOSTING.md`](./docs/SELF_HOSTING.md).

## [1.0.0] - 2025-05-28

Initial release. Targeted a mock CubeSandbox server and a generic worker RPC API; superseded by 2.0.0.
