import { describe, expect, it } from "vitest";
import { MemoryAuditLogger } from "../src/audit/auditLogger.js";

describe("AuditLogger", () => {
  it("accepts the future traceability contract without requiring real actor or customer values", () => {
    const logger = new MemoryAuditLogger();

    logger.record({
      operationName: "alm_update_task",
      outcome: "allowed",
      timestamp: "2026-01-01T00:00:00.000Z",
      actorId: "agent-placeholder",
      customerContext: "customer-context-placeholder",
      resourceType: "task",
      resourceId: "TASK-1",
      correlationId: "correlation-placeholder"
    });

    expect(logger.events).toEqual([
      expect.objectContaining({
        operationName: "alm_update_task",
        resourceType: "task",
        resourceId: "TASK-1",
        correlationId: "correlation-placeholder"
      })
    ]);
  });
});
