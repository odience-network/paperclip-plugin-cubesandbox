import type { CubeSandboxConfig } from './config';

export interface CreateSandboxResponse {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface ExecuteResponse {
  output?: string;
  stderr?: string;
  exit_code: number;
  execution_time_ms: number;
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
  private sandboxId: string | null = null;

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

  async createSandbox(): Promise<string> {
    const response = await this.request<CreateSandboxResponse>(
      'POST',
      '/api/sandboxes',
      { templateId: this.config.templateId }
    );
    this.sandboxId = response.id;
    return response.id;
  }

  getSandboxId(): string | null {
    return this.sandboxId;
  }

  setSandboxId(id: string): void {
    this.sandboxId = id;
  }

  async execute(options: ExecuteOptions): Promise<ExecuteResponse> {
    if (!this.sandboxId) {
      throw new Error('Sandbox not created. Call createSandbox() first.');
    }
    return this.request<ExecuteResponse>(
      'POST',
      `/api/sandboxes/${this.sandboxId}/execute`,
      options
    );
  }

  async getSandboxInfo(): Promise<SandboxInfo> {
    if (!this.sandboxId) {
      throw new Error('Sandbox not created. Call createSandbox() first.');
    }
    return this.request<SandboxInfo>(
      'GET',
      `/api/sandboxes/${this.sandboxId}`
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
    if (!this.sandboxId) {
      throw new Error('Sandbox not created. Call createSandbox() first.');
    }
    await this.request<void>(
      'DELETE',
      `/api/sandboxes/${this.sandboxId}`
    );
    this.sandboxId = null;
  }
}

export default CubeSandboxClient;
