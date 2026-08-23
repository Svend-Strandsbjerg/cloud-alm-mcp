import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryAuditLogger } from "../src/audit/auditLogger.js";
import type { CloudAlmClient } from "../src/cloudAlm/cloudAlmClient.js";
import type { CloudAlmTask } from "../src/cloudAlm/cloudAlmTypes.js";
import { MockCloudAlmClient } from "../src/cloudAlm/mockCloudAlmClient.js";
import type { RuntimeConfig } from "../src/config/runtimeConfig.js";
import { createCloudAlmMcpServer } from "../src/mcp/server.js";
import { CloudAlmPolicyGuard } from "../src/policy/cloudAlmPolicyGuard.js";

const baseConfig: RuntimeConfig = {
  runtimeMode: "mock",
  mcpTransport: "http",
  port: 3000,
  readCapabilityEnabled: true,
  writeCapabilityEnabled: true,
  allowedDestinations: ["cloud-alm-dev"],
  externalCallsEnabled: false
};

const openSessions: Array<{ client: Client; server: McpServer }> = [];

afterEach(async () => {
  while (openSessions.length > 0) {
    const session = openSessions.pop();
    if (!session) {
      continue;
    }

    await session.client.close();
    await session.server.close();
  }
});

describe("Cloud ALM MCP tools", () => {
  it("exposes only the four supported Cloud ALM task tools", async () => {
    const { mcpClient } = await createMcpTestClient();

    const tools = await mcpClient.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "alm_add_comment",
      "alm_get_comments",
      "alm_get_task",
      "alm_update_task"
    ]);
    expect(tools.tools.map((tool) => tool.name).join(" ")).not.toMatch(/delete|bulk|passthrough/i);
  });

  it("returns a task for alm_get_task", async () => {
    const { mcpClient } = await createMcpTestClient();

    const result = await mcpClient.callTool({ name: "alm_get_task", arguments: { taskId: "TASK-1001" } });

    expect(result.isError).toBeUndefined();
    expect(parseTextResult(result)).toEqual({
      id: "TASK-1001",
      title: "Mock Cloud ALM task",
      status: "OPEN",
      priority: "MEDIUM"
    });
  });

  it("surfaces unknown task failures cleanly and records failed audit events", async () => {
    const { mcpClient, auditLogger } = await createMcpTestClient();

    const result = await mcpClient.callTool({ name: "alm_get_task", arguments: { taskId: "TASK-404" } });

    expect(result.isError).toBe(true);
    expect(parseTextResult(result)).toEqual({
      error: {
        code: "TASK_NOT_FOUND",
        message: "Cloud ALM task not found: TASK-404"
      }
    });
    expect(auditLogger.events).toEqual([
      expect.objectContaining({ operationName: "alm_get_task", outcome: "allowed", resourceId: "TASK-404" }),
      expect.objectContaining({ operationName: "alm_get_task", outcome: "failed", resourceId: "TASK-404" })
    ]);
  });

  it("does not expose unknown client error internals to MCP callers", async () => {
    const { mcpClient } = await createMcpTestClient({ cloudAlmClient: new ThrowingCloudAlmClient() });

    const result = await mcpClient.callTool({ name: "alm_get_task", arguments: { taskId: "TASK-1001" } });

    expect(result.isError).toBe(true);
    expect(parseTextResult(result)).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Cloud ALM tool execution failed."
      }
    });
    expect(getTextResult(result)).not.toMatch(/secret|stack|token/i);
  });


  it("returns comments for a known task and an empty list for a known task without comments", async () => {
    const { mcpClient } = await createMcpTestClient();

    const withComments = await mcpClient.callTool({ name: "alm_get_comments", arguments: { taskId: "TASK-1001" } });
    const withoutComments = await mcpClient.callTool({ name: "alm_get_comments", arguments: { taskId: "TASK-1002" } });

    expect(parseTextResult(withComments)).toEqual([
      {
        id: "COMMENT-1001",
        taskId: "TASK-1001",
        author: "mock-user",
        text: "Mock comment from local skeleton mode.",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    expect(parseTextResult(withoutComments)).toEqual([]);
  });

  it("adds one comment when write capability is enabled", async () => {
    const { mcpClient } = await createMcpTestClient();

    const result = await mcpClient.callTool({
      name: "alm_add_comment",
      arguments: { taskId: "TASK-1002", text: "MCP-created mock comment." }
    });

    expect(result.isError).toBeUndefined();
    expect(parseTextResult(result)).toEqual({
      id: "COMMENT-1002",
      taskId: "TASK-1002",
      author: "mock-user",
      text: "MCP-created mock comment.",
      createdAt: "2026-01-01T00:01:00.000Z"
    });
  });

  it("rejects alm_add_comment when write capability is disabled", async () => {
    const countingClient = new CountingCloudAlmClient();
    const { mcpClient, auditLogger } = await createMcpTestClient({
      config: { ...baseConfig, writeCapabilityEnabled: false },
      cloudAlmClient: countingClient
    });

    const result = await mcpClient.callTool({
      name: "alm_add_comment",
      arguments: { taskId: "TASK-1001", text: "Blocked write." }
    });

    expect(result.isError).toBe(true);
    expect(parseTextResult(result)).toEqual({
      error: {
        code: "POLICY_DENIED",
        message: "Write capability is disabled."
      }
    });
    expect(auditLogger.events).toEqual([
      expect.objectContaining({ operationName: "alm_add_comment", outcome: "rejected", resourceId: "TASK-1001" })
    ]);
    expect(countingClient.callCount).toBe(0);
  });

  it("rejects empty comment text cleanly", async () => {
    const { mcpClient } = await createMcpTestClient();

    const result = await mcpClient.callTool({ name: "alm_add_comment", arguments: { taskId: "TASK-1001", text: "" } });

    expect(result.isError).toBe(true);
    expect(getTextResult(result)).toMatch(/Invalid arguments/);
  });

  it("updates a task when write capability is enabled", async () => {
    const { mcpClient } = await createMcpTestClient();

    const result = await mcpClient.callTool({
      name: "alm_update_task",
      arguments: { taskId: "TASK-1001", status: "DONE", priority: "HIGH" }
    });

    expect(result.isError).toBeUndefined();
    expect(parseTextResult(result)).toMatchObject({
      id: "TASK-1001",
      status: "DONE",
      priority: "HIGH"
    });
  });

  it("rejects alm_update_task when write capability is disabled", async () => {
    const countingClient = new CountingCloudAlmClient();
    const { mcpClient, auditLogger } = await createMcpTestClient({
      config: { ...baseConfig, writeCapabilityEnabled: false },
      cloudAlmClient: countingClient
    });

    const result = await mcpClient.callTool({
      name: "alm_update_task",
      arguments: { taskId: "TASK-1001", status: "DONE" }
    });

    expect(result.isError).toBe(true);
    expect(parseTextResult(result)).toEqual({
      error: {
        code: "POLICY_DENIED",
        message: "Write capability is disabled."
      }
    });
    expect(auditLogger.events).toEqual([
      expect.objectContaining({ operationName: "alm_update_task", outcome: "rejected", resourceId: "TASK-1001" })
    ]);
    expect(countingClient.callCount).toBe(0);
  });

  it("rejects empty and no-op updates cleanly", async () => {
    const { mcpClient } = await createMcpTestClient();

    const emptyUpdate = await mcpClient.callTool({ name: "alm_update_task", arguments: { taskId: "TASK-1001" } });
    const noOpUpdate = await mcpClient.callTool({
      name: "alm_update_task",
      arguments: { taskId: "TASK-1001", status: "OPEN" }
    });

    expect(emptyUpdate.isError).toBe(true);
    expect(parseTextResult(emptyUpdate)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "At least one mock task update field must be provided."
      }
    });
    expect(noOpUpdate.isError).toBe(true);
    expect(parseTextResult(noOpUpdate)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Mock task update must change at least one field."
      }
    });
  });

  it("rejects agent-supplied destination, customer, or tenant fields before client calls", async () => {
    const countingClient = new CountingCloudAlmClient();
    const { mcpClient } = await createMcpTestClient({ cloudAlmClient: countingClient });

    const destinationResult = await mcpClient.callTool({
      name: "alm_get_task",
      arguments: { taskId: "TASK-1001", destinationName: "other" }
    });
    const customerResult = await mcpClient.callTool({
      name: "alm_get_task",
      arguments: { taskId: "TASK-1001", customerId: "customer-a" }
    });
    const tenantResult = await mcpClient.callTool({
      name: "alm_get_task",
      arguments: { taskId: "TASK-1001", tenantId: "tenant-a" }
    });

    expect(destinationResult.isError).toBe(true);
    expect(customerResult.isError).toBe(true);
    expect(tenantResult.isError).toBe(true);
    expect(getTextResult(destinationResult)).toMatch(/Invalid arguments/);
    expect(getTextResult(customerResult)).toMatch(/Invalid arguments/);
    expect(getTextResult(tenantResult)).toMatch(/Invalid arguments/);
    expect(countingClient.callCount).toBe(0);
  });
});

