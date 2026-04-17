import type { BackendAdapter } from "../base.js";
import type { MemoryResult, SearchQuery, MemoryInput, ListFilter, BackendStats } from "../../router/types.js";

// ByteRover adapter — stub for v0.1, implemented in v0.4
export class ByteRoverAdapter implements BackendAdapter {
  readonly name = "byterover";

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async search(_query: SearchQuery): Promise<MemoryResult[]> {
    return [];
  }

  async add(_memory: MemoryInput): Promise<string> {
    return crypto.randomUUID();
  }

  async get(_id: string): Promise<MemoryResult | null> {
    return null;
  }

  async delete(_id: string): Promise<void> {}

  async list(_filter?: ListFilter): Promise<MemoryResult[]> {
    return [];
  }

  async stats(): Promise<BackendStats> {
    return { name: this.name, available: false, total_memories: 0, avg_latency_ms: 0 };
  }
}
