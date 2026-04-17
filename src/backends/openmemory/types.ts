export interface OpenMemorySearchResult {
  id: string;
  memory: string;
  score?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface OpenMemoryAddResponse {
  id: string;
  message?: string;
}

export interface OpenMemoryListResponse {
  results: OpenMemorySearchResult[];
  total?: number;
}
