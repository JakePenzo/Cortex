/**
 * E2E: Web dashboard API — uses in-process Hono app (no port binding).
 * Each describe block gets its own temp DB so tests are fully isolated.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

// ── Isolation helpers ─────────────────────────────────────────
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cortex-api-test-"));
  process.env._CORTEX_DATA_DIR_OVERRIDE = tmpDir;
  (globalThis as any).__cortexDbReset?.();
});

afterEach(() => {
  (globalThis as any).__cortexDbReset?.();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env._CORTEX_DATA_DIR_OVERRIDE;
});

// ── Lazy app builder ─────────────────────────────────────────
// Import after env is set so the DB module picks up the override.
async function getApp() {
  const { buildApp } = await import("../../src/ui/web/server.js");
  return buildApp([]); // no backends needed for memory API tests
}

async function req(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const app = await getApp();
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

// ── GET /api/memories ─────────────────────────────────────────
describe("GET /api/memories", () => {
  it("returns empty list when no memories exist", async () => {
    const res = await req("GET", "/api/memories");
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.memories).toEqual([]);
    expect(json.total).toBe(0);
  });

  it("returns all memories after seeding", async () => {
    // Seed via POST first
    await req("POST", "/api/memories", { content: "prefer TypeScript", type: "preference" });
    await req("POST", "/api/memories", { content: "use pino for logging", type: "fact" });

    const res = await req("GET", "/api/memories");
    const json = await res.json() as any;
    expect(json.total).toBe(2);
    expect(json.memories).toHaveLength(2);
  });

  it("filters by status=active", async () => {
    // Create two, override one
    const r1 = await req("POST", "/api/memories", { content: "old way", type: "preference" });
    const { memory: m1 } = await r1.json() as any;

    await req("POST", `/api/memories/${m1.id}/override`, { content: "new way" });

    const res = await req("GET", "/api/memories?status=active");
    const json = await res.json() as any;
    // Original is now superseded, new one is active — only 1 active
    expect(json.memories.every((m: any) => m.status === "active")).toBe(true);
    expect(json.memories).toHaveLength(1);
  });
});

// ── POST /api/memories ────────────────────────────────────────
describe("POST /api/memories", () => {
  it("creates a memory and returns 201", async () => {
    const res = await req("POST", "/api/memories", {
      content: "always use named exports",
      type: "preference",
      tags: ["typescript"],
    });
    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(json.memory.content).toBe("always use named exports");
    expect(json.memory.type).toBe("preference");
    expect(json.memory.status).toBe("active");
  });

  it("defaults type to fact when omitted", async () => {
    const res = await req("POST", "/api/memories", { content: "Bun runs TypeScript natively" });
    const json = await res.json() as any;
    expect(json.memory.type).toBe("fact");
  });
});

// ── PUT /api/memories/:id ────────────────────────────────────
describe("PUT /api/memories/:id", () => {
  it("updates content in place", async () => {
    const r = await req("POST", "/api/memories", { content: "before" });
    const { memory } = await r.json() as any;

    const res = await req("PUT", `/api/memories/${memory.id}`, { content: "after" });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.memory.content).toBe("after");
  });
});

// ── DELETE /api/memories/:id ─────────────────────────────────
describe("DELETE /api/memories/:id", () => {
  it("deletes the memory", async () => {
    const r = await req("POST", "/api/memories", { content: "to delete" });
    const { memory } = await r.json() as any;

    const del = await req("DELETE", `/api/memories/${memory.id}`);
    expect(del.status).toBe(200);
    const { ok } = await del.json() as any;
    expect(ok).toBe(true);

    // Should be gone from list
    const list = await req("GET", "/api/memories");
    const json = await list.json() as any;
    expect(json.total).toBe(0);
  });
});

// ── POST /api/memories/:id/override ──────────────────────────
describe("POST /api/memories/:id/override", () => {
  it("marks old as superseded and creates new active memory", async () => {
    const r = await req("POST", "/api/memories", { content: "use CSS Modules", type: "preference" });
    const { memory: old } = await r.json() as any;

    const res = await req("POST", `/api/memories/${old.id}/override`, {
      content: "use Tailwind CSS",
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;

    expect(json.old.status).toBe("superseded");
    expect(json.new.status).toBe("active");
    expect(json.new.supersedes_id).toBe(old.id);
    expect(json.new.content).toBe("use Tailwind CSS");
  });

  it("returns 404 for unknown id", async () => {
    const res = await req("POST", "/api/memories/does-not-exist/override", { content: "x" });
    expect(res.status).toBe(404);
  });

  it("inherits type from old memory when not specified", async () => {
    const r = await req("POST", "/api/memories", { content: "prefer mocha", type: "preference" });
    const { memory: old } = await r.json() as any;

    const res = await req("POST", `/api/memories/${old.id}/override`, { content: "prefer bun:test" });
    const json = await res.json() as any;
    expect(json.new.type).toBe("preference");
  });
});

// ── GET /api/graph ────────────────────────────────────────────
describe("GET /api/graph", () => {
  it("returns empty nodes and edges when no memories exist", async () => {
    const res = await req("GET", "/api/graph");
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.nodes).toEqual([]);
    expect(json.edges).toEqual([]);
  });

  it("returns override edge after override", async () => {
    const r = await req("POST", "/api/memories", { content: "old pref", type: "preference" });
    const { memory: old } = await r.json() as any;
    await req("POST", `/api/memories/${old.id}/override`, { content: "new pref" });

    const res = await req("GET", "/api/graph");
    const json = await res.json() as any;

    // Should have 2 nodes
    expect(json.nodes).toHaveLength(2);

    // Should have 1 override edge
    const overrideEdges = json.edges.filter((e: any) => e.label === "overrides");
    expect(overrideEdges).toHaveLength(1);
    expect(overrideEdges[0].to).toBe(old.id);
  });

  it("emits tag-proximity edges for shared tags", async () => {
    await req("POST", "/api/memories", { content: "alpha", type: "fact", tags: ["shared-tag"] });
    await req("POST", "/api/memories", { content: "beta",  type: "fact", tags: ["shared-tag"] });

    const res = await req("GET", "/api/graph");
    const json = await res.json() as any;

    const dashedEdges = json.edges.filter((e: any) => e.dashes === true);
    expect(dashedEdges).toHaveLength(1);
  });
});

// ── GET /api/stats ────────────────────────────────────────────
describe("GET /api/stats", () => {
  it("returns day stats shape", async () => {
    const res = await req("GET", "/api/stats");
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(typeof json.queries).toBe("number");
    expect(typeof json.writes).toBe("number");
    expect(typeof json.avg_latency_ms).toBe("number");
    expect(Array.isArray(json.backends_used)).toBe(true);
  });
});
