import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuditLogger } from "../audit/auditLogger.js";
import type { CloudAlmClient } from "../cloudAlm/cloudAlmClient.js";
import type { CloudAlmOperationName } from "../cloudAlm/cloudAlmTypes.js";
import {
  CloudAlmOperationNotSupportedError,
  CloudAlmTaskNotFoundError,
  CloudAlmValidationError
} from "../cloudAlm/cloudAlmErrors.js";
import { CloudAlmPolicyGuard } from "../policy/cloudAlmPolicyGuard.js";

const getTaskInputSchema = z
  .object({
    taskId: z.string().min(1)
  })
  .strict();

const addCommentInputSchema = z
  .object({
    taskId: z.string().min(1),
    text: z.string().min(1)
  })
  .strict();

const updateTaskInputSchema = z
  .object({
    taskId: z.string().min(1),
    title: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    priority: z.string().min(1).optional()
  })
  .strict();

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
      inputSchema: getTaskInputSchema
    },
    (input) =>
      toMcpToolResult(async () => {
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
      })
  );

  server.registerTool(
    "alm_get_comments",
    {
      title: "Get Cloud ALM task comments",
      description: "Return comments for one Cloud ALM task from the configured server-side scope.",
      inputSchema: getTaskInputSchema
    },
    (input) =>
      toMcpToolResult(async () => {
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
      })
  );

  server.registerTool(
    "alm_add_comment",
    {
      title: "Add Cloud ALM task comment",
      description: "Add a comment to one Cloud ALM task in the configured server-side scope.",
      inputSchema: addCommentInputSchema
    },
    (input) =>
      toMcpToolResult(async () => {
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
      })
  );

  server.registerTool(
    "alm_update_task",
    {
      title: "Update Cloud ALM task",
      description: "Update basic fields on one Cloud ALM task in the configured server-side scope.",
      inputSchema: updateTaskInputSchema
    },
    (input) =>
      toMcpToolResult(async () => {
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
      })
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

async function toMcpToolResult(createResult: () => Promise<McpTextResult>): Promise<McpTextResult> {
  try {
    return await createResult();
  } catch (error) {
    return errorResult(formatSafeToolError(error));
  }
}

export interface SafeToolError {
  code: string;
  message: string;
}

export function formatSafeToolError(error: unknown): SafeToolError {
  if (error instanceof CloudAlmTaskNotFoundError) {
    return { code: "TASK_NOT_FOUND", message: error.message };
  }

  if (error instanceof CloudAlmValidationError) {
    return { code: "VALIDATION_ERROR", message: error.message };
  }

  if (error instanceof CloudAlmOperationNotSupportedError) {
    return { code: "OPERATION_NOT_SUPPORTED", message: error.message };
  }

  if (error instanceof Error && isPolicyErrorMessage(error.message)) {
    return { code: "POLICY_DENIED", message: error.message };
  }

  return { code: "INTERNAL_ERROR", message: "Cloud ALM tool execution failed." };
}

function isPolicyErrorMessage(message: string): boolean {
  return (
    message.includes("capability is disabled") ||
    message.includes("Operation is not allowed") ||
    message.includes("Unknown Cloud ALM operation") ||
    message.includes("Agent-supplied scope is not allowed") ||
    message.includes("Destination runtime requires") ||
    message.includes("Exactly one server-side destination")
  );
}

export interface McpTextResult {
  [key: string]: unknown;
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

function textResult(payload: unknown): McpTextResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function errorResult(error: SafeToolError): McpTextResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ error }, null, 2)
      }
    ]
  };
}
