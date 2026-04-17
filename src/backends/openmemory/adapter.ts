import type { BackendAdapter } from "../base.js";
import type { MemoryResult, SearchQuery, MemoryInput, ListFilter, BackendStats } from "../../router/types.js";
import { OpenMemoryClient } from "./client.js";
import type { CortexConfig } from "../../config/schema.js";

export class OpenMemoryAdapter implements BackendAdapter {
  readonly name = "openmemory";
  private client: OpenMemoryClient;
  private config: CortexConfig["backends"]["openmemory"];

  constructor(config: CortexConfig) {
    this.config = config.backends.openmemory;
    this.client = new OpenMemoryClient(this.config.url, this.config.user_id);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) return false;
    return this.client.isAvailable();
  }

  async search(query: SearchQuery): Promise<MemoryResult[]> {
    const raw = await this.client.search(query.query, { limit: query.limit ?? 10 });
    return raw.map(r => ({
      id: r.id,
      content: r.memory,
      type: inferType(r.metadata),
      backend: this.name,
      score: r.score ?? 0.5,
      created_at: r.created_at ? new Date(r.created_at) : new Date(),
      metadata: r.metadata,
    }));
  }

  async add(memory: MemoryInput): Promise<string> {
    const metadata: Record<string, unknown> = {};
    if (memory.type) metadata.type = memory.type;
    if (memory.project) metadata.project = memory.project;
    if (memory.tags) metadata.tags = memory.tags;
    return this.client.add(memory.content, metadata);
  }

  async get(id: string): Promise<MemoryResult | null> {
    const r = await this.client.get(id);
    if (!r) return null;
    return {
      id: r.id,
      content: r.memory,
      type: inferType(r.metadata),
      backend: this.name,
      score: 1,
      created_at: r.created_at ? new Date(r.created_at) : new Date(),
      metadata: r.metadata,
    };
  }

  async delete(id: string): Promise<void> {
    return this.client.delete(id);
  }

  async list(filter?: ListFilter): Promise<MemoryResult[]> {
    const raw = await this.client.list({ limit: filter?.limit ?? 20 });
    return raw
      .filter(r => !filter?.type || inferType(r.metadata) === filter.type)
      .map(r => ({
        id: r.id,
        content: r.memory,
        type: inferType(r.metadata),
        backend: this.name,
        score: r.score ?? 0.5,
        created_at: r.created_at ? new Date(r.created_at) : new Date(),
        metadata: r.metadata,
      }));
  }

  async stats(): Promise<BackendStats> {
    const available = await this.isAvailable();
    if (!available) return { name: this.name, available: false, total_memories: 0, avg_latency_ms: 0 };
    const s = await this.client.stats();
    return { name: this.name, available: true, total_memories: s.total, avg_latency_ms: 0 };
  }
}

import type { MemoryType } from "../../router/types.js";

function inferType(metadata?: Record<string, unknown>): MemoryType {
  const t = metadata?.type as string | undefined;
  const valid: MemoryType[] = ["preference", "decision", "fact", "session", "document"];
  return valid.includes(t as MemoryType) ? (t as MemoryType) : "fact";
}
