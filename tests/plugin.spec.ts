import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CubeSandboxClient } from '../src/client/cubesandbox';
import { loadConfigFromEnv, type CubeSandboxConfig } from '../src/client/config';

const mockConfig: CubeSandboxConfig = {
  serverUrl: 'https://api.cubesandbox.example.com',
  apiKey: 'test-api-key',
  templateId: 'test-template-id',
};

function jsonResponse(body: unknown, init: Partial<ResponseInit> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function errorResponse(status: number, statusText: string, body = ''): Response {
  return new Response(body, { status, statusText });
}

describe('loadConfigFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CUBESANDBOX_SERVER_URL;
    delete process.env.CUBESANDBOX_API_KEY;
    delete process.env.CUBESANDBOX_TEMPLATE_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when CUBESANDBOX_SERVER_URL is missing', () => {
    expect(() => loadConfigFromEnv()).toThrow(
      'CUBESANDBOX_SERVER_URL environment variable is required'
    );
  });

  it('throws when CUBESANDBOX_API_KEY is missing', () => {
    process.env.CUBESANDBOX_SERVER_URL = 'https://api.test.com';
    expect(() => loadConfigFromEnv()).toThrow(
      'CUBESANDBOX_API_KEY environment variable is required'
    );
  });

  it('throws when CUBESANDBOX_TEMPLATE_ID is missing', () => {
    process.env.CUBESANDBOX_SERVER_URL = 'https://api.test.com';
    process.env.CUBESANDBOX_API_KEY = 'k';
    expect(() => loadConfigFromEnv()).toThrow(
      'CUBESANDBOX_TEMPLATE_ID environment variable is required'
    );
  });

  it('loads config from environment variables', () => {
    process.env.CUBESANDBOX_SERVER_URL = 'https://api.test.com';
    process.env.CUBESANDBOX_API_KEY = 'test-key';
    process.env.CUBESANDBOX_TEMPLATE_ID = 'test-template';

    const config = loadConfigFromEnv();

    expect(config).toEqual({
      serverUrl: 'https://api.test.com',
      apiKey: 'test-key',
      templateId: 'test-template',
    });
  });

  it('strips trailing slash from server URL', () => {
    process.env.CUBESANDBOX_SERVER_URL = 'https://api.test.com/';
    process.env.CUBESANDBOX_API_KEY = 'k';
    process.env.CUBESANDBOX_TEMPLATE_ID = 't';

    expect(loadConfigFromEnv().serverUrl).toBe('https://api.test.com');
  });
});

describe('CubeSandboxClient', () => {
  let client: CubeSandboxClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new CubeSandboxClient(mockConfig);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is instantiated with config', () => {
    expect(client).toBeDefined();
  });

  describe('execute', () => {
    it('POSTs to /api/execute with templateId, code, and bearer auth', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          requestId: 'req-1',
          status: 'success',
          result: { stdout: 'hello\n' },
        })
      );

      const res = await client.execute({ code: 'print("hi")', language: 'python' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.cubesandbox.example.com/api/execute');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer test-api-key'
      );
      expect((init.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json'
      );
      expect(JSON.parse(init.body as string)).toEqual({
        templateId: 'test-template-id',
        code: 'print("hi")',
        language: 'python',
      });
      expect(res).toEqual({
        requestId: 'req-1',
        status: 'success',
        result: { stdout: 'hello\n' },
      });
    });

    it('surfaces a structured error on non-2xx responses', async () => {
      fetchMock.mockResolvedValueOnce(
        errorResponse(500, 'Internal Server Error', 'sandbox boot failed')
      );

      await expect(
        client.execute({ code: 'boom', language: 'python' })
      ).rejects.toThrow(
        'CubeSandbox API error: 500 Internal Server Error - sandbox boot failed'
      );
    });

    it('propagates network errors from fetch', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        client.execute({ code: 'x', language: 'python' })
      ).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('getSandboxInfo', () => {
    it('GETs the template-scoped sandbox endpoint', async () => {
      const info = {
        id: 'sbx-1',
        status: 'running',
        createdAt: '2026-05-28T00:00:00Z',
        expiresAt: '2026-05-28T01:00:00Z',
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(info));

      const result = await client.getSandboxInfo();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://api.cubesandbox.example.com/api/sandboxes/test-template-id'
      );
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      expect(result).toEqual(info);
    });

    it('wraps non-2xx responses with context', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(404, 'Not Found', 'no sandbox'));

      await expect(client.getSandboxInfo()).rejects.toThrow(
        'CubeSandbox API error: 404 Not Found - no sandbox'
      );
    });
  });

  describe('listSandboxes', () => {
    it('returns the inner sandboxes array', async () => {
      const sandboxes = [
        { id: 'a', status: 'running', createdAt: 't1', expiresAt: 't2' },
        { id: 'b', status: 'stopped', createdAt: 't3', expiresAt: 't4' },
      ];
      fetchMock.mockResolvedValueOnce(jsonResponse({ sandboxes }));

      const result = await client.listSandboxes();

      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://api.cubesandbox.example.com/api/sandboxes'
      );
      expect(result).toEqual(sandboxes);
    });
  });

  describe('terminateSandbox', () => {
    it('DELETEs the template-scoped sandbox endpoint', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));

      await client.terminateSandbox();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://api.cubesandbox.example.com/api/sandboxes/test-template-id'
      );
      expect(init.method).toBe('DELETE');
    });
  });
});

