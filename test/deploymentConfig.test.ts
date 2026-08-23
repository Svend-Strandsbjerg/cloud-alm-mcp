import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = readFileSync(new URL("../manifest.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  main: string;
  scripts: Record<string, string>;
  engines: Record<string, string>;
};

describe("Cloud Foundry deployment configuration", () => {
  it("uses safe mock-mode defaults for the first BTP deployment", () => {
    expect(manifest).toContain("RUNTIME_MODE: mock");
    expect(manifest).toContain("MCP_TRANSPORT: http");
    expect(manifest).toContain("EXTERNAL_CALLS_ENABLED: false");
    expect(manifest).toContain("READ_CAPABILITY_ENABLED: true");
    expect(manifest).toContain("WRITE_CAPABILITY_ENABLED: false");
    expect(manifest).not.toContain("RUNTIME_MODE: destination");
  });

  it("configures a single Node.js Cloud Foundry app with HTTP health checks", () => {
    expect(manifest).toContain("name: cloud-alm-mcp");
    expect(manifest).toContain("instances: 1");
    expect(manifest).toContain("nodejs_buildpack");
    expect(manifest).toContain("command: npm start");
    expect(manifest).toContain("health-check-type: http");
    expect(manifest).toContain("health-check-http-endpoint: /health");
    expect(manifest).not.toContain("routes:");
    expect(manifest).not.toContain("services:");
  });

  it("builds TypeScript output before the dist startup target is used", () => {
    expect(packageJson.main).toBe("dist/src/index.js");
    expect(packageJson.scripts.build).toBe("tsc -p tsconfig.json");
    expect(packageJson.scripts.postinstall).toBe("npm run build");
    expect(packageJson.scripts.start).toBe("node dist/src/index.js");
    expect(packageJson.engines.node).toBe("22.x || 24.x");
  });
});
