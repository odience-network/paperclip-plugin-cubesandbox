# Self-hosting CubeSandbox for Paperclip

This runbook walks through standing up a self-hosted [CubeSandbox](https://github.com/TencentCloud/CubeSandbox)
deployment and wiring it to Paperclip via this plugin. Checked against CubeSandbox `master` and `e2b` JS SDK `2.51.0`.

## 0. Topology and prerequisites

```
[Paperclip host]  ── REST :3000 ──►  [Cube host] CubeAPI
  plugin worker   ── HTTPS :443 ──►              CubeProxy ─► microVMs (*.cube.app)
```

**Cube host:**
- x86_64 or aarch64 Linux with `/dev/kvm` (bare metal or nested-virt VM). Without `/dev/kvm`, use the PVM kernel path
  instead: CubeSandbox `docs/guide/pvm-deploy.md`.
- glibc ≥ 2.31. OpenCloudOS 9 is recommended; Ubuntu 22.04/24.04 works.
- Root access and internet access for release packages and images.
- ≥ 4 cores / 8 GB for a functional setup, 32 cores / 64 GB recommended for production load.
- `/data/cubelet` on XFS, ≥ 50 GB (200 GB recommended).
- Free ports: 3000 (CubeAPI), 80/443 (CubeProxy), 8082 (proxy admin), 9090/9091, 12088 (WebUI), 3306/6379/9000/9001
  (bundled MySQL/Redis/MinIO), and 53 on `127.0.0.54` (CoreDNS). Any of these can be overridden in
  `.one-click.env` (see `deploy/one-click/env.example` in the CubeSandbox repo).

**Paperclip host:** Node ≥ 24.11, pnpm, Paperclip, and network reach to the Cube host. A private network such as
Tailscale is recommended over exposing CubeAPI publicly.

## 1. Prepare the Cube host

```bash
sudo su -
ls -l /dev/kvm && lsmod | grep kvm        # must exist; otherwise follow the PVM guide
```

### 1a. XFS for /data/cubelet

Preferred: a dedicated disk or partition.
```bash
mkfs.xfs -m reflink=1 /dev/<disk>
mkdir -p /data/cubelet
echo '/dev/<disk> /data/cubelet xfs defaults 0 0' >> /etc/fstab && mount -a
```
Fallback on an ext4-only machine: a loop image. It is slower; use it for evaluation only.
```bash
mkdir -p /srv/cube && truncate -s 200G /srv/cube/cubelet.xfs
mkfs.xfs -m reflink=1 /srv/cube/cubelet.xfs
mkdir -p /data/cubelet
echo '/srv/cube/cubelet.xfs /data/cubelet xfs loop,defaults 0 0' >> /etc/fstab && mount -a
xfs_info /data/cubelet | grep reflink=1
```

### 1b. Resolve port conflicts before installing

Download the installer and set overrides before it runs. The installer reads `deploy/one-click/.one-click.env`.
```
CUBE_API_BIND=<private-ip>:3000          # never 0.0.0.0 without auth
CUBE_PROXY_HTTP_PORT=80
CUBE_PROXY_HTTPS_PORT=443
CUBE_PROXY_ADMIN_PORT=8082
CUBE_SANDBOX_MYSQL_PORT=3306
CUBE_SANDBOX_REDIS_PORT=6379
```

## 2. Install CubeSandbox (bare metal / KVM)

```bash
curl -sL https://github.com/tencentcloud/CubeSandbox/raw/master/deploy/one-click/online-install.sh | bash
# cloud VM with the PVM kernel instead:  ... | CUBE_PVM_ENABLE=1 bash
```

This installs:
- the E2B-compatible CubeAPI on `:3000`;
- CubeMaster, Cubelet and CubeShim as systemd services;
- MySQL and Redis through Docker Compose;
- CubeProxy with mkcert TLS and CoreDNS for `*.cube.app`.

Verify:
```bash
systemctl --no-legend list-units 'cube-sandbox-*'
curl -s http://127.0.0.1:3000/health
```
WebUI: `http://<cube-host>:12088`. Check that the Overview page shows the node as Ready.

## 3. Create templates

### 3a. Smoke template (upstream code interpreter)
```bash
cubemastercli tpl create-from-image \
  --image cube-sandbox-int.tencentcloudcr.com/cube-sandbox/sandbox-code:latest \
  --writable-layer-size 1G --expose-port 49999 --expose-port 49983 --probe 49999
cubemastercli tpl watch --job-id <job_id>     # wait for READY and note template_id
```

### 3b. Paperclip agent template

Paperclip's sandbox contract ([`SANDBOX-REQUIREMENTS.md`](https://github.com/paperclipai/paperclip/blob/main/packages/plugins/sandbox-providers/SANDBOX-REQUIREMENTS.md))
requires:
- `node` on `PATH`;
- every agent CLI the runs use (`claude`, …) on `PATH`;
- `sh` and `tar`;
- writable workspace, home, cache and tmp directories.

The plugin never edits rc files or sources nvm, so `PATH` must already be correct in the image. A Dockerfile that
satisfies this for the Claude Code CLI ships in this repo as [`templates/paperclip-agent/`](../templates/paperclip-agent/):

```bash
cd templates/paperclip-agent
./build.sh <registry>/paperclip-agent:v1
```

`build.sh` builds and pushes the image, then wraps `cubemastercli tpl create-from-image` to register it. See the
script for the exact flags. Give the resulting template the alias `paperclip-agent-v1` (see
`docs/guide/template-aliases.md` in the CubeSandbox repo) so environments can reference a stable name across
template rebuilds.

## 4. Wire the Paperclip host to the Cube data plane

Sandboxes are reached at `https://<port>-<sandboxId>.<sandbox-domain>` through CubeProxy. The Paperclip host needs
two things.

**DNS:** the sandbox domain (`cube.app` by default) must resolve to the Cube host. With systemd-resolved, create
`/etc/systemd/resolved.conf.d/cube.conf`:
```ini
[Resolve]
DNS=<cube-host-ip>
Domains=~cube.app
```
Then run `systemctl restart systemd-resolved`, and check that `resolvectl query 49983-test.cube.app` returns the
Cube host IP. If the Cube host's CoreDNS is not reachable from here, use dnsmasq `address=/cube.app/<cube-host-ip>`
instead.

**TLS trust:** copy the mkcert root CA from the Cube host (`/root/.local/share/mkcert/rootCA.pem`) to the Paperclip
host. Then add `NODE_EXTRA_CA_CERTS=/etc/paperclip/cube-rootCA.pem` to the Paperclip server's environment and
restart it. This is a Paperclip-server-level setting, not plugin configuration — the plugin has no way to inject a
custom CA into the `e2b` SDK's fetch calls, so the trust anchor must be installed at the Node.js process level.

Quick check from the Paperclip host (this uses the `e2b` SDK directly, the same path the plugin uses):
```bash
mkdir -p /tmp/cube-smoke && cd /tmp/cube-smoke && npm i e2b@2.51.0 >/dev/null
E2B_API_URL=http://<cube-host>:3000 E2B_DOMAIN=cube.app E2B_API_KEY=local \
NODE_EXTRA_CA_CERTS=/etc/paperclip/cube-rootCA.pem node --input-type=module -e '
import { Sandbox } from "e2b";
const sb = await Sandbox.create("<template_id>", {
  apiUrl: process.env.E2B_API_URL,
  domain: process.env.E2B_DOMAIN,
});
console.log((await sb.commands.run("uname -a && node -v")).stdout);
await sb.kill();'
```

## 5. Access control

Bind CubeAPI to a private interface only, e.g. `CUBE_API_BIND=<private-ip>:3000` in `.one-click.env`, and restrict
network access to the Paperclip host (a firewall rule or a private overlay network such as Tailscale ACLs both
work). Do **not** expose port 12088 (WebUI) beyond admins.

### Optional: API authentication

By default CubeAPI accepts every request. To turn on auth:
1. Set `AUTH_CALLBACK_URL=http://127.0.0.1:<port>/verify` in `.one-click.env`.
2. Restart with `systemctl restart cube-sandbox-cube-api.service`.

The callback receives `Authorization`/`X-API-Key` plus `X-Request-Path` and `X-Request-Method`. It must allow or
deny on **both** path and method. It returns 200 to allow; anything else produces a 401. Store the key only as a
Paperclip company secret (via the environment's **API key** field, see [`docs/CONFIGURATION.md`](./CONFIGURATION.md)).
Never put it in files in this repo.

## 6. Build and install the plugin

```bash
git clone https://github.com/odience-network/paperclip-plugin-cubesandbox.git
cd paperclip-plugin-cubesandbox
pnpm install && pnpm typecheck && pnpm test && pnpm build
pnpm paperclipai plugin install .
pnpm paperclipai plugin list
pnpm paperclipai plugin inspect odience.cubesandbox-sandbox-provider   # status must be "ready"
```
The CLI needs board access (a board login or board API key); an agent key returns `403 Board access required`.
For local-path installs, the server watches `dist/` and restarts the worker on rebuild. **Manifest changes need a
reinstall.**

## 7. Create the CubeSandbox environment

Go to *Instance Settings → Environments → New → CubeSandbox* and fill in:

| Field | Value |
|---|---|
| API URL | `http://<cube-host>:3000` |
| API key | paste it if auth is on; leave empty otherwise (it is saved as a company secret) |
| Template | `paperclip-agent-v1` (alias) or a template ID |
| Sandbox domain | `cube.app` |
| Timeout (ms) | `3600000` |
| Reuse lease | off, until pause/resume has been verified for your workload |

Click **Probe**. It must report ready. Then assign the environment to a project or agent.

## 8. Verify end to end

1. Probe passes.
2. Start a run for an agent using the environment. The run transcript shows commands executing in the sandbox
   (`uname -a` shows the guest kernel).
3. Workspace changes sync back to the project workspace.
4. The sandbox appears in the Cube WebUI during the run and is gone afterwards (or paused, if reuse is on).

## 9. Operations

- **Logs:** request and VMM logs are in `/data/log/<Module>/`, **not** journalctl. `journalctl -u
  cube-sandbox-cube-api` only has startup failures. For a diagnostic bundle, run
  `/usr/local/services/cubetoolbox/scripts/cube-diag/collect-logs.sh`.
- **Upgrade CubeSandbox:** re-run the online installer at the new release. Read the CubeSandbox changelog for
  E2B-compat changes, then re-run section 4's smoke check and the plugin's integration test.
- **Upgrade the plugin:** `git pull && pnpm build` (local path), then `plugin inspect`.
- **Rollback:**
  1. Move projects back to their previous environment.
  2. Run `pnpm paperclipai plugin disable|uninstall <id>`.
  3. On the Cube host, `deploy/one-click/down.sh` stops the stack. The data in `/data/cubelet` survives.
- **Hardening before untrusted workloads:** follow CubeSandbox `network-hardening.md`, `network-policy.md` and
  `security-proxy.md` (CubeEgress domain allowlists).

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `getaddrinfo ENOTFOUND 49983-….cube.app` | Step 4 DNS is missing on the Paperclip host |
| `self-signed certificate in certificate chain` | `NODE_EXTRA_CA_CERTS` is not set on the Paperclip server process |
| 401 from CubeAPI | Auth callback is on and the environment has no key, or the callback rejected the path+method |
| Probe OK, but runs fail with `command not found: claude` | The template image is missing the agent CLI or has the wrong `PATH` (step 3b) |
| Template stuck, not READY | Image pull or size problem. Check `cubemastercli tpl watch` and the CubeMaster logs |
| Installer refuses to run | `/data/cubelet` is not XFS, `/dev/kvm` is missing, or glibc < 2.31 |
