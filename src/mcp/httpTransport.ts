import { randomUUID } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerHealthRoute } from "../health/healthServer.js";

export const MCP_JSON_BODY_LIMIT = "64kb";
const allowedMcpMethods = "POST";

export type McpServerFactory = () => McpServer;

export interface HttpTransportHandle {
  app: Express;
  close(): Promise<void>;
}

export async function startHttpTransport(createServer: McpServerFactory, port: number): Promise<HttpTransportHandle> {
  const app = createHttpApp(createServer);
  const listener = app.listen(port, () => {
    console.info(`Cloud ALM MCP HTTP server listening on port ${port}`);
  });
  let closing = false;

  return {
    app,
    close: async () => {
      if (closing) {
        return;
      }

      closing = true;
      await new Promise<void>((resolve, reject) => {
        listener.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}

export function createHttpApp(createServer: McpServerFactory): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(requestCorrelationMiddleware);
  app.use(express.json({ limit: MCP_JSON_BODY_LIMIT, type: "application/json" }));
  registerHealthRoute(app);

  app.post("/mcp", async (req, res) => {
    if (!req.is("application/json")) {
      writeHttpError(res, 415, "Unsupported Media Type");
      return;
    }

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      // Official SDK stateless examples and source require a fresh transport per request.
      sessionIdGenerator: undefined
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("mcp-http-error", JSON.stringify({ requestId: res.locals.requestId, errorName: safeErrorName(error) }));
      if (!res.headersSent) {
        writeMcpJsonRpcError(res, 500, -32603, "Internal server error");
      }
    } finally {
      await cleanupMcpRequest(server, transport);
    }
  });
  app.all("/mcp", (_req, res) => {
    res.setHeader("Allow", allowedMcpMethods);
    writeHttpError(res, 405, "Method Not Allowed");
  });
  app.use(httpErrorMiddleware);

  return app;
}

async function cleanupMcpRequest(server: McpServer, transport: StreamableHTTPServerTransport): Promise<void> {
  await Promise.allSettled([transport.close(), server.close()]);
}

function requestCorrelationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = getRequestId(req);
  const start = Date.now();

  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    console.info(
      "http-request",
      JSON.stringify({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start
      })
    );
  });
  next();
}

function getRequestId(req: Request): string {
  const header = req.header("x-request-id");
  if (header && header.length <= 128) {
    return header;
  }

  return randomUUID();
}

function httpErrorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }

  if (isHttpError(error, "entity.too.large")) {
    writeHttpError(res, 413, "Payload Too Large");
    return;
  }

  if (error instanceof SyntaxError) {
    writeHttpError(res, 400, "Invalid JSON");
    return;
  }

  writeHttpError(res, 500, "Internal Server Error");
}

function writeHttpError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: { message } });
}

function writeMcpJsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({
    jsonrpc: "2.0",
    error: { code, message },
    id: null
  });
}

function isHttpError(error: unknown, type: string): boolean {
  return typeof error === "object" && error !== null && "type" in error && error.type === type;
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
