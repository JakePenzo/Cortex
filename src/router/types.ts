export type MemoryType = "preference" | "decision" | "fact" | "session" | "document";
export type ReadType = "keyword" | "semantic" | "preference_recall" | "context_bootstrap" | "hybrid";
export type WriteType = "preference" | "decision" | "fact" | "session" | "document";

export interface MemoryResult {
  id: string;
  content: string;
  type: MemoryType;
  backend: string;
  score: number; // 0–1
  created_at: Date;
  project?: string;
  tags?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchQuery {
  query: string;
  mode?: "fast" | "semantic" | "hybrid";
  project?: string;
  limit?: number;
  backends?: string[];
}

export interface MemoryInput {
  content: string;
  type?: MemoryType;
  project?: string;
  tags?: string[];
  ttl?: number; // days, null = permanent
}

export interface ListFilter {
  type?: MemoryType;
  project?: string;
  backend?: string;
  since?: Date;
  limit?: number;
}

export interface BackendStats {
  name: string;
  available: boolean;
  total_memories: number;
  avg_latency_ms: number;
  version?: string;
}

export interface OperationClassification {
  kind: "read" | "write";
  readType?: ReadType;
  writeType?: WriteType;
}
