/**
 * Memory analysis via a local Ollama model.
 * Returns null when Ollama is unavailable — callers must treat analysis as optional.
 */

import { isOllamaAvailable, listModels, generate } from "./client.js";

export interface AnalysisResult {
  tags: string[];       // suggested tags, max 5
  cluster: string;      // semantic cluster name, e.g. "React preferences"
  contradicts?: string; // ID of a memory this might override, or undefined
  confidence: number;   // 0–1
}

/** Ordered preference list for model selection. */
const PREFERRED_MODELS = ["llama3.2", "llama3", "mistral", "phi3"];

/**
 * Pick the best available model from the local Ollama instance.
 * Returns null when no preferred model is found or Ollama is unavailable.
 */
export async function pickModel(): Promise<string | null> {
  const models = await listModels();
  if (models.length === 0) return null;

  for (const preferred of PREFERRED_MODELS) {
    const match = models.find(m => m.startsWith(preferred));
    if (match) return match;
  }

  // Fall back to the first available model if none of the preferred ones exist
  return models[0] ?? null;
}

/**
 * Strip optional markdown code-fence wrapping from a string and parse as JSON.
 * Handles both ```json ... ``` and bare JSON.
 */
function parseJsonResponse(raw: string): unknown {
  const trimmed = raw.trim();

  // Strip markdown code block if present
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  const jsonStr = fenced ? fenced[1].trim() : trimmed;

  return JSON.parse(jsonStr);
}

/**
 * Analyze a single memory in the context of existing memories.
 * Returns null when Ollama is unavailable or the response cannot be parsed.
 */
export async function analyzeMemory(
  memory: { id: string; content: string; type: string },
  existing: { id: string; content: string; type: string; tags: string[] }[]
): Promise<AnalysisResult | null> {
  const available = await isOllamaAvailable();
  if (!available) return null;

  const model = await pickModel();
  if (!model) return null;

  // Build sample of up to 10 most-recent existing memories
  const sample = existing
    .slice(0, 10)
    .map(m => `${m.id}: ${m.content}`)
    .join("\n");

  const prompt = `You are analyzing a memory for a developer's knowledge base.

New memory (type: ${memory.type}): "${memory.content}"

Existing memories (sample):
${sample || "(none)"}

Return ONLY valid JSON (no explanation):
{
  "tags": ["tag1", "tag2"],
  "cluster": "Short cluster name",
  "contradicts": "memory-id or null",
  "confidence": 0.8
}`;

  const raw = await generate(model, prompt);
  if (!raw) return null;

  try {
    const parsed = parseJsonResponse(raw) as {
      tags?: unknown;
      cluster?: unknown;
      contradicts?: unknown;
      confidence?: unknown;
    };

    const tags = Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[]).filter(t => typeof t === "string").slice(0, 5) as string[]
      : [];

    const cluster = typeof parsed.cluster === "string" ? parsed.cluster : "General";

    const rawContradicts = parsed.contradicts;
    const contradicts =
      typeof rawContradicts === "string" && rawContradicts !== "null" && rawContradicts.trim() !== ""
        ? rawContradicts
        : undefined;

    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.5;

    return { tags, cluster, contradicts, confidence };
  } catch {
    return null;
  }
}
