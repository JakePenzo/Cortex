import { z } from "zod";
import type { BackendAdapter } from "../../backends/base.js";
import { deleteMemoryFromIndex } from "../../cache/sqlite.js";

export const memoryDeleteSchema = z.object({
  id: z.string().describe("Memory ID to delete"),
  backend: z.string().optional().describe("Backend that owns this memory"),
});

export type MemoryDeleteInput = z.infer<typeof memoryDeleteSchema>;

export function createMemoryDeleteHandler(backends: BackendAdapter[]) {
  return async (args: MemoryDeleteInput) => {
    const targets = args.backend
      ? backends.filter(b => b.name === args.backend)
      : backends;

    await Promise.all(targets.map(async b => {
      try { await b.delete(args.id); } catch {}
    }));

    deleteMemoryFromIndex(args.id);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ deleted: true, id: args.id }),
      }],
    };
  };
}
