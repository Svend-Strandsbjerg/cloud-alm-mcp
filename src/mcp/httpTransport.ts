import express, { type Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerHealthRoute } from "../health/healthServer.js";

export interface HttpTransportHandle {
  app: Express;
  close(): Promise<void>;
}

export async function startHttpTransport(server: McpServer, port: number): Promise<HttpTransportHandle> {
  const app = await createHttpApp(server);
  const listener = app.listen(port, () => {
    console.info(`Cloud ALM MCP HTTP server listening on port ${port}`);
  });

  return {
    app,
    close: () =>
      new Promise((resolve, reject) => {
        listener.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
}

export async function createHttpApp(server: McpServer): Promise<Express> {
  const app = express();
  const transport = new StreamableHTTPServerTransport({
    // Intentional STR-158 POC choice: run stateless until production agent flows prove session state is required.
    sessionIdGenerator: undefined
  });

  await server.connect(transport);

  app.use(express.json());
  registerHealthRoute(app);

  app.post("/mcp", async (req, res) => {
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}
