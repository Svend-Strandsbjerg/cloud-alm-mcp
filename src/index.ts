import { ConsoleAuditLogger } from "./audit/auditLogger.js";
import type { CloudAlmClient } from "./cloudAlm/cloudAlmClient.js";
import { DestinationCloudAlmClient } from "./cloudAlm/destinationCloudAlmClient.js";
import { MockCloudAlmClient } from "./cloudAlm/mockCloudAlmClient.js";
import { loadRuntimeConfig } from "./config/runtimeConfig.js";
import { installGracefulShutdown } from "./mcp/gracefulShutdown.js";
import { startHttpTransport } from "./mcp/httpTransport.js";
import { createCloudAlmMcpServer } from "./mcp/server.js";
import { startStdioTransport } from "./mcp/stdioTransport.js";
import { CloudAlmPolicyGuard } from "./policy/cloudAlmPolicyGuard.js";

export async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const createServer = () => {
    const client = createClient(config.runtimeMode);
    const policyGuard = new CloudAlmPolicyGuard(config);
    const auditLogger = new ConsoleAuditLogger();
    return createCloudAlmMcpServer({ client, policyGuard, auditLogger });
  };

  if (config.mcpTransport === "stdio") {
    await startStdioTransport(createServer());
    return;
  }

  const handle = await startHttpTransport(createServer, config.port);
  installGracefulShutdown(handle);
}

function createClient(runtimeMode: "mock" | "destination"): CloudAlmClient {
  if (runtimeMode === "mock") {
    return new MockCloudAlmClient();
  }

  return new DestinationCloudAlmClient();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
