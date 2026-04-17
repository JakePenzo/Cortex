import type { OperationClassification, MemoryInput, SearchQuery } from "./types.js";

const PREFERENCE_PATTERNS = [
  /\bprefer\b/i, /\balways\b/i, /\bnever\b/i, /\buse\s+\w+\s+over\b/i,
  /\bmy\s+style\b/i, /\bconvention\b/i, /\bstandard\b/i, /\bnaming\b/i,
];

const DECISION_PATTERNS = [
  /\bdecid(ed|e)\b/i, /\bchose?\b/i, /\breason\b/i, /\bbecause\b/i,
  /\btrade.?off\b/i, /\barchitecture\b/i, /\bapproach\b/i,
];

const FACT_PATTERNS = [
  /\bis at\b/i, /\blives? at\b/i, /\bport\s+\d+/i, /\bendpoint\b/i,
  /\burl\b/i, /\bpath\b/i, /^\//,
];

export function classifyWrite(memory: MemoryInput): OperationClassification {
  if (memory.type) {
    return { kind: "write", writeType: memory.type };
  }

  const text = memory.content;

  if (PREFERENCE_PATTERNS.some(p => p.test(text))) {
    return { kind: "write", writeType: "preference" };
  }
  if (DECISION_PATTERNS.some(p => p.test(text))) {
    return { kind: "write", writeType: "decision" };
  }
  if (FACT_PATTERNS.some(p => p.test(text))) {
    return { kind: "write", writeType: "fact" };
  }

  return { kind: "write", writeType: "fact" };
}

export function classifyRead(query: SearchQuery): OperationClassification {
  const text = query.query;

  // Session bootstrap: empty or very generic
  if (!text || text.trim().length < 3) {
    return { kind: "read", readType: "context_bootstrap" };
  }

  // Preference recall
  if (PREFERENCE_PATTERNS.some(p => p.test(text)) || /\bdo\s+i\b/i.test(text) || /\bhow\s+do\s+i\b/i.test(text)) {
    return { kind: "read", readType: "preference_recall" };
  }

  // Fast keyword: short, specific, no semantic language
  if (text.length < 30 && !SEMANTIC_PATTERNS.some(p => p.test(text))) {
    return { kind: "read", readType: "keyword" };
  }

  return { kind: "read", readType: "hybrid" };
}

const SEMANTIC_PATTERNS = [
  /\banything\b/i, /\brelated\b/i, /\bsimilar\b/i, /\babout\b/i,
  /\bpattern\b/i, /\bcontext\b/i, /\bwhat.*(do|did|have)\b/i,
];
