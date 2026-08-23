# Cloud ALM MCP

Node.js and TypeScript skeleton for a SAP Cloud ALM Model Context Protocol server.

This repository is currently mock-first. It can install, build, test, and start without SAP Cloud ALM credentials, BTP Destination Service configuration, or OAuth setup.

## Target Architecture

- Runtime: Node.js on SAP BTP Cloud Foundry.
- Production MCP transport: MCP Streamable HTTP via the official MCP TypeScript SDK.
- STR-158 uses stateless Streamable HTTP for the POC by setting no MCP session ID generator.
- Local fallback transport: stdio, intended only for local development.
- Future Cloud ALM access path: SAP BTP Destination Service.
- Future authentication model: OAuth2 Client Credentials through a configured destination.

Real SAP Cloud ALM connectivity is intentionally not included in STR-158.

Session and state requirements must be revisited before production agent usage if later tool flows require persistent MCP session state. STR-158 intentionally does not introduce a session store.

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

The remote MCP endpoint is stateless and POST-only. `GET`, `DELETE`, and other unsupported methods on `/mcp` return `405 Method Not Allowed` with `Allow: POST`; GET SSE and MCP session termination are intentionally not implemented. JSON request bodies are limited to `64kb`.

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

## Mock Task Client

Mock mode uses deterministic in-memory task and comment data for local development and tests. It supports only the current mock contract fields: task `id`, `title`, `status`, `priority`, and comment `id`, `taskId`, `author`, `text`, `createdAt`.

The mock client returns known tasks, rejects unknown task IDs, appends one comment at a time with deterministic IDs, and updates only explicitly allowlisted mock task fields. These fields are not claimed to be official SAP `CALM_TKM` payload fields. Real Cloud ALM endpoints, payload schemas, scopes, pagination names, and update semantics remain unverified and deferred to the real integration work.

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

Audit events already reserve optional fields for future traceability: actor, customer context, resource type/id, and correlation ID. The skeleton does not invent real actor or customer values and does not log request payloads, tokens, authorization headers, client IDs, client secrets, or sensitive response bodies.
