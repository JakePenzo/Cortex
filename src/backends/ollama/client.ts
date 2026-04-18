/**
 * Ollama HTTP client.
 * All functions return empty/false/null on any error — never throw.
 */

const OLLAMA_BASE = "http://localhost:11434";
const TIMEOUT_MS  = 30_000;

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

/** Returns true when a local Ollama instance is reachable. */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: withTimeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Returns the names of all locally-pulled models, or [] on error. */
export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: withTimeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = await res.json() as { models?: Array<{ name: string }> };
    return (data.models ?? []).map(m => m.name);
  } catch {
    return [];
  }
}

/** Generate a non-streaming response from the given model. Returns "" on error. */
export async function generate(model: string, prompt: string): Promise<string> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: withTimeout(TIMEOUT_MS),
    });
    if (!res.ok) return "";
    const data = await res.json() as { response?: string };
    return data.response ?? "";
  } catch {
    return "";
  }
}
