import http from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Express } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryAuditLogger } from "../src/audit/auditLogger.js";
import { MockCloudAlmClient } from "../src/cloudAlm/mockCloudAlmClient.js";
import type { RuntimeConfig } from "../src/config/runtimeConfig.js";
import { createHttpApp, MCP_JSON_BODY_LIMIT, startHttpTransport } from "../src/mcp/httpTransport.js";
import { createCloudAlmMcpServer } from "../src/mcp/server.js";
import { CloudAlmPolicyGuard } from "../src/policy/cloudAlmPolicyGuard.js";

const config: RuntimeConfig = {
  runtimeMode: "mock",
  mcpTransport: "http",
  port: 3000,
  readCapabilityEnabled: true,
  writeCapabilityEnabled: true,
  allowedDestinations: ["cloud-alm-dev"],
  externalCallsEnabled: false
};

const servers: http.Server[] = [];
const clients: Client[] = [];

afterEach(async () => {
  while (clients.length > 0) {
    await clients.pop()?.close();
  }

  while (servers.length > 0) {
    const server = servers.pop();
    if (!server) {
      continue;
    }

    await closeServer(server);
  }
});

describe("HTTP MCP transport", () => {
  it("keeps health stable without Cloud ALM connectivity", async () => {
    const { baseUrl } = await startTestHttpServer();

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("starts with the configured listener path and closes idempotently", async () => {
    const handle = await startHttpTransport(createTestMcpServer, 0);

    expect(handle.app).toBeDefined();
    await handle.close();
    await handle.close();
  });

  it("supports valid MCP POST initialize/list/call flow", async () => {
    const { baseUrl } = await startTestHttpServer();
    const client = await createHttpMcpClient(baseUrl);

    const tools = await client.listTools();
    const task = await client.callTool({ name: "alm_get_task", arguments: { taskId: "TASK-1001" } });

    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "alm_add_comment",
      "alm_get_comments",
      "alm_get_task",
      "alm_update_task"
    ]);
    expect(parseTextResult(task)).toMatchObject({ id: "TASK-1001", status: "OPEN" });
  });

  it("returns explicit 405 responses with Allow POST for unsupported MCP methods", async () => {
    const { baseUrl } = await startTestHttpServer();

    for (const method of ["GET", "DELETE", "PUT"]) {
      const response = await fetch(`${baseUrl}/mcp`, { method });

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
      expect(await response.json()).toEqual({ error: { message: "Method Not Allowed" } });
    }
  });

  it("returns controlled errors for invalid JSON, oversized bodies, and unsupported content types", async () => {
    const { baseUrl } = await startTestHttpServer();

    const invalidJson = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    const oversizedBody = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(70 * 1024) })
    });
    const unsupportedContentType = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "plain"
    });

    expect(MCP_JSON_BODY_LIMIT).toBe("64kb");
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.json()).toEqual({ error: { message: "Invalid JSON" } });
    expect(oversizedBody.status).toBe(413);
    expect(await oversizedBody.json()).toEqual({ error: { message: "Payload Too Large" } });
    expect(unsupportedContentType.status).toBe(415);
    expect(await unsupportedContentType.json()).toEqual({ error: { message: "Unsupported Media Type" } });
  });

  it("echoes safe request IDs without logging request bodies", async () => {
    const { baseUrl } = await startTestHttpServer();

    const response = await fetch(`${baseUrl}/health`, { headers: { "x-request-id": "test-request-id" } });

    expect(response.headers.get("x-request-id")).toBe("test-request-id");
  });

  it("handles concurrent MCP POST tool calls with isolated per-request mock state", async () => {
    const { baseUrl } = await startTestHttpServer();

    const [first, second] = await Promise.all([callAddComment(baseUrl), callAddComment(baseUrl)]);

    expect(first).toMatchObject({ id: "COMMENT-1002", taskId: "TASK-1002" });
    expect(second).toMatchObject({ id: "COMMENT-1002", taskId: "TASK-1002" });
  });
});

async function startTestHttpServer(): Promise<{ app: Express; baseUrl: string }> {
  const app = createHttpApp(createTestMcpServer);
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);

  const address = server.address() as AddressInfo;
  return { app, baseUrl: `http://127.0.0.1:${address.port}` };
}

function createTestMcpServer() {
  return createCloudAlmMcpServer({
    client: new MockCloudAlmClient(),
    policyGuard: new CloudAlmPolicyGuard(config),
    auditLogger: new MemoryAuditLogger()
  });
}

async function createHttpMcpClient(baseUrl: string): Promise<Client> {
  const client = new Client({ name: "http-transport-test-client", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));

  await client.connect(transport);
  clients.push(client);

  return client;
}

async function callAddComment(baseUrl: string): Promise<unknown> {
  const client = await createHttpMcpClient(baseUrl);
  const result = await client.callTool({
    name: "alm_add_comment",
    arguments: { taskId: "TASK-1002", text: "Concurrent mock comment." }
  });

  return parseTextResult(result);
}

function parseTextResult(result: unknown): unknown {
  if (
    typeof result !== "object" ||
    result === null ||
    !("content" in result) ||
    !Array.isArray(result.content) ||
    typeof result.content[0]?.text !== "string"
  ) {
    throw new Error("Expected text content result.");
  }

  return JSON.parse(result.content[0].text);
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
