import type { BackendAdapter } from "../backends/base.js";
import type { SearchQuery, MemoryInput, MemoryResult } from "./types.js";
import { classifyWrite, classifyRead } from "./classifier.js";
import { mergeResults } from "./merger.js";
import { getCached, setCache, recordStat, getRecentMemories } from "../cache/sqlite.js";
import { createHash } from "crypto";

export class Dispatcher {
  constructor(
    private readonly backends: BackendAdapter[],
    private readonly cacheTtlSeconds: number,
    private readonly maxResults: number,
  ) {}

  private backend(name: string): BackendAdapter | undefined {
    return this.backends.find(b => b.name === name);
  }

  private available(names: string[]): BackendAdapter[] {
    return names.map(n => this.backend(n)).filter((b): b is BackendAdapter => b !== undefined);
  }

  async search(query: SearchQuery): Promise<{ results: MemoryResult[]; backends_used: string[]; latency_ms: number; from_cache: boolean }> {
    const hash = hashQuery(query);
    const cached = getCached(hash);
    if (cached) {
      return { results: cached, backends_used: [], latency_ms: 0, from_cache: true };
    }

    const classification = classifyRead(query);
    const start = Date.now();

    let backendsToQuery: BackendAdapter[] = [];

    switch (classification.readType) {
      case "keyword":
        backendsToQuery = this.available(["qmd"]);
        break;
      case "preference_recall":
        backendsToQuery = this.available(["openmemory"]);
        break;
      case "context_bootstrap":
        backendsToQuery = this.backends;
        break;
      case "hybrid":
      case "semantic":
      default:
        backendsToQuery = this.available(["qmd", "openmemory", "byterover"]);
        break;
    }

    // Force-override if caller specifies backends
    if (query.backends?.length) {
      backendsToQuery = this.available(query.backends);
    }

    // Filter to only available backends
    const liveness = await Promise.all(backendsToQuery.map(b => b.isAvailable()));
    const live = backendsToQuery.filter((_, i) => liveness[i]);

    if (live.length === 0) {
      // Fallback: search local SQLite index
      const local = getRecentMemories(query.limit ?? this.maxResults)
        .filter(m => m.content.toLowerCase().includes(query.query.toLowerCase()));
      return { results: local, backends_used: ["local"], latency_ms: Date.now() - start, from_cache: false };
    }

    // Fan out in parallel
    const resultSets = await Promise.all(
      live.map(async b => {
        const t0 = Date.now();
        try {
          const results = await b.search({ ...query, limit: query.limit ?? this.maxResults });
          recordStat("query", b.name, Date.now() - t0);
          return results;
        } catch {
          return [];
        }
      })
    );

    const merged = mergeResults(resultSets, query.limit ?? this.maxResults);
    const latency = Date.now() - start;
    setCache(hash, merged, this.cacheTtlSeconds);

    return {
      results: merged,
      backends_used: live.map(b => b.name),
      latency_ms: latency,
      from_cache: false,
    };
  }

  async write(memory: MemoryInput): Promise<{ id: string; backends_used: string[] }> {
    const classification = classifyWrite(memory);
    const start = Date.now();

    let targets: string[] = [];
    switch (classification.writeType) {
      case "preference":
        targets = ["openmemory"];
        break;
      case "decision":
        targets = ["byterover", "openmemory"];
        break;
      case "fact":
        targets = ["byterover", "qmd"];
        break;
      case "session":
        targets = ["openmemory"];
        break;
      case "document":
        targets = ["qmd"];
        break;
      default:
        targets = ["openmemory", "qmd"];
    }

    const live = (await Promise.all(
      this.available(targets).map(async b => ({ b, ok: await b.isAvailable() }))
    )).filter(x => x.ok).map(x => x.b);

    // Fallback: if no target available, try any backend
    const writers = live.length > 0 ? live : this.backends.slice(0, 1);

    let id = crypto.randomUUID();
    const used: string[] = [];

    await Promise.all(writers.map(async b => {
      try {
        const result = await b.add(memory);
        id = result; // Use last successful ID
        used.push(b.name);
        recordStat("write", b.name, Date.now() - start);
      } catch {
        // Continue — at least one backend must succeed
      }
    }));

    return { id, backends_used: used };
  }
}

function hashQuery(query: SearchQuery): string {
  return createHash("sha256")
    .update(JSON.stringify({ q: query.query, mode: query.mode, project: query.project }))
    .digest("hex")
    .slice(0, 16);
}
