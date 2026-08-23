export type RuntimeMode = "mock" | "destination";
export type McpTransport = "http" | "stdio";

export interface RuntimeConfig {
  runtimeMode: RuntimeMode;
  mcpTransport: McpTransport;
  port: number;
  readCapabilityEnabled: boolean;
  writeCapabilityEnabled: boolean;
  allowedDestinations: string[];
  externalCallsEnabled: boolean;
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const runtimeMode = parseEnum(env.RUNTIME_MODE, ["mock", "destination"], "mock", "RUNTIME_MODE");
  const mcpTransport = parseEnum(env.MCP_TRANSPORT, ["http", "stdio"], "http", "MCP_TRANSPORT");
  const port = parsePort(env.PORT ?? "3000");
  const readCapabilityEnabled = parseBoolean(env.READ_CAPABILITY_ENABLED, true, "READ_CAPABILITY_ENABLED");
  const writeCapabilityEnabled = parseBoolean(env.WRITE_CAPABILITY_ENABLED, false, "WRITE_CAPABILITY_ENABLED");
  const externalCallsEnabled = parseBoolean(env.EXTERNAL_CALLS_ENABLED, false, "EXTERNAL_CALLS_ENABLED");
  const allowedDestinations = parseList(env.ALLOWED_DESTINATIONS ?? "cloud-alm-dev");

  return {
    runtimeMode,
    mcpTransport,
    port,
    readCapabilityEnabled,
    writeCapabilityEnabled,
    allowedDestinations,
    externalCallsEnabled
  };
}

function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, name: string): T {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  if (allowed.includes(value as T)) {
    return value as T;
  }

  throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
}

function parseBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be true or false`);
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
