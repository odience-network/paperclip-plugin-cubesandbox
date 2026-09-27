import { describe, expect, it } from "vitest";
import plugin from "../src/plugin.js";

// Exercises the plugin against a real, self-hosted CubeSandbox deployment.
// Skipped by default: set CUBE_API_URL and CUBE_TEMPLATE_ID to run it.
const apiUrl = process.env.CUBE_API_URL;
const template = process.env.CUBE_TEMPLATE_ID;

describe.skipIf(!apiUrl || !template)("CubeSandbox integration", () => {
  const config = {
    apiUrl: apiUrl ?? "",
    template: template ?? "",
    sandboxDomain: process.env.CUBE_SANDBOX_DOMAIN ?? "cube.app",
    apiKey: process.env.CUBE_API_KEY ?? null,
    timeoutMs: 300_000,
    reuseLease: false,
  };

  it(
    "probes, acquires a lease, executes commands, round-trips a file, and destroys the lease",
    async () => {
      const probe = await plugin.definition.onEnvironmentProbe?.({
        driverKey: "cubesandbox",
        config,
      });
      expect(probe?.ok).toBe(true);

      const lease = await plugin.definition.onEnvironmentAcquireLease?.({
        driverKey: "cubesandbox",
        companyId: "integration-test",
        environmentId: "integration-test",
        runId: "integration-test",
        config,
      });
      expect(lease?.providerLeaseId).toBeTruthy();
      if (!lease?.providerLeaseId) throw new Error("acquireLease did not return a providerLeaseId");

      try {
        const marker = `paperclip-integration-${Date.now()}`;
        const filePath = `/tmp/${marker}.txt`;

        const write = await plugin.definition.onEnvironmentExecute?.({
          driverKey: "cubesandbox",
          companyId: "integration-test",
          environmentId: "integration-test",
          config,
          lease,
          command: "sh",
          args: ["-c", `printf '%s' "${marker}" > ${filePath}`],
          env: {},
        });
        expect(write?.exitCode).toBe(0);

        const read = await plugin.definition.onEnvironmentExecute?.({
          driverKey: "cubesandbox",
          companyId: "integration-test",
          environmentId: "integration-test",
          config,
          lease,
          command: "cat",
          args: [filePath],
          env: {},
        });
        expect(read?.exitCode).toBe(0);
        expect(read?.stdout).toContain(marker);
      } finally {
        await plugin.definition.onEnvironmentDestroyLease?.({
          driverKey: "cubesandbox",
          companyId: "integration-test",
          environmentId: "integration-test",
          config,
          providerLeaseId: lease.providerLeaseId,
        });
      }
    },
    60_000,
  );
});
