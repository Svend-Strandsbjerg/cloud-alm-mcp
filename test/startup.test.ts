import { describe, expect, it } from "vitest";
import { ConsoleAuditLogger } from "../src/audit/auditLogger.js";
import { MockCloudAlmClient } from "../src/cloudAlm/mockCloudAlmClient.js";
import { loadRuntimeConfig } from "../src/config/runtimeConfig.js";
import { createHealthStatus } from "../src/health/healthServer.js";
import { createHttpApp } from "../src/mcp/httpTransport.js";
import { createCloudAlmMcpServer } from "../src/mcp/server.js";
import { CloudAlmPolicyGuard } from "../src/policy/cloudAlmPolicyGuard.js";

describe("startup skeleton", () => {
  it("creates health status without Cloud ALM credentials", () => {
    const config = loadRuntimeConfig({});
    expect(createHealthStatus(config)).toEqual({
      status: "ok",
      runtimeMode: "mock",
      transport: "http"
    });
  });

  it("creates the HTTP app without Cloud ALM credentials", async () => {
    const config = loadRuntimeConfig({});
    const server = createCloudAlmMcpServer({
      client: new MockCloudAlmClient(),
      policyGuard: new CloudAlmPolicyGuard(config),
      auditLogger: new ConsoleAuditLogger()
    });

    const app = await createHttpApp(server);
    expect(app).toBeDefined();
  });
});
