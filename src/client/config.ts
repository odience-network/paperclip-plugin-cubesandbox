export interface CubeSandboxConfig {
  serverUrl: string;
  apiKey: string;
  templateId: string;
}

export function loadConfigFromEnv(): CubeSandboxConfig {
  const serverUrl = process.env.CUBESANDBOX_SERVER_URL;
  const apiKey = process.env.CUBESANDBOX_API_KEY;
  const templateId = process.env.CUBESANDBOX_TEMPLATE_ID;

  if (!serverUrl) {
    throw new Error('CUBESANDBOX_SERVER_URL environment variable is required');
  }
  if (!apiKey) {
    throw new Error('CUBESANDBOX_API_KEY environment variable is required');
  }
  if (!templateId) {
    throw new Error('CUBESANDBOX_TEMPLATE_ID environment variable is required');
  }

  return {
    serverUrl: serverUrl.replace(/\/$/, ''),
    apiKey,
    templateId,
  };
}
