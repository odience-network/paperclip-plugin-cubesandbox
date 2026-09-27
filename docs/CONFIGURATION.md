# Configuration

Configuration for the `cubesandbox` environment driver, set per-environment in Paperclip (*Instance Settings →
Environments*). This plugin never reads configuration from `process.env` — every field below must come from the
environment's config, not the Paperclip host's shell environment.

## Fields

| Key | Type | Required | Default | Notes |
|---|---|---|---|---|
| `apiUrl` | string | ✅ | — | Base URL of the self-hosted CubeSandbox CubeAPI, e.g. `http://cube-host:3000`. Must parse as a valid URL. |
| `template` | string | ✅ | — | CubeSandbox template ID or alias to provision sandboxes from, e.g. `paperclip-agent-v1`. |
| `sandboxDomain` | string | | `cube.app` | Domain CubeProxy serves sandbox data-plane traffic on. Sandboxes are reached at `https://<port>-<sandboxId>.<sandboxDomain>`. |
| `apiKey` | string (`secret-ref`) | | none | Only needed if the CubeSandbox deployment enables `AUTH_CALLBACK_URL`. CubeAPI accepts unauthenticated requests by default, so most self-hosted deployments leave this empty. Pasted values are stored as a company secret, never written to disk in this repo. |
| `timeoutMs` | number | | `3600000` | Sandbox lifetime in milliseconds, refreshed on every command executed against the lease. Must be between `1` and `86400000`. |
| `reuseLease` | boolean | | `false` | When true, releasing a lease pauses the sandbox instead of killing it, and a future run can resume it. Leave off until you've verified pause/resume works for your template and workload — a paused sandbox still occupies Cube host capacity. |

## Validation

`onEnvironmentValidateConfig` rejects the config (with human-readable errors) when:
- `apiUrl` is missing or not a valid URL;
- `template` is missing or empty;
- `timeoutMs` is outside `[1, 86400000]`.

## TLS trust

The data plane (`https://<port>-<sandboxId>.<sandboxDomain>`) is signed by the Cube host's mkcert root CA, which is
private to your deployment and not in any public trust store. There is no per-environment CA option in this
plugin's config schema: the `e2b` SDK's underlying `fetch` reads trust roots from the Node.js process, not from a
value the plugin can pass in per call. Install the CA once at the Paperclip server level via
`NODE_EXTRA_CA_CERTS` — see [`SELF_HOSTING.md`](./SELF_HOSTING.md#4-wire-the-paperclip-host-to-the-cube-data-plane).

## Secrets

- Never put an API key in a file in this repo, in the sandbox template, or in `process.env` on the Paperclip host.
- The `apiKey` field uses `format: "secret-ref"`, so pasted values are stored as a Paperclip company secret rather
  than in the environment's plaintext config.
- The plugin never logs `apiKey` or any other secret value.
