import type { CubeSandboxConfig } from './config';

export interface ExecuteResponse {
  requestId: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
}

export interface SandboxInfo {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface ExecuteOptions {
  code: string;
  language?: string;
  timeout?: number;
}

export class CubeSandboxClient {
  private config: CubeSandboxConfig;

  constructor(config: CubeSandboxConfig) {
    this.config = config;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = new URL(path, this.config.serverUrl).href;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `CubeSandbox API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async execute(options: ExecuteOptions): Promise<ExecuteResponse> {
    return this.request<ExecuteResponse>('POST', '/api/execute', {
      templateId: this.config.templateId,
      ...options,
    });
  }

  async getSandboxInfo(): Promise<SandboxInfo> {
    return this.request<SandboxInfo>(
      'GET',
      `/api/sandboxes/${this.config.templateId}`
    );
  }

  async listSandboxes(): Promise<SandboxInfo[]> {
    const response = await this.request<{ sandboxes: SandboxInfo[] }>(
      'GET',
      '/api/sandboxes'
    );
    return response.sandboxes;
  }

  async terminateSandbox(): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/api/sandboxes/${this.config.templateId}`
    );
  }
}

export default CubeSandboxClient;
