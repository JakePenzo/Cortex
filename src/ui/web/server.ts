import { Hono } from "hono";
import { cors } from "hono/cors";
import type { BackendAdapter } from "../../backends/base.js";
import {
  getTodayStats, getRecentMemories, getAllMemories,
  getMemoryById, overrideMemory, updateMemoryContent,
  deleteMemoryFromIndex, indexMemory, getMemoryCount,
  updateMemoryAnalysis, getMemoriesNeedingAnalysis,
} from "../../cache/sqlite.js";
import { isOllamaAvailable, listModels } from "../../backends/ollama/client.js";
import { analyzeMemory, pickModel } from "../../backends/ollama/analyzer.js";
import { html } from "./html.js";
import type { MemoryResult } from "../../router/types.js";

/** Build the Hono app (no port binding) — exported for testing. */
export function buildApp(backends: BackendAdapter[]) {
  const app = new Hono();
  app.use("/*", cors());

  app.get("/", c => c.html(html));

  // ── Status ────────────────────────────────────────────────
  app.get("/api/status", async c => {
    const backendStats = await Promise.all(backends.map(b => b.stats()));
    const today = getTodayStats();
    return c.json({ version: "0.1.0", backends: backendStats, today, total_memories: getMemoryCount() });
  });

  app.get("/api/stats", c => c.json(getTodayStats()));

  // ── Memories ──────────────────────────────────────────────
  app.get("/api/memories", c => {
    const limit  = Number(c.req.query("limit") ?? "200");
    const status = c.req.query("status") ?? "all";
    const all    = getAllMemories();
    const out    = status === "all" ? all : all.filter(m => m.status === status);
    return c.json({ memories: out.slice(0, limit), total: out.length });
  });

  app.post("/api/memories", async c => {
    const body = await c.req.json() as { content: string; type?: string; tags?: string[]; project?: string };
    const mem: MemoryResult = {
      id: crypto.randomUUID(),
      content: body.content,
      type: (body.type ?? "fact") as MemoryResult["type"],
      backend: "local",
      score: 0,
      created_at: new Date(),
      tags: body.tags,
      project: body.project,
    };
    indexMemory(mem);

    // Fire-and-forget background analysis — never blocks the response
    const allForAnalysis = getAllMemories().filter(m => m.id !== mem.id);
    analyzeMemory(
      { id: mem.id, content: mem.content, type: mem.type },
      allForAnalysis.map(m => ({
        id: m.id,
        content: m.content,
        type: m.type,
        tags: m.tags ?? [],
      }))
    ).then(result => {
      if (result) {
        updateMemoryAnalysis(mem.id, result.cluster, result.tags);
      }
    }).catch(() => { /* analysis is optional — ignore all errors */ });

    return c.json({ memory: getMemoryById(mem.id) }, 201);
  });

  app.put("/api/memories/:id", async c => {
    updateMemoryContent(c.req.param("id"), (await c.req.json() as { content: string }).content);
    return c.json({ memory: getMemoryById(c.req.param("id")) });
  });

  app.delete("/api/memories/:id", c => {
    deleteMemoryFromIndex(c.req.param("id"));
    return c.json({ ok: true });
  });

  // Override: creates new memory, marks old as superseded
  app.post("/api/memories/:id/override", async c => {
    const oldId = c.req.param("id");
    const body  = await c.req.json() as { content: string; type?: string; tags?: string[] };
    const old   = getMemoryById(oldId);
    if (!old) return c.json({ error: "not found" }, 404);

    const next: MemoryResult = {
      id: crypto.randomUUID(),
      content: body.content,
      type: (body.type ?? old.type) as MemoryResult["type"],
      backend: old.backend,
      score: old.score,
      created_at: new Date(),
      tags: body.tags ?? old.tags,
      project: old.project,
    };
    overrideMemory(oldId, next);
    return c.json({ old: getMemoryById(oldId), new: getMemoryById(next.id) });
  });

  // ── Graph ─────────────────────────────────────────────────
  app.get("/api/graph", c => {
    const memories = getAllMemories();

    const nodes = memories.map(m => ({
      id: m.id,
      label: trunc(m.content, 35),
      title: m.content,
      type: m.type,   // used by frontend filter logic
      group: m.type,  // used by vis.js group styling
      status: m.status,
      tags: m.tags ?? [],
      project: m.project ?? null,
      backend: m.backend,
      created_at: m.created_at,
    }));

    const edges: Array<{ from: string; to: string; label?: string; dashes?: boolean }> = [];

    // Override chains
    for (const m of memories) {
      if (m.supersedes_id) {
        edges.push({ from: m.id, to: m.supersedes_id, label: "overrides", dashes: false });
      }
    }

    // Shared-tag proximity edges (solid only on same type, dashed otherwise)
    const byTag: Record<string, string[]> = {};
    for (const m of memories.filter(m => m.status === "active")) {
      for (const tag of (m.tags ?? [])) {
        (byTag[tag] ??= []).push(m.id);
      }
    }
    const edgeSet = new Set<string>();
    for (const ids of Object.values(byTag)) {
      if (ids.length < 2 || ids.length > 10) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join("|");
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push({ from: ids[i], to: ids[j], dashes: true });
          }
        }
      }
    }

    return c.json({ nodes, edges });
  });

  // ── Ollama ────────────────────────────────────────────────
  app.get("/api/ollama/status", async c => {
    const available = await isOllamaAvailable();
    const model = available ? await pickModel() : null;
    const total   = getAllMemories().length;
    const pending = getMemoriesNeedingAnalysis().length;
    const analyzed = total - pending;
    return c.json({ available, model, analyzed, pending });
  });

  app.post("/api/ollama/analyze", async c => {
    const pending = getMemoriesNeedingAnalysis().slice(0, 20);
    const existing = getAllMemories();

    let analyzed = 0;
    let skipped  = 0;
    let errors   = 0;

    for (const mem of pending) {
      try {
        const result = await analyzeMemory(
          { id: mem.id, content: mem.content, type: mem.type },
          existing
            .filter(m => m.id !== mem.id)
            .map(m => ({ id: m.id, content: m.content, type: m.type, tags: m.tags ?? [] }))
        );
        if (result) {
          updateMemoryAnalysis(mem.id, result.cluster, result.tags);
          analyzed++;
        } else {
          skipped++;
        }
      } catch {
        errors++;
      }
    }

    return c.json({ analyzed, skipped, errors });
  });

  return app;
}

export async function startWebDashboard(backends: BackendAdapter[], port: number): Promise<void> {
  const app = buildApp(backends);
  Bun.serve({ port, fetch: app.fetch });
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
