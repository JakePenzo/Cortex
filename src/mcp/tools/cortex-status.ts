import { z } from "zod";
import type { BackendAdapter } from "../../backends/base.js";
import { getTodayStats } from "../../cache/sqlite.js";

export const cortexStatusSchema = z.object({});

export function createCortexStatusHandler(backends: BackendAdapter[]) {
  return async (_args: z.infer<typeof cortexStatusSchema>) => {
    const backendStats = await Promise.all(backends.map(b => b.stats()));
    const dayStats = getTodayStats();

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          version: "0.1.0",
          backends: backendStats,
          today: dayStats,
        }),
      }],
    };
  };
}

export const cortexBackendsSchema = z.object({});

export function createCortexBackendsHandler(backends: BackendAdapter[]) {
  return async (_args: z.infer<typeof cortexBackendsSchema>) => {
    const stats = await Promise.all(backends.map(b => b.stats()));
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ backends: stats }),
      }],
    };
  };
}
