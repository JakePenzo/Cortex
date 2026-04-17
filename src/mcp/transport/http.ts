import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import type { BackendAdapter } from "../../backends/base.js";
import type { CortexConfig } from "../../config/schema.js";
import { Dispatcher } from "../../router/dispatcher.js";
import { registerTools } from "../tools/registry.js";

export async function startHttpMcpServer(
  backends: BackendAdapter[],
  config: CortexConfig,
  port: number,
): Promise<void> {
  const dispatcher = new Dispatcher(backends, config.routing.cache_ttl_seconds, config.routing.max_results);

  // Stateful transport — one session per client connection
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const mcpServer = new McpServer({ name: "cortex", version: "0.1.0" });
  registerTools(mcpServer, backends, dispatcher);
  await mcpServer.connect(transport);

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ ok: true, version: "0.1.0" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/mcp") {
        // Delegate to MCP transport handler
        const res = await transport.handleRequest(req);
        return res ?? new Response("Not Found", { status: 404 });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.error(`[cortex] MCP HTTP server listening on :${port}`);
}
