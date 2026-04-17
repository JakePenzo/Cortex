import { describe, it, expect } from "bun:test";
import { mergeResults } from "../../src/router/merger.js";
import type { MemoryResult } from "../../src/router/types.js";

function mem(id: string, content: string, score: number): MemoryResult {
  return { id, content, type: "fact", backend: "test", score, created_at: new Date() };
}

describe("mergeResults", () => {
  it("returns empty for no results", () => {
    expect(mergeResults([])).toEqual([]);
  });

  it("deduplicates identical content", () => {
    const a = [mem("1", "use named exports", 0.9)];
    const b = [mem("2", "use named exports", 0.7)];
    const merged = mergeResults([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].score).toBe(0.9);
  });

  it("preserves distinct content", () => {
    const a = [mem("1", "prefer named exports", 0.9)];
    const b = [mem("2", "use postgres for the db", 0.8)];
    const merged = mergeResults([a, b]);
    expect(merged).toHaveLength(2);
  });

  it("respects maxResults", () => {
    const a = Array.from({ length: 15 }, (_, i) => mem(String(i), `memory ${i}`, 0.5));
    const merged = mergeResults([a], 5);
    expect(merged).toHaveLength(5);
  });

  it("places highest-scored result first", () => {
    const a = [mem("1", "best result", 0.95), mem("2", "good result", 0.8), mem("3", "ok result", 0.6)];
    const merged = mergeResults([a]);
    expect(merged[0].id).toBe("1");
  });
});
