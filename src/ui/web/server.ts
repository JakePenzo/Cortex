import { Hono } from "hono";
import { cors } from "hono/cors";
import type { BackendAdapter } from "../../backends/base.js";
import { getTodayStats, getRecentMemories } from "../../cache/sqlite.js";
import { loadConfig } from "../../config/loader.js";
import { html } from "./html.js";

export async function startWebDashboard(backends: BackendAdapter[], port: number): Promise<void> {
  const app = new Hono();
  app.use("/*", cors());

  app.get("/", c => c.html(html));

  app.get("/api/status", async c => {
    const backendStats = await Promise.all(backends.map(b => b.stats()));
    const today = getTodayStats();
    return c.json({ version: "0.1.0", backends: backendStats, today });
  });

  app.get("/api/memories", c => {
    const limit = Number(c.req.query("limit") ?? "20");
    const memories = getRecentMemories(limit);
    return c.json({ memories, total: memories.length });
  });

  app.get("/api/stats", c => {
    const today = getTodayStats();
    return c.json(today);
  });

  const server = Bun.serve({ port, fetch: app.fetch });
  console.error(`[cortex] Web dashboard at http://localhost:${port}`);
}
