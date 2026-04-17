import { z } from "zod";
import type { Dispatcher } from "../../router/dispatcher.js";
import { indexMemory } from "../../cache/sqlite.js";
import type { MemoryType } from "../../router/types.js";

export const memoryAddSchema = z.object({
  content: z.string().min(1).describe("The memory content to store"),
  type: z.enum(["preference", "decision", "fact", "session", "document"]).optional().describe("Optional memory type hint"),
  project: z.string().optional().describe("Project scope (defaults to current working directory)"),
  tags: z.array(z.string()).optional().describe("Optional tags for retrieval"),
  ttl: z.number().optional().describe("Optional TTL in days (omit for permanent)"),
});

export type MemoryAddInput = z.infer<typeof memoryAddSchema>;

export function createMemoryAddHandler(dispatcher: Dispatcher) {
  return async (args: MemoryAddInput) => {
    const { id, backends_used } = await dispatcher.write({
      content: args.content,
      type: args.type as MemoryType | undefined,
      project: args.project,
      tags: args.tags,
      ttl: args.ttl,
    });

    // Index in local SQLite
    indexMemory({
      id,
      content: args.content,
      type: (args.type as MemoryType) ?? "fact",
      backend: backends_used[0] ?? "unknown",
      score: 1,
      created_at: new Date(),
      project: args.project,
      tags: args.tags,
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ id, backends_used, stored: true }),
      }],
    };
  };
}
