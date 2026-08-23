import type { Express } from "express";
import type { RuntimeConfig } from "../config/runtimeConfig.js";

export interface HealthStatus {
  status: "ok";
  runtimeMode: RuntimeConfig["runtimeMode"];
  transport: RuntimeConfig["mcpTransport"];
}

export function createHealthStatus(config: RuntimeConfig): HealthStatus {
  return {
    status: "ok",
    runtimeMode: config.runtimeMode,
    transport: config.mcpTransport
  };
}

export function registerHealthRoute(app: Express): void {
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
}
