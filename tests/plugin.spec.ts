import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CubeSandboxClient } from '../src/client/cubesandbox';
import type { CubeSandboxConfig } from '../src/client/config';

describe('CubeSandboxClient', () => {
  let client: CubeSandboxClient;
  const mockConfig: CubeSandboxConfig = {
    serverUrl: 'https://api.cubesandbox.example.com',
    apiKey: 'test-api-key',
    templateId: 'test-template-id',
  };

  beforeEach(() => {
    client = new CubeSandboxClient(mockConfig);
  });

  it('should be instantiated with config', () => {
    expect(client).toBeDefined();
  });

  it('should throw error on missing required env vars', () => {
    const originalEnv = process.env;
    process.env = {};

    const { loadConfigFromEnv } = require('../src/client/config');

    expect(() => loadConfigFromEnv()).toThrow('CUBESANDBOX_SERVER_URL environment variable is required');

    process.env = originalEnv;
  });

  it('should load config from environment variables', () => {
    const originalEnv = process.env;
    process.env = {
      CUBESANDBOX_SERVER_URL: 'https://api.test.com',
      CUBESANDBOX_API_KEY: 'test-key',
      CUBESANDBOX_TEMPLATE_ID: 'test-template',
    };

    const { loadConfigFromEnv } = require('../src/client/config');
    const config = loadConfigFromEnv();

    expect(config.serverUrl).toBe('https://api.test.com');
    expect(config.apiKey).toBe('test-key');
    expect(config.templateId).toBe('test-template');

    process.env = originalEnv;
  });
});