interface CreateMcpTestClientOptions {
  config?: RuntimeConfig;
  cloudAlmClient?: CloudAlmClient;
}

async function createMcpTestClient(options: CreateMcpTestClientOptions = {}) {
  const auditLogger = new MemoryAuditLogger();
  const server = createCloudAlmMcpServer({
    client: options.cloudAlmClient ?? new MockCloudAlmClient(),
    policyGuard: new CloudAlmPolicyGuard(options.config ?? baseConfig),
    auditLogger
  });
  const mcpClient = new Client({ name: "cloud-alm-mcp-test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  openSessions.push({ client: mcpClient, server });

  return { mcpClient, auditLogger };
}

function parseTextResult(result: unknown): unknown {
  return JSON.parse(getTextResult(result));
}

function getTextResult(result: unknown): string {
  if (!isTextContentResult(result)) {
    throw new Error("Expected text content result.");
  }

  const text = result.content[0]?.text;
  if (!text) {
    throw new Error("Expected text content result.");
  }

  return text;
}

function isTextContentResult(result: unknown): result is { content: Array<{ type: string; text?: string }> } {
  return (
    typeof result === "object" &&
    result !== null &&
    "content" in result &&
    Array.isArray(result.content) &&
    result.content.every((item) => typeof item === "object" && item !== null && "type" in item)
  );
}

class CountingCloudAlmClient extends MockCloudAlmClient {
  callCount = 0;

  override async getTask(taskId: string) {
    this.callCount += 1;
    return super.getTask(taskId);
  }

  override async addComment(input: Parameters<MockCloudAlmClient["addComment"]>[0]) {
    this.callCount += 1;
    return super.addComment(input);
  }

  override async updateTask(input: Parameters<MockCloudAlmClient["updateTask"]>[0]) {
    this.callCount += 1;
    return super.updateTask(input);
  }
}

class ThrowingCloudAlmClient extends MockCloudAlmClient {
  override async getTask(_taskId: string): Promise<CloudAlmTask> {
    throw new Error("secret token stack detail");
  }
}
