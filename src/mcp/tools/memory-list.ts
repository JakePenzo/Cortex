import { z } from "zod";
import type { BackendAdapter } from "../../backends/base.js";
import type { MemoryType } from "../../router/types.js";

export const memoryListSchema = z.object({
  type: z.enum(["preference", "decision", "fact", "session", "document"]).optional(),
  project: z.string().optional(),
  backend: z.string().optional(),
  since: z.string().optional().describe("ISO date string — only memories after this date"),
  limit: z.number().optional().default(20),
});

export type MemoryListInput = z.infer<typeof memoryListSchema>;

export function createMemoryListHandler(backends: BackendAdapter[]) {
  return async (args: MemoryListInput) => {
    const filter = {
      type: args.type as MemoryType | undefined,
      project: args.project,
      backend: args.backend,
      since: args.since ? new Date(args.since) : undefined,
      limit: args.limit,
    };

    const targetBackends = args.backend
      ? backends.filter(b => b.name === args.backend)
      : backends;

    const resultSets = await Promise.all(
      targetBackends.map(async b => {
        const ok = await b.isAvailable();
        if (!ok) return [];
        return b.list(filter);
      })
    );

    const all = resultSets.flat();
    const limited = all.slice(0, args.limit ?? 20);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ results: limited, total: all.length }),
      }],
    };
  };
}
