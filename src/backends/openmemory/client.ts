import type { OpenMemorySearchResult, OpenMemoryAddResponse, OpenMemoryListResponse } from "./types.js";

export class OpenMemoryClient {
  constructor(
    private readonly baseUrl: string,
    private readonly userId: string,
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; filters?: Record<string, unknown> } = {}): Promise<OpenMemorySearchResult[]> {
    const res = await fetch(`${this.baseUrl}/v1/memories/search/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, user_id: this.userId, limit: options.limit ?? 10, filters: options.filters }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return [];
    const data = await res.json() as { results?: OpenMemorySearchResult[] } | OpenMemorySearchResult[];
    return Array.isArray(data) ? data : data.results ?? [];
  }

  async add(content: string, metadata?: Record<string, unknown>): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/memories/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content }], user_id: this.userId, metadata }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`OpenMemory add failed: ${res.status}`);
    const data = await res.json() as OpenMemoryAddResponse | { results?: { id: string }[] };

    if ("id" in data) return data.id;
    if ("results" in data && data.results?.[0]?.id) return data.results[0].id;
    return crypto.randomUUID();
  }

  async get(id: string): Promise<OpenMemorySearchResult | null> {
    const res = await fetch(`${this.baseUrl}/v1/memories/${id}/`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<OpenMemorySearchResult>;
  }

  async delete(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/v1/memories/${id}/`, {
      method: "DELETE",
      signal: AbortSignal.timeout(5_000),
    });
  }

  async list(options: { limit?: number; filters?: Record<string, unknown> } = {}): Promise<OpenMemorySearchResult[]> {
    const params = new URLSearchParams({ user_id: this.userId, limit: String(options.limit ?? 20) });
    const res = await fetch(`${this.baseUrl}/v1/memories/?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as OpenMemoryListResponse | OpenMemorySearchResult[];
    return Array.isArray(data) ? data : data.results ?? [];
  }

  async stats(): Promise<{ total: number }> {
    const res = await fetch(`${this.baseUrl}/v1/memories/?${new URLSearchParams({ user_id: this.userId, limit: "1" })}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return { total: 0 };
    const data = await res.json() as { total?: number } | unknown[];
    if (Array.isArray(data)) return { total: data.length };
    return { total: (data as any).total ?? 0 };
  }
}
