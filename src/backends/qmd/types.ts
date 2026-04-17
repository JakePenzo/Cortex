export interface QmdSearchResult {
  id: string;
  content: string;
  score: number;
  source?: string;
  collection?: string;
  metadata?: Record<string, unknown>;
}

export interface QmdStats {
  total_docs: number;
  collections: string[];
  version?: string;
}
