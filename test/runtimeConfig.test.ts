import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../src/config/runtimeConfig.js";

describe("loadRuntimeConfig", () => {
  it("uses safe local defaults", () => {
    expect(loadRuntimeConfig({})).toEqual({
      runtimeMode: "mock",
      mcpTransport: "http",
      port: 3000,
      readCapabilityEnabled: true,
      writeCapabilityEnabled: false,
      allowedDestinations: ["cloud-alm-dev"],
      externalCallsEnabled: false
    });
  });

  it("parses explicit destination configuration", () => {
    expect(
      loadRuntimeConfig({
        RUNTIME_MODE: "destination",
        MCP_TRANSPORT: "stdio",
        PORT: "4000",
        READ_CAPABILITY_ENABLED: "false",
        WRITE_CAPABILITY_ENABLED: "true",
        ALLOWED_DESTINATIONS: "dest-a",
        EXTERNAL_CALLS_ENABLED: "true"
      })
    ).toMatchObject({
      runtimeMode: "destination",
      mcpTransport: "stdio",
      port: 4000,
      readCapabilityEnabled: false,
      writeCapabilityEnabled: true,
      allowedDestinations: ["dest-a"],
      externalCallsEnabled: true
    });
  });

  it("rejects ambiguous booleans", () => {
    expect(() => loadRuntimeConfig({ WRITE_CAPABILITY_ENABLED: "yes" })).toThrow(/true or false/);
  });
});
