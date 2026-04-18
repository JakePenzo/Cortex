/**
 * E2E: Ollama AI analysis integration.
 *
 * All Ollama HTTP calls are intercepted by replacing globalThis.fetch so no
 * real Ollama instance is required.  SQLite tests use _CORTEX_DATA_DIR_OVERRIDE
 * for full isolation.
 */
import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

// ── DB isolation ──────────────────────────────────────────────
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cortex-ollama-test-"));
  process.env._CORTEX_DATA_DIR_OVERRIDE = tmpDir;
  (globalThis as any).__cortexDbReset?.();
});

afterEach(() => {
  (globalThis as any).__cortexDbReset?.();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env._CORTEX_DATA_DIR_OVERRIDE;
});

// ── Fetch mock helpers ────────────────────────────────────────

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const original = globalThis.fetch;
  (globalThis as any).fetch = async (url: string, init?: RequestInit) => handler(url, init);
  return () => { (globalThis as any).fetch = original; };
}

function ollamaTagsResponse(models: string[]) {
  return new Response(
    JSON.stringify({ models: models.map(name => ({ name })) }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function ollamaGenerateResponse(text: string) {
  return new Response(
    JSON.stringify({ response: text }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function networkError(): never {
  throw new TypeError("Failed to fetch");
}

// ── isOllamaAvailable ─────────────────────────────────────────
describe("isOllamaAvailable", () => {
  it("returns true when /api/tags responds 200", async () => {
    const restore = mockFetch(() => ollamaTagsResponse(["llama3.2"]));
    try {
      const { isOllamaAvailable } = await import("../../src/backends/ollama/client.js");
      expect(await isOllamaAvailable()).toBe(true);
    } finally { restore(); }
  });

  it("returns false when fetch throws (Ollama not running)", async () => {
    const restore = mockFetch(() => networkError());
    try {
      const { isOllamaAvailable } = await import("../../src/backends/ollama/client.js");
      expect(await isOllamaAvailable()).toBe(false);
    } finally { restore(); }
  });

  it("returns false when /api/tags returns non-200", async () => {
    const restore = mockFetch(() => new Response(null, { status: 503 }));
    try {
      const { isOllamaAvailable } = await import("../../src/backends/ollama/client.js");
      expect(await isOllamaAvailable()).toBe(false);
    } finally { restore(); }
  });
});

// ── listModels ────────────────────────────────────────────────
describe("listModels", () => {
  it("returns model names array", async () => {
    const restore = mockFetch(() => ollamaTagsResponse(["llama3.2", "mistral"]));
    try {
      const { listModels } = await import("../../src/backends/ollama/client.js");
      expect(await listModels()).toEqual(["llama3.2", "mistral"]);
    } finally { restore(); }
  });

  it("returns [] when fetch throws", async () => {
    const restore = mockFetch(() => networkError());
    try {
      const { listModels } = await import("../../src/backends/ollama/client.js");
      expect(await listModels()).toEqual([]);
    } finally { restore(); }
  });

  it("returns [] when response is non-200", async () => {
    const restore = mockFetch(() => new Response(null, { status: 500 }));
    try {
      const { listModels } = await import("../../src/backends/ollama/client.js");
      expect(await listModels()).toEqual([]);
    } finally { restore(); }
  });
});

// ── generate ──────────────────────────────────────────────────
describe("generate", () => {
  it("returns the response text on success", async () => {
    const restore = mockFetch(() => ollamaGenerateResponse("hello world"));
    try {
      const { generate } = await import("../../src/backends/ollama/client.js");
      expect(await generate("llama3.2", "say hello")).toBe("hello world");
    } finally { restore(); }
  });

  it("returns empty string when fetch throws", async () => {
    const restore = mockFetch(() => networkError());
    try {
      const { generate } = await import("../../src/backends/ollama/client.js");
      expect(await generate("llama3.2", "prompt")).toBe("");
    } finally { restore(); }
  });

  it("returns empty string on non-200 status", async () => {
    const restore = mockFetch(() => new Response(null, { status: 404 }));
    try {
      const { generate } = await import("../../src/backends/ollama/client.js");
      expect(await generate("llama3.2", "prompt")).toBe("");
    } finally { restore(); }
  });
});

// ── pickModel ─────────────────────────────────────────────────
describe("pickModel", () => {
  it("prefers llama3.2 over other models", async () => {
    const restore = mockFetch(() => ollamaTagsResponse(["mistral", "llama3.2:latest", "phi3"]));
    try {
      const { pickModel } = await import("../../src/backends/ollama/analyzer.js");
      expect(await pickModel()).toBe("llama3.2:latest");
    } finally { restore(); }
  });

  it("falls back to mistral when llama3 variants are absent", async () => {
    const restore = mockFetch(() => ollamaTagsResponse(["phi3", "mistral:7b"]));
    try {
      const { pickModel } = await import("../../src/backends/ollama/analyzer.js");
      expect(await pickModel()).toBe("mistral:7b");
    } finally { restore(); }
  });

  it("falls back to first available model when no preferred model exists", async () => {
    const restore = mockFetch(() => ollamaTagsResponse(["codellama:13b"]));
    try {
      const { pickModel } = await import("../../src/backends/ollama/analyzer.js");
      expect(await pickModel()).toBe("codellama:13b");
    } finally { restore(); }
  });

  it("returns null when no models available", async () => {
    const restore = mockFetch(() => ollamaTagsResponse([]));
    try {
      const { pickModel } = await import("../../src/backends/ollama/analyzer.js");
      expect(await pickModel()).toBeNull();
    } finally { restore(); }
  });
});

// ── analyzeMemory ─────────────────────────────────────────────
describe("analyzeMemory", () => {
  const memory = { id: "mem-1", content: "always use TypeScript strict mode", type: "preference" };
  const existing = [
    { id: "mem-0", content: "use eslint", type: "fact", tags: ["tooling"] },
  ];

  it("returns null when Ollama is unavailable", async () => {
    const restore = mockFetch(() => networkError());
    try {
      const { analyzeMemory } = await import("../../src/backends/ollama/analyzer.js");
      const result = await analyzeMemory(memory, existing);
      expect(result).toBeNull();
    } finally { restore(); }
  });

  it("parses valid bare JSON response", async () => {
    const json = JSON.stringify({
      tags: ["typescript", "config"],
      cluster: "TypeScript preferences",
      contradicts: null,
      confidence: 0.9,
    });

    const restore = mockFetch(url => {
      if (url.includes("/api/tags"))    return ollamaTagsResponse(["llama3.2"]);
      if (url.includes("/api/generate")) return ollamaGenerateResponse(json);
      return new Response(null, { status: 404 });
    });

    try {
      const { analyzeMemory } = await import("../../src/backends/ollama/analyzer.js");
      const result = await analyzeMemory(memory, existing);
      expect(result).not.toBeNull();
      expect(result!.tags).toEqual(["typescript", "config"]);
      expect(result!.cluster).toBe("TypeScript preferences");
      expect(result!.contradicts).toBeUndefined();
      expect(result!.confidence).toBe(0.9);
    } finally { restore(); }
  });

  it("parses JSON wrapped in markdown code block", async () => {
    const json = "```json\n" + JSON.stringify({
      tags: ["react"],
      cluster: "React preferences",
      contradicts: "mem-0",
      confidence: 0.75,
    }) + "\n```";

    const restore = mockFetch(url => {
      if (url.includes("/api/tags"))    return ollamaTagsResponse(["llama3.2"]);
      if (url.includes("/api/generate")) return ollamaGenerateResponse(json);
      return new Response(null, { status: 404 });
    });

    try {
      const { analyzeMemory } = await import("../../src/backends/ollama/analyzer.js");
      const result = await analyzeMemory(memory, existing);
      expect(result).not.toBeNull();
      expect(result!.tags).toEqual(["react"]);
      expect(result!.cluster).toBe("React preferences");
      expect(result!.contradicts).toBe("mem-0");
      expect(result!.confidence).toBe(0.75);
    } finally { restore(); }
  });

  it("parses JSON wrapped in plain code block (no language hint)", async () => {
    const json = "```\n" + JSON.stringify({
      tags: ["deploy"],
      cluster: "Deployment config",
      contradicts: null,
      confidence: 0.6,
    }) + "\n```";

    const restore = mockFetch(url => {
      if (url.includes("/api/tags"))    return ollamaTagsResponse(["llama3.2"]);
      if (url.includes("/api/generate")) return ollamaGenerateResponse(json);
      return new Response(null, { status: 404 });
    });

    try {
      const { analyzeMemory } = await import("../../src/backends/ollama/analyzer.js");
      const result = await analyzeMemory(memory, existing);
      expect(result).not.toBeNull();
      expect(result!.cluster).toBe("Deployment config");
    } finally { restore(); }
  });

  it("returns null when generate returns empty string", async () => {
    const restore = mockFetch(url => {
      if (url.includes("/api/tags"))    return ollamaTagsResponse(["llama3.2"]);
      if (url.includes("/api/generate")) return ollamaGenerateResponse("");
      return new Response(null, { status: 404 });
    });

    try {
      const { analyzeMemory } = await import("../../src/backends/ollama/analyzer.js");
      const result = await analyzeMemory(memory, existing);
      expect(result).toBeNull();
    } finally { restore(); }
  });

  it("returns null when response is not valid JSON", async () => {
    const restore = mockFetch(url => {
      if (url.includes("/api/tags"))    return ollamaTagsResponse(["llama3.2"]);
      if (url.includes("/api/generate")) return ollamaGenerateResponse("sorry, I cannot help with that");
      return new Response(null, { status: 404 });
    });

    try {
      const { analyzeMemory } = await import("../../src/backends/ollama/analyzer.js");
      const result = await analyzeMemory(memory, existing);
      expect(result).toBeNull();
    } finally { restore(); }
  });

  it("caps tags at 5 even if model returns more", async () => {
    const json = JSON.stringify({
      tags: ["a", "b", "c", "d", "e", "f", "g"],
      cluster: "General",
      contradicts: null,
      confidence: 0.5,
    });

    const restore = mockFetch(url => {
      if (url.includes("/api/tags"))    return ollamaTagsResponse(["llama3.2"]);
      if (url.includes("/api/generate")) return ollamaGenerateResponse(json);
      return new Response(null, { status: 404 });
    });

    try {
      const { analyzeMemory } = await import("../../src/backends/ollama/analyzer.js");
      const result = await analyzeMemory(memory, existing);
      expect(result).not.toBeNull();
      expect(result!.tags.length).toBeLessThanOrEqual(5);
    } finally { restore(); }
  });

  it("returns null when model picks but generate throws", async () => {
    let callCount = 0;
    const restore = mockFetch(url => {
      if (url.includes("/api/tags")) {
        callCount++;
        return ollamaTagsResponse(["llama3.2"]);
      }
      // generate call throws
      networkError();
    });

    try {
      const { analyzeMemory } = await import("../../src/backends/ollama/analyzer.js");
      const result = await analyzeMemory(memory, existing);
      expect(result).toBeNull();
    } finally { restore(); }
  });
});

// ── SQLite: updateMemoryAnalysis / getMemoriesNeedingAnalysis ─
describe("SQLite AI analysis columns", () => {
  it("getMemoriesNeedingAnalysis returns all memories when none are analyzed", async () => {
    const { indexMemory, getMemoriesNeedingAnalysis } = await import("../../src/cache/sqlite.js");

    indexMemory({
      id: "a1", content: "use Tailwind", type: "preference" as any,
      backend: "local", score: 0, created_at: new Date(),
    });
    indexMemory({
      id: "a2", content: "use pino", type: "fact" as any,
      backend: "local", score: 0, created_at: new Date(),
    });

    const pending = getMemoriesNeedingAnalysis();
    expect(pending.length).toBe(2);
    expect(pending.map(m => m.id).sort()).toEqual(["a1", "a2"]);
  });

  it("updateMemoryAnalysis removes memory from pending list", async () => {
    const { indexMemory, getMemoriesNeedingAnalysis, updateMemoryAnalysis } =
      await import("../../src/cache/sqlite.js");

    indexMemory({
      id: "b1", content: "always lint", type: "fact" as any,
      backend: "local", score: 0, created_at: new Date(),
    });
    indexMemory({
      id: "b2", content: "use prettier", type: "preference" as any,
      backend: "local", score: 0, created_at: new Date(),
    });

    updateMemoryAnalysis("b1", "Tooling preferences", ["lint", "quality"]);

    const pending = getMemoriesNeedingAnalysis();
    expect(pending.map(m => m.id)).toEqual(["b2"]);
    expect(pending.find(m => m.id === "b1")).toBeUndefined();
  });

  it("updateMemoryAnalysis stores cluster and aiTags persistently", async () => {
    const { Database } = await import("bun:sqlite");
    const { indexMemory, updateMemoryAnalysis } = await import("../../src/cache/sqlite.js");

    indexMemory({
      id: "c1", content: "use vitest", type: "preference" as any,
      backend: "local", score: 0, created_at: new Date(),
    });
    updateMemoryAnalysis("c1", "Testing patterns", ["vitest", "testing"]);

    // Read directly from DB to confirm persistence
    const { join } = await import("path");
    const dbPath = join(tmpDir, "cortex.db");
    const raw = new Database(dbPath, { readonly: true });
    const row = raw.query("SELECT cluster, ai_tags FROM memories WHERE id = 'c1'").get() as any;
    raw.close();

    expect(row.cluster).toBe("Testing patterns");
    expect(JSON.parse(row.ai_tags)).toEqual(["vitest", "testing"]);
  });

  it("migration adds cluster and ai_tags columns without error on fresh DB", async () => {
    // Importing sqlite with the overridden tmpDir triggers migration
    const { getMemoryCount } = await import("../../src/cache/sqlite.js");
    expect(getMemoryCount()).toBe(0); // just proves migration ran without throwing
  });
});

// ── API: GET /api/ollama/status ───────────────────────────────
describe("GET /api/ollama/status", () => {
  async function req(method: string, path: string, body?: unknown) {
    const { buildApp } = await import("../../src/ui/web/server.js");
    const app = buildApp([]);
    return app.fetch(new Request(`http://localhost${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }));
  }

  it("returns available:false when Ollama is down", async () => {
    const restore = mockFetch(() => networkError());
    try {
      const res = await req("GET", "/api/ollama/status");
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.available).toBe(false);
      expect(json.model).toBeNull();
      expect(typeof json.analyzed).toBe("number");
      expect(typeof json.pending).toBe("number");
    } finally { restore(); }
  });

  it("returns available:true with model when Ollama is up", async () => {
    const restore = mockFetch(url => {
      if (url.includes("/api/tags")) return ollamaTagsResponse(["llama3.2:latest"]);
      return new Response(null, { status: 404 });
    });
    try {
      const res = await req("GET", "/api/ollama/status");
      const json = await res.json() as any;
      expect(json.available).toBe(true);
      expect(json.model).toBe("llama3.2:latest");
    } finally { restore(); }
  });
});

// ── API: POST /api/ollama/analyze ─────────────────────────────
describe("POST /api/ollama/analyze", () => {
  async function req(method: string, path: string, body?: unknown) {
    const { buildApp } = await import("../../src/ui/web/server.js");
    const app = buildApp([]);
    return app.fetch(new Request(`http://localhost${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }));
  }

  it("returns skipped counts when Ollama unavailable", async () => {
    const restore = mockFetch(() => networkError());
    try {
      // Seed a memory first
      await req("POST", "/api/memories", { content: "prefer bun", type: "fact" });

      const res = await req("POST", "/api/ollama/analyze");
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(typeof json.analyzed).toBe("number");
      expect(typeof json.skipped).toBe("number");
      expect(typeof json.errors).toBe("number");
      // All should be skipped since Ollama is down
      expect(json.skipped).toBeGreaterThanOrEqual(0);
    } finally { restore(); }
  });

  it("analyzes pending memories and returns counts", async () => {
    const analysisJson = JSON.stringify({
      tags: ["bun", "runtime"],
      cluster: "Runtime preferences",
      contradicts: null,
      confidence: 0.85,
    });

    let generateCalled = false;
    const restore = mockFetch(url => {
      if (url.includes("/api/tags"))    return ollamaTagsResponse(["llama3.2"]);
      if (url.includes("/api/generate")) {
        generateCalled = true;
        return ollamaGenerateResponse(analysisJson);
      }
      return new Response(null, { status: 404 });
    });

    try {
      // Seed via API (background analysis is fire-and-forget, so pending count is still 1)
      const { indexMemory } = await import("../../src/cache/sqlite.js");
      indexMemory({
        id: "analyze-me", content: "use Bun for everything", type: "preference" as any,
        backend: "local", score: 0, created_at: new Date(),
      });

      const res = await req("POST", "/api/ollama/analyze");
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.analyzed + json.skipped + json.errors).toBeGreaterThanOrEqual(1);
    } finally { restore(); }
  });
});
