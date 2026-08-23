# Cloud ALM MCP

Node.js and TypeScript skeleton for a SAP Cloud ALM Model Context Protocol server.

This repository is currently mock-first. It can install, build, test, and start without SAP Cloud ALM credentials, BTP Destination Service configuration, or OAuth setup.

## Target Architecture

- Runtime: Node.js on SAP BTP Cloud Foundry.
- Production MCP transport: MCP Streamable HTTP via the official MCP TypeScript SDK.
- Local fallback transport: stdio, intended only for local development.
- Future Cloud ALM access path: SAP BTP Destination Service.
- Future authentication model: OAuth2 Client Credentials through a configured destination.

Real SAP Cloud ALM connectivity is intentionally not included in STR-158.

## Local Development

```bash
npm install
npm run build
npm test
npm start
```

By default, `npm start` runs mock mode over HTTP and exposes:

- MCP endpoint: `POST /mcp`
- Health endpoint: `GET /health`

Example:

```bash
curl http://localhost:3000/health
```

Use `.env.example` as the list of supported placeholders. Do not add real Cloud ALM secrets to local files committed to git.

## Configuration

Core environment variables:

- `RUNTIME_MODE=mock|destination`
- `MCP_TRANSPORT=http|stdio`
- `PORT=3000`
- `READ_CAPABILITY_ENABLED=true|false`
- `WRITE_CAPABILITY_ENABLED=true|false`
- `ALLOWED_DESTINATIONS=cloud-alm-dev`
- `EXTERNAL_CALLS_ENABLED=false|true`

Local defaults are intentionally safe: mock runtime, HTTP transport, read enabled, write disabled, and external calls disabled.

Destination mode exists only as a placeholder in this skeleton. It fails closed until the BTP Destination Service lookup and OAuth token flow are implemented in later tasks.

## Security Boundary

The Policy Guard is code-enforced before Cloud ALM client calls. It validates:

- allowed operation names only,
- read/write capability separation,
- delete operation rejection,
- bulk operation rejection,
- unknown operation rejection,
- no agent-supplied destination or customer selection,
- fail-closed behavior for ambiguous configuration.

This is deliberately not prompt-only enforcement. Customer isolation and durable audit logging are left as future architecture work, with module boundaries already present.
