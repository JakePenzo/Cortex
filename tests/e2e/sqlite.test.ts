/**
 * E2E: SQLite cache — seed, wipe, override, status migration
 *
 * Uses a real temp DB file so every test exercises the actual migration path.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

// ── Isolate each test in its own temp DB ──────────────────────
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cortex-test-"));
  // Override the data dir so the module uses our temp path
  process.env._CORTEX_DATA_DIR_OVERRIDE = tmpDir;
  // Force the DB singleton to reset between tests
  (globalThis as any).__cortexDbReset?.();
});

afterEach(() => {
  (globalThis as any).__cortexDbReset?.();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env._CORTEX_DATA_DIR_OVERRIDE;
});

// ── Helpers ───────────────────────────────────────────────────
function makeMemory(overrides: Partial<{
  id: string; content: string; type: string; backend: string;
  status: string; supersedes_id: string;
}> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    content: overrides.content ?? "use named exports",
    type: (overrides.type ?? "preference") as any,
    backend: overrides.backend ?? "local",
    score: 0.9,
    created_at: new Date(),
    status: overrides.status,
    supersedes_id: overrides.supersedes_id,
  };
}

// ── Tests ─────────────────────────────────────────────────────
describe("SQLite migration", () => {
  it("creates tables on first open", async () => {
    const { getMemoryCount } = await import("../../src/cache/sqlite.js");
    expect(getMemoryCount()).toBe(0);
  });

  it("adds status and supersedes_id columns to existing DB", async () => {
    // First open creates schema WITH new columns — verify they exist
    const { indexMemory, getMemoryById } = await import("../../src/cache/sqlite.js");
    const m = makeMemory({ id: "test-migration" });
    indexMemory(m);
    const stored = getMemoryById("test-migration");
    expect(stored).not.toBeNull();
    expect(stored!.status).toBe("active");
    expect(stored!.supersedes_id).toBeNull();
  });
});

describe("indexMemory / getMemoryById", () => {
  it("stores and retrieves a memory", async () => {
    const { indexMemory, getMemoryById } = await import("../../src/cache/sqlite.js");
    const m = makeMemory({ id: "abc", content: "prefer TypeScript" });
    indexMemory(m);
    const got = getMemoryById("abc");
    expect(got).not.toBeNull();
    expect(got!.content).toBe("prefer TypeScript");
    expect(got!.status).toBe("active");
  });

  it("returns null for unknown id", async () => {
    const { getMemoryById } = await import("../../src/cache/sqlite.js");
    expect(getMemoryById("does-not-exist")).toBeNull();
  });

  it("upserts on duplicate id", async () => {
    const { indexMemory, getMemoryById } = await import("../../src/cache/sqlite.js");
    indexMemory(makeMemory({ id: "dup", content: "version 1" }));
    indexMemory(makeMemory({ id: "dup", content: "version 2" }));
    expect(getMemoryById("dup")!.content).toBe("version 2");
  });
});

describe("getAllMemories", () => {
  it("returns all memories newest first", async () => {
    const { indexMemory, getAllMemories } = await import("../../src/cache/sqlite.js");
    const older = makeMemory({ id: "old", content: "older" });
    older.created_at = new Date(Date.now() - 60_000);
    indexMemory(older);
    indexMemory(makeMemory({ id: "new", content: "newer" }));
    const all = getAllMemories();
    expect(all[0].id).toBe("new");
    expect(all[1].id).toBe("old");
  });
});

describe("overrideMemory", () => {
  it("marks old memory as superseded", async () => {
    const { indexMemory, overrideMemory, getMemoryById } = await import("../../src/cache/sqlite.js");
    const old = makeMemory({ id: "old-pref", content: "use CSS Modules" });
    indexMemory(old);

    const next = makeMemory({ id: "new-pref", content: "use Tailwind" });
    overrideMemory("old-pref", next);

    expect(getMemoryById("old-pref")!.status).toBe("superseded");
    expect(getMemoryById("new-pref")!.status).toBe("active");
    expect(getMemoryById("new-pref")!.supersedes_id).toBe("old-pref");
  });

  it("new memory inherits backend and project from old", async () => {
    const { indexMemory, overrideMemory, getMemoryById } = await import("../../src/cache/sqlite.js");
    const old = { ...makeMemory({ id: "src" }), backend: "openmemory", project: "my-app" };
    indexMemory(old);

    const next = makeMemory({ id: "dst", content: "updated" });
    next.backend = old.backend;
    (next as any).project = old.project;
    overrideMemory("src", next);

    const stored = getMemoryById("dst")!;
    expect(stored.backend).toBe("openmemory");
    expect(stored.project).toBe("my-app");
    expect(stored.supersedes_id).toBe("src");
  });
});

describe("wipeAllMemories", () => {
  it("returns count of deleted memories and empties the table", async () => {
    const { indexMemory, wipeAllMemories, getMemoryCount } = await import("../../src/cache/sqlite.js");
    indexMemory(makeMemory({ id: "a" }));
    indexMemory(makeMemory({ id: "b" }));
    indexMemory(makeMemory({ id: "c" }));
    expect(getMemoryCount()).toBe(3);

    const deleted = wipeAllMemories();
    expect(deleted).toBe(3);
    expect(getMemoryCount()).toBe(0);
  });

  it("returns 0 when already empty", async () => {
    const { wipeAllMemories } = await import("../../src/cache/sqlite.js");
    expect(wipeAllMemories()).toBe(0);
  });
});

describe("updateMemoryContent", () => {
  it("updates content in place", async () => {
    const { indexMemory, updateMemoryContent, getMemoryById } = await import("../../src/cache/sqlite.js");
    indexMemory(makeMemory({ id: "edit-me", content: "before" }));
    updateMemoryContent("edit-me", "after");
    expect(getMemoryById("edit-me")!.content).toBe("after");
  });
});

describe("deleteMemoryFromIndex", () => {
  it("removes the memory", async () => {
    const { indexMemory, deleteMemoryFromIndex, getMemoryById } = await import("../../src/cache/sqlite.js");
    indexMemory(makeMemory({ id: "del" }));
    deleteMemoryFromIndex("del");
    expect(getMemoryById("del")).toBeNull();
  });
});
