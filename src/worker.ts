import type { PluginWorkerContext } from '@paperclipai/plugin-sdk';
import { CubeSandboxClient, loadConfigFromEnv } from './client';

declare global {
  interface PluginWorkerApi {
    execute: (code: string, language?: string) => Promise<{ status: string; output?: string; stderr?: string; exit_code?: number; error?: string }>;
    getSandboxInfo: () => Promise<{ id: string; status: string; createdAt: string; expiresAt: string }>;
    listSandboxes: () => Promise<Array<{ id: string; status: string; createdAt: string; expiresAt: string }>>;
    terminateSandbox: () => Promise<void>;
  }
}

let client: CubeSandboxClient | null = null;
let sandboxId: string | null = null;

function getClient(): CubeSandboxClient {
  if (!client) {
    const config = loadConfigFromEnv();
    client = new CubeSandboxClient(config);
  }
  return client;
}

async function ensureSandboxCreated(): Promise<void> {
  const c = getClient();

  if (!sandboxId) {
    sandboxId = await c.createSandbox();
    c.setSandboxId(sandboxId);
  } else {
    c.setSandboxId(sandboxId);
  }
}

export const workerApi: PluginWorkerApi = {
  async execute(code: string, language?: string) {
    const client = getClient();
    try {
      await ensureSandboxCreated();
      const response = await client.execute({
        code,
        language: language || 'python',
      });
      return {
        status: response.exit_code === 0 ? 'success' : 'error',
        output: response.output,
        stderr: response.stderr,
        exit_code: response.exit_code,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  async getSandboxInfo() {
    const client = getClient();
    try {
      await ensureSandboxCreated();
      const info = await client.getSandboxInfo();
      return {
        id: info.id,
        status: info.status,
        createdAt: info.createdAt,
        expiresAt: info.expiresAt,
      };
    } catch (error) {
      throw new Error(
        `Failed to get sandbox info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async listSandboxes() {
    const client = getClient();
    try {
      const sandboxes = await client.listSandboxes();
      return sandboxes.map((sb) => ({
        id: sb.id,
        status: sb.status,
        createdAt: sb.createdAt,
        expiresAt: sb.expiresAt,
      }));
    } catch (error) {
      throw new Error(
        `Failed to list sandboxes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async terminateSandbox() {
    const client = getClient();
    try {
      await ensureSandboxCreated();
      await client.terminateSandbox();
      sandboxId = null;
    } catch (error) {
      throw new Error(
        `Failed to terminate sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
};

export default workerApi;
