import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BackendAdapter } from "../../backends/base.js";
import type { Dispatcher } from "../../router/dispatcher.js";
import { memoryAddSchema, createMemoryAddHandler } from "./memory-add.js";
import { memorySearchSchema, createMemorySearchHandler } from "./memory-search.js";
import { memoryListSchema, createMemoryListHandler } from "./memory-list.js";
import { memoryDeleteSchema, createMemoryDeleteHandler } from "./memory-delete.js";
import { cortexStatusSchema, createCortexStatusHandler, cortexBackendsSchema, createCortexBackendsHandler } from "./cortex-status.js";

export function registerTools(server: McpServer, backends: BackendAdapter[], dispatcher: Dispatcher): void {
  server.tool("memory_add", "Store a new memory. Cortex classifies and routes it to the appropriate backend(s).", memoryAddSchema.shape, createMemoryAddHandler(dispatcher));
  server.tool("memory_search", "Search memories across backends. Fans out to relevant backends and merges results.", memorySearchSchema.shape, createMemorySearchHandler(dispatcher));
  server.tool("memory_list", "List memories with optional filters (type, project, backend, date).", memoryListSchema.shape, createMemoryListHandler(backends));
  server.tool("memory_delete", "Delete a memory by ID.", memoryDeleteSchema.shape, createMemoryDeleteHandler(backends));
  server.tool("cortex_status", "Returns health of all backends, routing stats, and cache state.", cortexStatusSchema.shape, createCortexStatusHandler(backends));
  server.tool("cortex_backends", "Lists configured backends and their capabilities.", cortexBackendsSchema.shape, createCortexBackendsHandler(backends));
}
