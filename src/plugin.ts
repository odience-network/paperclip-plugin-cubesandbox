import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  CommandExitError,
  Sandbox,
  SandboxNotFoundError,
  TimeoutError,
} from "e2b";
import { definePlugin } from "@paperclipai/plugin-sdk";
import type {
  PluginEnvironmentAcquireLeaseParams,
  PluginEnvironmentDestroyLeaseParams,
  PluginEnvironmentExecuteParams,
  PluginEnvironmentExecuteResult,
  PluginEnvironmentLease,
  PluginEnvironmentProbeParams,
  PluginEnvironmentProbeResult,
  PluginEnvironmentRealizeWorkspaceParams,
  PluginEnvironmentRealizeWorkspaceResult,
  PluginEnvironmentReleaseLeaseParams,
  PluginEnvironmentResumeLeaseParams,
  PluginEnvironmentValidateConfigParams,
  PluginEnvironmentValidationResult,
} from "@paperclipai/plugin-sdk";

interface CubeSandboxDriverConfig {
  apiUrl: string;
  template: string;
  sandboxDomain: string;
  apiKey: string | null;
  timeoutMs: number;
  reuseLease: boolean;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isValidUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function parseDriverConfig(raw: Record<string, unknown>): CubeSandboxDriverConfig {
  const timeoutMs = Number(raw.timeoutMs ?? 3_600_000);
  return {
    apiUrl: normalizeString(raw.apiUrl) ?? "",
    template: normalizeString(raw.template) ?? "",
    sandboxDomain: normalizeString(raw.sandboxDomain) ?? "cube.app",
    apiKey: normalizeString(raw.apiKey),
    timeoutMs: Number.isFinite(timeoutMs) ? Math.trunc(timeoutMs) : 3_600_000,
    reuseLease: raw.reuseLease === true,
  };
}

// CubeAPI accepts unauthenticated requests unless the deployment opts into
// AUTH_CALLBACK_URL, so apiKey is only forwarded when the environment
// configures one. There is no process.env fallback: CubeSandbox config is
// per-environment and must come from the Paperclip config, not the host.
function connectionOpts(config: CubeSandboxDriverConfig): {
  apiUrl: string;
  domain: string;
  apiKey?: string;
} {
  const opts: { apiUrl: string; domain: string; apiKey?: string } = {
    apiUrl: config.apiUrl,
    domain: config.sandboxDomain,
  };
  if (config.apiKey) {
    opts.apiKey = config.apiKey;
  }
  return opts;
}

async function createSandbox(config: CubeSandboxDriverConfig): Promise<Sandbox> {
  const options = {
    ...connectionOpts(config),
    timeoutMs: config.timeoutMs,
    metadata: {
      paperclipProvider: "cubesandbox",
    },
  };
  return await Sandbox.create(config.template, options);
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readTimeoutStream(error: TimeoutError, key: "stdout" | "stderr"): string {
  const record = error as unknown as Record<string, unknown>;
  const direct = record[key];
  if (typeof direct === "string" && direct.length > 0) return direct;
  const nested = (record as { result?: Record<string, unknown> }).result?.[key];
  if (typeof nested === "string") return nested;
  return typeof direct === "string" ? direct : "";
}

function buildTimeoutExecuteResult(error: TimeoutError): PluginEnvironmentExecuteResult {
  const stdout = readTimeoutStream(error, "stdout");
  const stderrOutput = readTimeoutStream(error, "stderr");
  const message = error.message.trim();
  const stderr = stderrOutput.length > 0
    ? message.length > 0 && !stderrOutput.includes(message)
      ? `${stderrOutput}${stderrOutput.endsWith("\n") ? "" : "\n"}${message}\n`
      : stderrOutput
    : message.length > 0
      ? `${message}\n`
      : "";
  return {
    exitCode: null,
    timedOut: true,
    stdout,
    stderr,
  };
}

async function ensureSandboxWorkspace(sandbox: Sandbox, remoteCwd: string): Promise<void> {
  await sandbox.commands.run(`mkdir -p ${shellQuote(remoteCwd)}`);
}

async function resolveSandboxWorkingDirectory(sandbox: Sandbox): Promise<string> {
  const result = await sandbox.commands.run("pwd");
  const cwd = result.stdout.trim();
  const remoteCwd = path.posix.join(cwd.length > 0 ? cwd : "/", "paperclip-workspace");
  await ensureSandboxWorkspace(sandbox, remoteCwd);
  return remoteCwd;
}

async function connectSandbox(config: CubeSandboxDriverConfig, providerLeaseId: string): Promise<Sandbox> {
  return await Sandbox.connect(providerLeaseId, {
    ...connectionOpts(config),
    timeoutMs: config.timeoutMs,
  });
}

async function connectForCleanup(config: CubeSandboxDriverConfig, providerLeaseId: string): Promise<Sandbox | null> {
  try {
    return await connectSandbox(config, providerLeaseId);
  } catch (error) {
    if (error instanceof SandboxNotFoundError) return null;
    throw error;
  }
}

function leaseMetadata(input: {
  config: CubeSandboxDriverConfig;
  sandbox: Sandbox;
  remoteCwd: string;
  resumedLease: boolean;
}) {
  return {
    provider: "cubesandbox",
    shellCommand: "bash",
    template: input.config.template,
    timeoutMs: input.config.timeoutMs,
    reuseLease: input.config.reuseLease,
    sandboxId: input.sandbox.sandboxId,
    sandboxDomain: input.sandbox.sandboxDomain,
    remoteCwd: input.remoteCwd,
    resumedLease: input.resumedLease,
  };
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function isValidShellEnvKey(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

// Source the user's login profiles before exec so commands run with the same
// PATH the user sees in an interactive shell. e2b's (and CubeAPI's identical)
// `sandbox.commands.run` otherwise spawns a non-login, non-interactive shell
// whose PATH does not include anything the template installs via
// .profile/.bashrc — which makes the hello probe fail with
// `exec: <cli>: not found` even when the binary is on disk. The wrapper never
// sources nvm.sh; the sandbox template must supply node on the PATH itself,
// per SANDBOX-REQUIREMENTS.md.
function buildLoginShellScript(input: {
  command: string;
  args: string[];
  env?: Record<string, string>;
}): string {
  const env = input.env ?? {};
  for (const key of Object.keys(env)) {
    if (!isValidShellEnvKey(key)) {
      throw new Error(`Invalid sandbox environment variable key: ${key}`);
    }
  }
  const envArgs = Object.entries(env)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([key, value]) => `${key}=${shellQuote(value)}`);
  const commandParts = [shellQuote(input.command), ...input.args.map(shellQuote)].join(" ");
  const execLine = envArgs.length > 0
    ? `exec env ${envArgs.join(" ")} ${commandParts}`
    : `exec ${commandParts}`;
  return [
    'if [ -f /etc/profile ]; then . /etc/profile >/dev/null 2>&1 || true; fi',
    'if [ -f "$HOME/.profile" ]; then . "$HOME/.profile" >/dev/null 2>&1 || true; fi',
    // .bash_profile typically sources .bashrc itself; only source .bashrc
    // directly when no .bash_profile exists to avoid re-running idempotency-
    // sensitive setup twice on templates that wire .bash_profile -> .bashrc.
    'if [ -f "$HOME/.bash_profile" ]; then . "$HOME/.bash_profile" >/dev/null 2>&1 || true; elif [ -f "$HOME/.bashrc" ]; then . "$HOME/.bashrc" >/dev/null 2>&1 || true; fi',
    'if [ -f "$HOME/.zprofile" ]; then . "$HOME/.zprofile" >/dev/null 2>&1 || true; fi',
    execLine,
  ].join(" && ");
}

async function killSandboxBestEffort(sandbox: Sandbox, reason: string): Promise<void> {
  await sandbox.kill().catch((error) => {
    console.warn(`Failed to kill CubeSandbox sandbox during ${reason}: ${formatErrorMessage(error)}`);
  });
}

async function releaseSandboxBestEffort(sandbox: Sandbox, reuseLease: boolean): Promise<void> {
  if (!reuseLease) {
    await killSandboxBestEffort(sandbox, "lease release");
    return;
  }

  try {
    await sandbox.pause();
  } catch (error) {
    console.warn(
      `Failed to pause CubeSandbox sandbox during lease release: ${formatErrorMessage(error)}. Attempting kill instead.`,
    );
    await killSandboxBestEffort(sandbox, "lease release fallback cleanup");
  }
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("CubeSandbox sandbox provider plugin ready");
  },

  async onHealth() {
    return { status: "ok", message: "CubeSandbox sandbox provider plugin healthy" };
  },

  async onEnvironmentValidateConfig(
    params: PluginEnvironmentValidateConfigParams,
  ): Promise<PluginEnvironmentValidationResult> {
    const config = parseDriverConfig(params.config);
    const errors: string[] = [];

    if (!config.apiUrl) {
      errors.push("CubeSandbox environments require an apiUrl.");
    } else if (!isValidUrl(config.apiUrl)) {
      errors.push("apiUrl must be a valid URL.");
    }
    if (!config.template) {
      errors.push("CubeSandbox environments require a template.");
    }
    if (config.timeoutMs < 1 || config.timeoutMs > 86_400_000) {
      errors.push("timeoutMs must be between 1 and 86400000.");
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      normalizedConfig: { ...config },
    };
  },

  async onEnvironmentProbe(
    params: PluginEnvironmentProbeParams,
  ): Promise<PluginEnvironmentProbeResult> {
    const config = parseDriverConfig(params.config);
    try {
      const sandbox = await createSandbox(config);
      try {
        await sandbox.setTimeout(config.timeoutMs);
        const remoteCwd = await resolveSandboxWorkingDirectory(sandbox);
        return {
          ok: true,
          summary: `Connected to CubeSandbox template ${config.template}.`,
          metadata: {
            provider: "cubesandbox",
            template: config.template,
            timeoutMs: config.timeoutMs,
            reuseLease: config.reuseLease,
            sandboxId: sandbox.sandboxId,
            sandboxDomain: sandbox.sandboxDomain,
            remoteCwd,
          },
        };
      } finally {
        await sandbox.kill().catch(() => undefined);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        summary: `CubeSandbox probe failed for template ${config.template}.`,
        metadata: {
          provider: "cubesandbox",
          template: config.template,
          timeoutMs: config.timeoutMs,
          reuseLease: config.reuseLease,
          error: message,
        },
      };
    }
  },

  async onEnvironmentAcquireLease(
    params: PluginEnvironmentAcquireLeaseParams,
  ): Promise<PluginEnvironmentLease> {
    const config = parseDriverConfig(params.config);
    const sandbox = await createSandbox(config);
    try {
      await sandbox.setTimeout(config.timeoutMs);
      const remoteCwd = await resolveSandboxWorkingDirectory(sandbox);

      return {
        providerLeaseId: sandbox.sandboxId,
        metadata: leaseMetadata({ config, sandbox, remoteCwd, resumedLease: false }),
      };
    } catch (error) {
      await sandbox.kill().catch(() => undefined);
      throw error;
    }
  },

  async onEnvironmentResumeLease(
    params: PluginEnvironmentResumeLeaseParams,
  ): Promise<PluginEnvironmentLease> {
    const config = parseDriverConfig(params.config);
    try {
      const sandbox = await connectSandbox(config, params.providerLeaseId);
      try {
        await sandbox.setTimeout(config.timeoutMs);
        const remoteCwd = await resolveSandboxWorkingDirectory(sandbox);

        return {
          providerLeaseId: sandbox.sandboxId,
          metadata: leaseMetadata({ config, sandbox, remoteCwd, resumedLease: true }),
        };
      } catch (error) {
        await sandbox.kill().catch(() => undefined);
        throw error;
      }
    } catch (error) {
      if (error instanceof SandboxNotFoundError) {
        return { providerLeaseId: null, metadata: { expired: true } };
      }
      throw error;
    }
  },

  async onEnvironmentReleaseLease(
    params: PluginEnvironmentReleaseLeaseParams,
  ): Promise<void> {
    if (!params.providerLeaseId) return;
    const config = parseDriverConfig(params.config);
    const sandbox = await connectForCleanup(config, params.providerLeaseId);
    if (!sandbox) return;

    await releaseSandboxBestEffort(sandbox, config.reuseLease);
  },

  async onEnvironmentDestroyLease(
    params: PluginEnvironmentDestroyLeaseParams,
  ): Promise<void> {
    if (!params.providerLeaseId) return;
    const config = parseDriverConfig(params.config);
    const sandbox = await connectForCleanup(config, params.providerLeaseId);
    if (!sandbox) return;
    await killSandboxBestEffort(sandbox, "lease destroy");
  },

  async onEnvironmentRealizeWorkspace(
    params: PluginEnvironmentRealizeWorkspaceParams,
  ): Promise<PluginEnvironmentRealizeWorkspaceResult> {
    const config = parseDriverConfig(params.config);
    const remoteCwd =
      typeof params.lease.metadata?.remoteCwd === "string" &&
      params.lease.metadata.remoteCwd.trim().length > 0
        ? params.lease.metadata.remoteCwd.trim()
        : params.workspace.remotePath ?? params.workspace.localPath ?? "/paperclip-workspace";

    if (params.lease.providerLeaseId) {
      const sandbox = await connectSandbox(config, params.lease.providerLeaseId);
      await ensureSandboxWorkspace(sandbox, remoteCwd);
    }

    return {
      cwd: remoteCwd,
      metadata: {
        provider: "cubesandbox",
        remoteCwd,
      },
    };
  },

  async onEnvironmentExecute(
    params: PluginEnvironmentExecuteParams,
  ): Promise<PluginEnvironmentExecuteResult> {
    if (!params.lease.providerLeaseId) {
      return {
        exitCode: 1,
        timedOut: false,
        stdout: "",
        stderr: "No provider lease ID available for execution.",
      };
    }

    const config = parseDriverConfig(params.config);
    const sandbox = await connectSandbox(config, params.lease.providerLeaseId);
    // Refresh the sandbox death clock on every command. `timeoutMs` is the
    // absolute sandbox lifetime from create/connect; without this, a run
    // longer than `config.timeoutMs` will have its sandbox killed mid-command
    // and the next call throws "Sandbox is probably not running anymore".
    // The refresh is best-effort: the sandbox is already healthy at this
    // point, so a transient API error on setTimeout should not block the
    // command from running. Worst case the existing lifetime stands.
    try {
      await sandbox.setTimeout(config.timeoutMs);
    } catch {
      // ignore — keep going with the existing sandbox lifetime
    }
    const baseCommand = buildLoginShellScript({
      command: params.command,
      args: params.args ?? [],
      env: params.env,
    });
    const timeoutMs = params.timeoutMs ?? config.timeoutMs;

    // For commands with stdin, stage the payload to a temp file inside the
    // sandbox and shell-redirect it. Streaming stdin via `sendStdin` races
    // with fast-failing commands (the process exits before the RPC lands).
    // The staged-file approach keeps execution synchronous, avoids the race,
    // and is unaffected by whether the command exits in microseconds or
    // minutes.
    let stagedStdinPath: string | null = null;
    if (params.stdin != null) {
      stagedStdinPath = `/tmp/paperclip-stdin-${randomUUID()}`;
      try {
        await sandbox.files.write(stagedStdinPath, params.stdin);
      } catch (error) {
        // Best-effort cleanup in case the write partially succeeded; ignore
        // remove failures so the original error is what propagates.
        await sandbox.files.remove(stagedStdinPath).catch(() => undefined);
        throw error;
      }
    }

    const command = stagedStdinPath
      ? `${baseCommand} < ${shellQuote(stagedStdinPath)}`
      : baseCommand;

    try {
      // Env is interpolated into the script via `exec env KEY=val …` after
      // profile sourcing so user-configured env wins over anything profiles
      // export. No need to pass `envs:` separately.
      const result = await sandbox.commands.run(command, {
        cwd: params.cwd,
        timeoutMs,
      }) as Awaited<ReturnType<Sandbox["commands"]["run"]>> & {
        exitCode: number;
        stdout: string;
        stderr: string;
      };
      return {
        exitCode: result.exitCode,
        timedOut: false,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error) {
      if (error instanceof CommandExitError) {
        return {
          exitCode: error.exitCode,
          timedOut: false,
          stdout: error.stdout,
          stderr: error.stderr,
        };
      }
      if (error instanceof TimeoutError) {
        return buildTimeoutExecuteResult(error);
      }
      throw error;
    } finally {
      if (stagedStdinPath) {
        await sandbox.files.remove(stagedStdinPath).catch(() => undefined);
      }
    }
  },
});

export default plugin;
