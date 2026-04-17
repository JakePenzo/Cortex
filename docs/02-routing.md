# Cortex — Routing Architecture

## How Routing Works

Every memory operation that comes into Cortex gets classified before being dispatched. The router looks at the operation type, the content/query, and the context to decide which backend(s) to involve.

---

## Memory Operation Types

### WRITE operations

| Type | Example | Primary Backend | Secondary |
|------|---------|----------------|-----------|
| Preference | "I prefer TypeScript strict mode" | OpenMemory | — |
| Decision | "We chose Postgres over SQLite because..." | ByteRover | OpenMemory |
| Project fact | "Auth service lives at /apps/auth" | ByteRover | QMD index |
| Session note | "Currently debugging race condition in queue" | OpenMemory | — |
| File/doc index | Index this markdown folder | QMD | — |

### READ operations

| Type | Example | Strategy |
|------|---------|---------|
| Fast keyword | "what's the auth endpoint?" | QMD first, return immediately |
| Preference recall | "how do I like to name variables?" | OpenMemory only |
| Project context | "what decisions did we make about the DB?" | ByteRover + OpenMemory, merge |
| Semantic search | "anything related to error handling patterns" | QMD (vsearch) + ByteRover, merge |
| Session bootstrap | On new conversation start | OpenMemory + ByteRover, combine |

---

## Routing Decision Tree

```
Incoming query
      │
      ▼
Is this a WRITE?
  ├─ YES → Classify content type
  │         ├─ preference/style → OpenMemory
  │         ├─ decision/rationale → ByteRover + OpenMemory
  │         ├─ project structure → ByteRover + trigger QMD re-index
  │         └─ raw file/doc → QMD collection
  │
  └─ NO (READ) → Classify query intent
                  ├─ keyword/exact → QMD (BM25 mode, <50ms)
                  ├─ semantic/fuzzy → QMD (vsearch) + ByteRover, merge
                  ├─ preference recall → OpenMemory only
                  └─ context bootstrap → all backends, merge & rank
```

---

## Fan-out & Merge

For reads that need multiple backends, Cortex runs them in **parallel** and merges results:

```
Query: "how do we handle auth in this project?"
          │
    ┌─────┴──────┐
    │            │
    ▼            ▼
  QMD          ByteRover
  (local       (structured
   files)       context)
    │            │
    └─────┬──────┘
          ▼
       Merger
    - Deduplicate by content hash
    - Score by relevance + recency
    - LITM-aware ordering (best results first + last)
    - Return top N results
```

### Merge scoring factors:
- **Relevance score** from the backend (normalized 0–1)
- **Recency** — newer memories weighted higher
- **Source confidence** — backends have different reliability per query type
- **Deduplication** — near-duplicate content collapsed (jaccard similarity >0.85)

---

## Backend Profiles

### QMD
- **Strengths**: Fast (<50ms), BM25 + vector + rerank, indexes any file/doc, no API key needed
- **Weaknesses**: Read-only retrieval, doesn't "learn" from conversations
- **Best for**: Project docs, notes, code files, meeting transcripts
- **Mode used**: `qmd query` (hybrid + reranking) for best results

### OpenMemory (Mem0)
- **Strengths**: Semantic memory, cross-session, preferences and decisions, structured storage
- **Weaknesses**: Requires Docker + Qdrant running locally, needs OpenAI key by default
- **Best for**: User preferences, coding style, session continuity, personal context
- **Mode used**: MCP over SSE at localhost:8765

### ByteRover
- **Strengths**: Hierarchical knowledge tree, cross-agent sharing, git-style sync, 92.2% retrieval accuracy
- **Weaknesses**: Newer, less mature, primarily coding-agent focused
- **Best for**: Project architecture decisions, codebase context, team-shared knowledge
- **Mode used**: MCP via `brv mcp`

---

## Graceful Degradation

If a backend is unavailable, Cortex:
1. Logs a warning (visible in `cortex status`)
2. Routes to the next best available backend
3. Never fails the query — always returns something or an empty set
4. Shows backend health in dashboard

```
cortex status

  ● QMD          running  (v2.3.1)  ✓
  ● OpenMemory   running  (v1.4.0)  ✓
  ○ ByteRover    offline            ⚠  routing to QMD fallback
```
