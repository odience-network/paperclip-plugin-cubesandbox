import type { PluginManifest } from '@paperclipai/plugin-sdk';

const manifest: PluginManifest = {
  key: '@odience/paperclip-plugin-cubesandbox',
  name: 'CubeSandbox',
  description: 'Execute code in isolated CubeSandbox environments',
  version: '1.0.0',
  author: 'Odience',
  homepage: 'https://github.com/TencentCloud/CubeSandbox',
  capabilities: {
    worker: {
      enabled: true,
    },
    ui: {
      enabled: true,
    },
  },
  slots: [
    {
      key: 'page',
      type: 'page',
      label: 'CubeSandbox',
      routePath: '/cubesandbox',
    },
  ],
  config: {
    schema: {
      type: 'object',
      properties: {
        serverUrl: {
          type: 'string',
          title: 'CubeSandbox Server URL',
          description: 'Base URL of the CubeSandbox API server',
          examples: ['https://api.cubesandbox.example.com'],
        },
        apiKey: {
          type: 'string',
          title: 'API Key',
          description: 'Authentication key for CubeSandbox API',
        },
        templateId: {
          type: 'string',
          title: 'Template ID',
          description: 'Default template ID for sandbox execution',
        },
      },
      required: ['serverUrl', 'apiKey', 'templateId'],
    },
  },
};

export default manifest;
