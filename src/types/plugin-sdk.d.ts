declare module '@paperclipai/plugin-sdk' {
  export interface PluginManifest {
    key: string;
    name: string;
    description: string;
    version: string;
    author: string;
    homepage?: string;
    capabilities: {
      worker?: { enabled: boolean };
      ui?: { enabled: boolean };
    };
    slots?: Array<{
      key: string;
      type: string;
      label: string;
      routePath?: string;
    }>;
    config?: {
      schema: Record<string, unknown>;
    };
  }

  export interface PluginWorkerContext {
    [key: string]: unknown;
  }

  export interface PluginUiContext {
    worker: Record<string, (...args: unknown[]) => Promise<unknown>>;
  }
}
