import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "odience.cubesandbox-sandbox-provider";
const PLUGIN_VERSION = "2.0.0";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "CubeSandbox Provider",
  description:
    "Sandbox provider plugin that provisions self-hosted Tencent CubeSandbox sandboxes as Paperclip execution environments.",
  author: "Odience",
  categories: ["automation"],
  capabilities: ["environment.drivers.register"],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  environmentDrivers: [
    {
      driverKey: "cubesandbox",
      kind: "sandbox_provider",
      displayName: "CubeSandbox",
      description:
        "Provisions sandboxes on a self-hosted CubeSandbox deployment via its E2B-compatible API.",
      configSchema: {
        type: "object",
        properties: {
          apiUrl: {
            type: "string",
            description: "Base URL of the self-hosted CubeSandbox CubeAPI, e.g. http://cube-host:3000.",
          },
          template: {
            type: "string",
            description: "CubeSandbox template ID or alias to provision sandboxes from.",
          },
          sandboxDomain: {
            type: "string",
            description: "Domain CubeProxy serves sandbox data-plane traffic on.",
            default: "cube.app",
          },
          apiKey: {
            type: "string",
            format: "secret-ref",
            description:
              "Optional CubeAPI auth key. Paste a key or an existing Paperclip secret reference; saved environments store pasted values as company secrets. CubeAPI accepts unauthenticated requests by default, so this is only required if the deployment's AUTH_CALLBACK_URL is enabled.",
          },
          timeoutMs: {
            type: "number",
            description:
              "Sandbox lifetime in milliseconds, refreshed on each command. Defaults to 1 hour.",
            default: 3600000,
          },
          reuseLease: {
            type: "boolean",
            description: "Whether to pause and reuse sandboxes across runs.",
            default: false,
          },
        },
        required: ["apiUrl", "template"],
      },
    },
  ],
};

export default manifest;
