import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuditLogger } from "../audit/auditLogger.js";
import type { CloudAlmClient } from "../cloudAlm/cloudAlmClient.js";
import type { CloudAlmOperationName } from "../cloudAlm/cloudAlmTypes.js";
import { CloudAlmPolicyGuard } from "../policy/cloudAlmPolicyGuard.js";

export interface CloudAlmMcpServerOptions {
  client: CloudAlmClient;
  policyGuard: CloudAlmPolicyGuard;
  auditLogger: AuditLogger;
}

export function createCloudAlmMcpServer(options: CloudAlmMcpServerOptions): McpServer {
  const server = new McpServer({
    name: "cloud-alm-mcp",
    version: "0.1.0"
  });

  server.registerTool(
    "alm_get_task",
    {
      title: "Get Cloud ALM task",
      description: "Return one Cloud ALM task from the configured server-side scope.",
      inputSchema: {
        taskId: z.string().min(1)
      }
    },
    async (input) => {
      const task = await executeAuditedClientCall({
        operationName: "alm_get_task",
        input,
        resourceType: "task",
        resourceId: input.taskId,
        policyGuard: options.policyGuard,
        auditLogger: options.auditLogger,
        call: () => options.client.getTask(input.taskId)
      });
      return textResult(task);
    }
  );

  server.registerTool(
    "alm_get_comments",
    {
      title: "Get Cloud ALM task comments",
      description: "Return comments for one Cloud ALM task from the configured server-side scope.",
      inputSchema: {
        taskId: z.string().min(1)
      }
    },
    async (input) => {
      const comments = await executeAuditedClientCall({
        operationName: "alm_get_comments",
        input,
        resourceType: "task",
        resourceId: input.taskId,
        policyGuard: options.policyGuard,
        auditLogger: options.auditLogger,
        call: () => options.client.getComments(input.taskId)
      });
      return textResult(comments);
    }
  );

  server.registerTool(
    "alm_add_comment",
    {
      title: "Add Cloud ALM task comment",
      description: "Add a comment to one Cloud ALM task in the configured server-side scope.",
      inputSchema: {
        taskId: z.string().min(1),
        text: z.string().min(1)
      }
    },
    async (input) => {
      const comment = await executeAuditedClientCall({
        operationName: "alm_add_comment",
        input,
        resourceType: "task",
        resourceId: input.taskId,
        policyGuard: options.policyGuard,
        auditLogger: options.auditLogger,
        call: () => options.client.addComment(input)
      });
      return textResult(comment);
    }
  );

  server.registerTool(
    "alm_update_task",
    {
      title: "Update Cloud ALM task",
      description: "Update basic fields on one Cloud ALM task in the configured server-side scope.",
      inputSchema: {
        taskId: z.string().min(1),
        title: z.string().min(1).optional(),
        status: z.string().min(1).optional(),
        priority: z.string().min(1).optional()
      }
    },
    async (input) => {
      const task = await executeAuditedClientCall({
        operationName: "alm_update_task",
        input,
        resourceType: "task",
        resourceId: input.taskId,
        policyGuard: options.policyGuard,
        auditLogger: options.auditLogger,
        call: () => options.client.updateTask(input)
      });
      return textResult(task);
    }
  );

  return server;
}

export interface AuditedClientCallOptions<T> {
  operationName: CloudAlmOperationName;
  input: Record<string, unknown>;
  resourceType?: string;
  resourceId?: string;
  policyGuard: CloudAlmPolicyGuard;
  auditLogger: AuditLogger;
  call(): Promise<T>;
}

export async function executeAuditedClientCall<T>(options: AuditedClientCallOptions<T>): Promise<T> {
  const operationName = options.policyGuard.assertAllowed({
    operationName: options.operationName,
    input: options.input
  });
  const auditContext = {
    operationName,
    resourceType: options.resourceType,
    resourceId: options.resourceId
  };

  options.auditLogger.record({ ...auditContext, outcome: "allowed", timestamp: new Date().toISOString() });

  try {
    return await options.call();
  } catch (error) {
    options.auditLogger.record({ ...auditContext, outcome: "failed", timestamp: new Date().toISOString() });
    throw error;
  }
}

function textResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}
