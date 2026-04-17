import type { MemoryResult, SearchQuery, MemoryInput, ListFilter, BackendStats } from "../router/types.js";

export interface BackendAdapter {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  search(query: SearchQuery): Promise<MemoryResult[]>;
  add(memory: MemoryInput): Promise<string>; // returns ID
  get(id: string): Promise<MemoryResult | null>;
  delete(id: string): Promise<void>;
  list(filter?: ListFilter): Promise<MemoryResult[]>;
  stats(): Promise<BackendStats>;
}
