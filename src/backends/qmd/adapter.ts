import type { BackendAdapter } from "../base.js";
import type { MemoryResult, SearchQuery, MemoryInput, ListFilter, BackendStats } from "../../router/types.js";
import { QmdClient } from "./client.js";
import type { CortexConfig } from "../../config/schema.js";

export class QmdAdapter implements BackendAdapter {
  readonly name = "qmd";
  private client: QmdClient;
  private config: CortexConfig["backends"]["qmd"];

  constructor(config: CortexConfig) {
    this.config = config.backends.qmd;
    this.client = new QmdClient(this.config.binary);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) return false;
    return this.client.isAvailable();
  }

  async search(query: SearchQuery): Promise<MemoryResult[]> {
    const limit = query.limit ?? 10;
    const raw = await this.client.search(query.query, { limit });

    return raw.map(r => ({
      id: r.id,
      content: r.content,
      type: "document" as const,
      backend: this.name,
      score: normalizeScore(r.score),
      created_at: new Date(),
      source: r.source,
      metadata: r.metadata,
    }));
  }

  async add(memory: MemoryInput): Promise<string> {
    const collection = this.config.collections[0];
    return this.client.add(memory.content, {
      collection,
      tags: memory.tags,
    });
  }

  async get(_id: string): Promise<MemoryResult | null> {
    // QMD doesn't have a direct get-by-ID; search for it
    return null;
  }

  async delete(_id: string): Promise<void> {
    // QMD collections are read-optimized; deletion not universally supported
  }

  async list(filter?: ListFilter): Promise<MemoryResult[]> {
    if (!filter?.type && !filter?.project) {
      // Return empty — QMD list is better served via search
      return [];
    }
    const query = filter.project ?? filter.type ?? "";
    return this.search({ query, limit: filter?.limit ?? 20 });
  }

  async stats(): Promise<BackendStats> {
    const available = await this.isAvailable();
    if (!available) {
      return { name: this.name, available: false, total_memories: 0, avg_latency_ms: 0 };
    }
    const s = await this.client.stats();
    const version = await this.client.version();
    return {
      name: this.name,
      available: true,
      total_memories: s.total_docs,
      avg_latency_ms: 0,
      version,
    };
  }
}

function normalizeScore(raw: number): number {
  if (raw >= 0 && raw <= 1) return raw;
  // BM25 scores can be > 1; clamp to 0–1
  return Math.min(1, Math.max(0, raw / 10));
}
