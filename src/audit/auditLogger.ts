import type { CloudAlmOperationName } from "../cloudAlm/cloudAlmTypes.js";

export interface AuditEvent {
  operationName: CloudAlmOperationName;
  outcome: "allowed" | "rejected" | "failed";
  timestamp: string;
  actorId?: string;
  customerContext?: string;
  resourceType?: string;
  resourceId?: string;
  correlationId?: string;
}

export interface AuditLogger {
  record(event: AuditEvent): void;
}

export class ConsoleAuditLogger implements AuditLogger {
  record(event: AuditEvent): void {
    console.info("cloud-alm-audit", JSON.stringify(event));
  }
}

export class MemoryAuditLogger implements AuditLogger {
  readonly events: AuditEvent[] = [];

  record(event: AuditEvent): void {
    this.events.push(event);
  }
}
