import type { MemoryResult } from "./types.js";

export function mergeResults(resultSets: MemoryResult[][], maxResults = 10): MemoryResult[] {
  const flat = resultSets.flat();
  if (flat.length === 0) return [];

  // Deduplicate by exact content hash first
  const deduped = deduplicateByContent(flat);

  // Sort by score descending
  deduped.sort((a, b) => b.score - a.score);

  // Trim to max
  const trimmed = deduped.slice(0, maxResults);

  // LITM-aware: reorder so best results are at start and end of list
  return litmReorder(trimmed);
}

function deduplicateByContent(results: MemoryResult[]): MemoryResult[] {
  const seen = new Map<string, MemoryResult>();

  for (const r of results) {
    const key = normalizeContent(r.content);
    const existing = seen.get(key);
    if (!existing || r.score > existing.score) {
      seen.set(key, r);
    }
  }

  // Second pass: fuzzy dedup via Jaccard
  const unique: MemoryResult[] = [];
  for (const r of seen.values()) {
    const isDuplicate = unique.some(u => jaccardSimilarity(u.content, r.content) > 0.85);
    if (!isDuplicate) unique.push(r);
  }

  return unique;
}

function normalizeContent(content: string): string {
  return content.toLowerCase().replace(/\s+/g, " ").trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// Lost In The Middle reordering: put best results at start and end
function litmReorder(results: MemoryResult[]): MemoryResult[] {
  if (results.length <= 3) return results;

  const best = results[0];
  const secondBest = results[1];
  const middle = results.slice(2, -1);
  const last = results[results.length - 1];

  // Place highest-scored at start, second-highest at end, rest in middle
  return [best, ...middle, secondBest, last];
}

export function scoreWithRecency(result: MemoryResult, now = Date.now()): number {
  const ageMs = now - result.created_at.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // Decay: 10% reduction per 30 days, floored at 0.5
  const recencyFactor = Math.max(0.5, 1 - (ageDays / 30) * 0.1);
  return result.score * recencyFactor;
}