describe('worker handlers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env = {
      ...originalEnv,
      CUBESANDBOX_SERVER_URL: 'https://api.cubesandbox.example.com',
      CUBESANDBOX_API_KEY: 'test-api-key',
      CUBESANDBOX_TEMPLATE_ID: 'test-template-id',
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  it('execute() returns status/result/error from the API', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        requestId: 'r-1',
        status: 'success',
        result: { stdout: 'ok\n' },
      })
    );

    const { workerApi } = await import('../src/worker');
    const res = await workerApi.execute('print(1)', 'python');

    expect(res).toEqual({
      status: 'success',
      result: { stdout: 'ok\n' },
      error: undefined,
    });
  });

  it('execute() defaults language to python when omitted', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ requestId: 'r-2', status: 'success' })
    );

    const { workerApi } = await import('../src/worker');
    await workerApi.execute('print(1)');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.language).toBe('python');
  });

  it('execute() catches client errors and returns an error envelope', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'Server Error', 'boom'));

    const { workerApi } = await import('../src/worker');
    const res = await workerApi.execute('bad', 'python');

    expect(res.status).toBe('error');
    expect(res.error).toMatch(/CubeSandbox API error: 500/);
  });

  it('getSandboxInfo() projects the client response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'sbx-1',
        status: 'running',
        createdAt: '2026-05-28T00:00:00Z',
        expiresAt: '2026-05-28T01:00:00Z',
      })
    );

    const { workerApi } = await import('../src/worker');
    const info = await workerApi.getSandboxInfo();

    expect(info).toEqual({
      id: 'sbx-1',
      status: 'running',
      createdAt: '2026-05-28T00:00:00Z',
      expiresAt: '2026-05-28T01:00:00Z',
    });
  });

  it('getSandboxInfo() wraps client errors with descriptive context', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404, 'Not Found', 'gone'));

    const { workerApi } = await import('../src/worker');
    await expect(workerApi.getSandboxInfo()).rejects.toThrow(
      /Failed to get sandbox info: CubeSandbox API error: 404/
    );
  });

  it('listSandboxes() maps the sandboxes array', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sandboxes: [
          { id: 'a', status: 'running', createdAt: 't1', expiresAt: 't2' },
        ],
      })
    );

    const { workerApi } = await import('../src/worker');
    const list = await workerApi.listSandboxes();

    expect(list).toEqual([
      { id: 'a', status: 'running', createdAt: 't1', expiresAt: 't2' },
    ]);
  });

  it('listSandboxes() wraps client errors with descriptive context', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(503, 'Unavailable', 'down'));

    const { workerApi } = await import('../src/worker');
    await expect(workerApi.listSandboxes()).rejects.toThrow(
      /Failed to list sandboxes: CubeSandbox API error: 503/
    );
  });
});

describe('plugin manifest', () => {
  it('declares worker + ui capabilities and required config schema', async () => {
    const { default: manifest } = await import('../src/manifest');

    expect(manifest.key).toBe('@odience/cubesandbox');
    expect(manifest.capabilities.worker?.enabled).toBe(true);
    expect(manifest.capabilities.ui?.enabled).toBe(true);
    const schema = manifest.config?.schema as {
      required?: string[];
      properties?: Record<string, unknown>;
    };
    expect(schema.required).toEqual(
      expect.arrayContaining(['serverUrl', 'apiKey', 'templateId'])
    );
  });
});
