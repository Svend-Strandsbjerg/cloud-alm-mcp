import { describe, expect, it } from "vitest";
import type { RuntimeConfig } from "../src/config/runtimeConfig.js";
import { CloudAlmPolicyGuard } from "../src/policy/cloudAlmPolicyGuard.js";

const baseConfig: RuntimeConfig = {
  runtimeMode: "mock",
  mcpTransport: "http",
  port: 3000,
  readCapabilityEnabled: true,
  writeCapabilityEnabled: false,
  allowedDestinations: ["cloud-alm-dev"],
  externalCallsEnabled: false
};

describe("CloudAlmPolicyGuard", () => {
  it("allows configured read operations", () => {
    const guard = new CloudAlmPolicyGuard(baseConfig);
    expect(guard.assertAllowed({ operationName: "alm_get_task", input: { taskId: "TASK-1" } })).toBe("alm_get_task");
  });

  it("separates write capability from read capability", () => {
    const guard = new CloudAlmPolicyGuard(baseConfig);
    expect(() => guard.assertAllowed({ operationName: "alm_add_comment", input: { taskId: "TASK-1", text: "Hi" } })).toThrow(
      /Write capability is disabled/
    );
  });

  it("allows writes only when write capability is enabled", () => {
    const guard = new CloudAlmPolicyGuard({ ...baseConfig, writeCapabilityEnabled: true });
    expect(guard.assertAllowed({ operationName: "alm_update_task", input: { taskId: "TASK-1", status: "DONE" } })).toBe(
      "alm_update_task"
    );
  });

  it("rejects delete operations", () => {
    const guard = new CloudAlmPolicyGuard(baseConfig);
    expect(() => guard.assertAllowed({ operationName: "alm_delete_task" })).toThrow(/not allowed/);
  });

  it("rejects bulk operations", () => {
    const guard = new CloudAlmPolicyGuard(baseConfig);
    expect(() => guard.assertAllowed({ operationName: "alm_bulk_update_tasks" })).toThrow(/not allowed/);
  });

  it("rejects unknown operations", () => {
    const guard = new CloudAlmPolicyGuard(baseConfig);
    expect(() => guard.assertAllowed({ operationName: "alm_search_tasks" })).toThrow(/Unknown/);
  });

  it("rejects agent-supplied destination and customer scope", () => {
    const guard = new CloudAlmPolicyGuard(baseConfig);
    expect(() =>
      guard.assertAllowed({ operationName: "alm_get_task", input: { taskId: "TASK-1", destinationName: "other" } })
    ).toThrow(/Agent-supplied scope/);
    expect(() =>
      guard.assertAllowed({ operationName: "alm_get_task", input: { taskId: "TASK-1", customerId: "customer-a" } })
    ).toThrow(/Agent-supplied scope/);
  });

  it("fails closed when destination runtime has ambiguous destination config", () => {
    const guard = new CloudAlmPolicyGuard({
      ...baseConfig,
      runtimeMode: "destination",
      externalCallsEnabled: true,
      allowedDestinations: ["dest-a", "dest-b"]
    });
    expect(() => guard.assertAllowed({ operationName: "alm_get_task", input: { taskId: "TASK-1" } })).toThrow(/Exactly one/);
  });

  it("fails closed when destination runtime has external calls disabled", () => {
    const guard = new CloudAlmPolicyGuard({
      ...baseConfig,
      runtimeMode: "destination",
      allowedDestinations: ["dest-a"],
      externalCallsEnabled: false
    });
    expect(() => guard.assertAllowed({ operationName: "alm_get_task", input: { taskId: "TASK-1" } })).toThrow(
      /EXTERNAL_CALLS_ENABLED/
    );
  });
});
