/**
 * E2E: SQLite cache layer and stats functions
 * Covers getCached/setCache/invalidateCache/recordStat/getTodayStats/getRecentMemories/closeDb
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cortex-cache-test-"));
  process.env._CORTEX_DATA_DIR_OVERRIDE = tmpDir;
  (globalThis as any).__cortexDbReset?.();
});

afterEach(() => {
  (globalThis as any).__cortexDbReset?.();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env._CORTEX_DATA_DIR_OVERRIDE;
});

// ── Query cache ───────────────────────────────────────────────
describe("getCached / setCache", () => {
  it("returns null for a cache miss", async () => {
    const { getCached } = await import("../../src/cache/sqlite.js");
    expect(getCached("missing-hash")).toBeNull();
  });

  it("returns results before TTL expires", async () => {
    const { getCached, setCache } = await import("../../src/cache/sqlite.js");
    const results = [{ id: "a", content: "c", type: "fact", backend: "local", score: 1, created_at: new Date() } as any];
    setCache("h1", results, 60);
    const hit = getCached("h1");
    expect(hit).not.toBeNull();
    expect(hit![0].id).toBe("a");
  });

  it("returns null after TTL expires (past timestamp)", async () => {
    const { getCached, setCache } = await import("../../src/cache/sqlite.js");
    // Write with -1s TTL (already expired)
    setCache("h2", [], -1);
    expect(getCached("h2")).toBeNull();
  });

  it("upserts on duplicate hash", async () => {
    const { getCached, setCache } = await import("../../src/cache/sqlite.js");
    const r1 = [{ id: "x", content: "first", type: "fact", backend: "local", score: 1, created_at: new Date() } as any];
    const r2 = [{ id: "y", content: "second", type: "fact", backend: "local", score: 1, created_at: new Date() } as any];
    setCache("dup", r1, 60);
    setCache("dup", r2, 60);
    const hit = getCached("dup");
    expect(hit![0].id).toBe("y");
  });
});

describe("invalidateCache", () => {
  it("removes expired entries and keeps live ones", async () => {
    const { getCached, setCache, invalidateCache } = await import("../../src/cache/sqlite.js");
    setCache("live", [], 60);
    setCache("dead", [], -1);
    invalidateCache();
    expect(getCached("live")).not.toBeNull();
    // dead was already expired before invalidate — still null
    expect(getCached("dead")).toBeNull();
  });
});

// ── Stats ─────────────────────────────────────────────────────
describe("recordStat / getTodayStats", () => {
  it("counts queries and writes recorded today", async () => {
    const { recordStat, getTodayStats } = await import("../../src/cache/sqlite.js");
    recordStat("query", "local", 42);
    recordStat("query", "local", 30);
    recordStat("write", "openmemory", 10);

    const stats = getTodayStats();
    expect(stats.queries).toBe(2);
    expect(stats.writes).toBe(1);
    expect(stats.avg_latency_ms).toBe(27); // (42+30+10)/3 = 27.3 → 27
    expect(stats.backends_used).toContain("local");
    expect(stats.backends_used).toContain("openmemory");
  });

  it("returns zeros when no stats recorded", async () => {
    const { getTodayStats } = await import("../../src/cache/sqlite.js");
    const stats = getTodayStats();
    expect(stats.queries).toBe(0);
    expect(stats.writes).toBe(0);
    expect(stats.avg_latency_ms).toBe(0);
    expect(stats.backends_used).toEqual([]);
  });

  it("counts cache_hits from query_cache entries created today", async () => {
    const { setCache, getTodayStats } = await import("../../src/cache/sqlite.js");
    setCache("c1", [], 60);
    setCache("c2", [], 60);
    const stats = getTodayStats();
    expect(stats.cache_hits).toBe(2);
  });
});

// ── getRecentMemories ─────────────────────────────────────────
describe("getRecentMemories", () => {
  it("returns up to limit memories newest first", async () => {
    const { indexMemory, getRecentMemories } = await import("../../src/cache/sqlite.js");
    for (let i = 0; i < 5; i++) {
      indexMemory({
        id: `m${i}`,
        content: `memory ${i}`,
        type: "fact",
        backend: "local",
        score: 0,
        created_at: new Date(Date.now() + i * 1000),
      });
    }
    const recent = getRecentMemories(3);
    expect(recent).toHaveLength(3);
    expect(recent[0].id).toBe("m4"); // newest first
  });

  it("defaults to 10 when no limit given", async () => {
    const { indexMemory, getRecentMemories } = await import("../../src/cache/sqlite.js");
    for (let i = 0; i < 12; i++) {
      indexMemory({ id: `r${i}`, content: `c`, type: "fact", backend: "local", score: 0, created_at: new Date() });
    }
    expect(getRecentMemories()).toHaveLength(10);
  });
});

// ── closeDb / resetDb ─────────────────────────────────────────
describe("closeDb", () => {
  it("can close and reopen the DB without error", async () => {
    const { closeDb, getMemoryCount, indexMemory } = await import("../../src/cache/sqlite.js");
    indexMemory({ id: "pre-close", content: "x", type: "fact", backend: "local", score: 0, created_at: new Date() });
    closeDb();
    // After close, next call should re-open the DB
    expect(getMemoryCount()).toBe(1);
  });
});
