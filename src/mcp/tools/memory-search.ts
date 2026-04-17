import { z } from "zod";
import type { Dispatcher } from "../../router/dispatcher.js";

export const memorySearchSchema = z.object({
  query: z.string().min(1).describe("Search query"),
  mode: z.enum(["fast", "semantic", "hybrid"]).optional().default("hybrid").describe("Search mode"),
  project: z.string().optional().describe("Filter by project"),
  limit: z.number().optional().default(10).describe("Max results to return"),
  backends: z.array(z.string()).optional().describe("Force specific backends (qmd, openmemory, byterover)"),
});

export type MemorySearchInput = z.infer<typeof memorySearchSchema>;

export function createMemorySearchHandler(dispatcher: Dispatcher) {
  return async (args: MemorySearchInput) => {
    const result = await dispatcher.search({
      query: args.query,
      mode: args.mode,
      project: args.project,
      limit: args.limit,
      backends: args.backends,
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(result),
      }],
    };
  };
}
