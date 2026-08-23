import type { RuntimeConfig } from "../config/runtimeConfig.js";
import type { CloudAlmCapability, CloudAlmOperationName } from "../cloudAlm/cloudAlmTypes.js";

const operationCapabilities: Record<CloudAlmOperationName, CloudAlmCapability> = {
  alm_get_task: "read",
  alm_get_comments: "read",
  alm_add_comment: "write",
  alm_update_task: "write"
};

export interface PolicyRequest {
  operationName: string;
  input?: Record<string, unknown>;
}

export class CloudAlmPolicyGuard {
  constructor(private readonly config: RuntimeConfig) {}

  assertAllowed(request: PolicyRequest): CloudAlmOperationName {
    this.assertConfigUnambiguous();
    this.assertNoAgentSelectedScope(request.input);

    if (isRejectedOperationShape(request.operationName)) {
      throw new Error(`Operation is not allowed: ${request.operationName}`);
    }

    if (!isAllowedOperation(request.operationName)) {
      throw new Error(`Unknown Cloud ALM operation: ${request.operationName}`);
    }

    const capability = operationCapabilities[request.operationName];
    if (capability === "read" && !this.config.readCapabilityEnabled) {
      throw new Error("Read capability is disabled.");
    }

    if (capability === "write" && !this.config.writeCapabilityEnabled) {
      throw new Error("Write capability is disabled.");
    }

    return request.operationName;
  }

  private assertConfigUnambiguous(): void {
    if (this.config.runtimeMode === "destination" && !this.config.externalCallsEnabled) {
      throw new Error("Destination runtime requires EXTERNAL_CALLS_ENABLED=true.");
    }

    if (this.config.runtimeMode === "destination" && this.config.allowedDestinations.length !== 1) {
      throw new Error("Exactly one server-side destination must be configured for destination runtime.");
    }
  }

  private assertNoAgentSelectedScope(input: Record<string, unknown> | undefined): void {
    if (!input) {
      return;
    }

    const blockedKeys = ["destination", "destinationName", "customer", "customerId", "tenant", "tenantId"];
    const presentBlockedKey = blockedKeys.find((key) => Object.hasOwn(input, key));
    if (presentBlockedKey) {
      throw new Error(`Agent-supplied scope is not allowed: ${presentBlockedKey}`);
    }
  }
}

function isAllowedOperation(operationName: string): operationName is CloudAlmOperationName {
  return Object.hasOwn(operationCapabilities, operationName);
}

function isRejectedOperationShape(operationName: string): boolean {
  const normalized = operationName.toLowerCase();
  return normalized.includes("delete") || normalized.includes("bulk");
}
