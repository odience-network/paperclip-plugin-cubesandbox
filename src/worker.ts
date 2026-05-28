import type { PluginWorkerContext } from '@paperclipai/plugin-sdk';
import { CubeSandboxClient, loadConfigFromEnv } from './client';

declare global {
  interface PluginWorkerApi {
    execute: (code: string, language?: string) => Promise<{ status: string; result?: unknown; error?: string }>;
    getSandboxInfo: () => Promise<{ id: string; status: string; createdAt: string; expiresAt: string }>;
    listSandboxes: () => Promise<Array<{ id: string; status: string; createdAt: string; expiresAt: string }>>;
  }
}

let client: CubeSandboxClient | null = null;

function getClient(): CubeSandboxClient {
  if (!client) {
    const config = loadConfigFromEnv();
    client = new CubeSandboxClient(config);
  }
  return client;
}

export const workerApi: PluginWorkerApi = {
  async execute(code: string, language?: string) {
    const client = getClient();
    try {
      const response = await client.execute({
        code,
        language: language || 'python',
        timeout: 30000,
      });
      return {
        status: response.status,
        result: response.result,
        error: response.error,
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
};

export default workerApi;
