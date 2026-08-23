import { describe, expect, it } from "vitest";
import { MemoryAuditLogger } from "../src/audit/auditLogger.js";
import type { RuntimeConfig } from "../src/config/runtimeConfig.js";
import { executeAuditedClientCall } from "../src/mcp/server.js";
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

describe("executeAuditedClientCall", () => {
  it("returns successful client results and records the allowed audit event", async () => {
    const auditLogger = new MemoryAuditLogger();

    await expect(
      executeAuditedClientCall({
        operationName: "alm_get_task",
        input: { taskId: "TASK-1" },
        resourceType: "task",
        resourceId: "TASK-1",
        policyGuard: new CloudAlmPolicyGuard(config),
        auditLogger,
        call: async () => ({ id: "TASK-1" })
      })
    ).resolves.toEqual({ id: "TASK-1" });

    expect(auditLogger.events).toEqual([
      expect.objectContaining({
        operationName: "alm_get_task",
        outcome: "allowed",
        resourceType: "task",
        resourceId: "TASK-1"
      })
    ]);
  });

  it("records failed audit events and rethrows the original client error", async () => {
    const auditLogger = new MemoryAuditLogger();
    const originalError = new Error("client failed");

    await expect(
      executeAuditedClientCall({
        operationName: "alm_update_task",
        input: { taskId: "TASK-1", status: "DONE" },
        resourceType: "task",
        resourceId: "TASK-1",
        policyGuard: new CloudAlmPolicyGuard(config),
        auditLogger,
        call: async () => {
          throw originalError;
        }
      })
    ).rejects.toBe(originalError);

    expect(auditLogger.events).toEqual([
      expect.objectContaining({
        operationName: "alm_update_task",
        outcome: "allowed",
        resourceType: "task",
        resourceId: "TASK-1"
      }),
      expect.objectContaining({
        operationName: "alm_update_task",
        outcome: "failed",
        resourceType: "task",
        resourceId: "TASK-1"
      })
    ]);
  });
});
