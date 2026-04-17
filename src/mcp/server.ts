import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { BackendAdapter } from "../backends/base.js";
import { Dispatcher } from "../router/dispatcher.js";
import type { CortexConfig } from "../config/schema.js";
import { registerTools } from "./tools/registry.js";

export async function startMcpServer(backends: BackendAdapter[], config: CortexConfig): Promise<void> {
  const dispatcher = new Dispatcher(backends, config.routing.cache_ttl_seconds, config.routing.max_results);
  const server = new McpServer({ name: "cortex", version: "0.1.0" });
  registerTools(server, backends, dispatcher);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
