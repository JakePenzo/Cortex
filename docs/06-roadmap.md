# Cortex — Features & Roadmap

## v0.1 — MVP (Build this first)

### Core
- [ ] MCP server (stdio transport)
- [ ] QMD adapter — search, add to collection
- [ ] OpenMemory adapter — add, search via MCP/HTTP
- [ ] Basic router — classify query type, dispatch to backend
- [ ] Basic merger — deduplicate + score results
- [ ] SQLite cache — avoid duplicate backend queries

### CLI
- [ ] `cortex setup` — detect backends, configure clients
- [ ] `cortex status` — backend health
- [ ] `cortex search <query>` — search with pretty output
- [ ] `cortex add <memory>` — manual memory add
- [ ] `cortex init --client <name>` — write MCP config for clients
- [ ] `cortex doctor` — diagnostics

### Config
- [ ] `cortex.config.json` schema + validation
- [ ] Per-project config override

---

## v0.2 — Daemon + Dashboard

### Daemon
- [ ] `cortex mcp --http --daemon` — background HTTP MCP server
- [ ] `cortex stop` / `cortex restart`
- [ ] Shared state across multiple clients (Claude + Cursor same memory)
- [ ] Auto-start on login (launchd/systemd service)

### Terminal Dashboard
- [ ] `cortex dash` — full-screen Ink TUI
- [ ] `cortex dash --live` — auto-refreshing
- [ ] Backend health panel
- [ ] Live query log
- [ ] Memory count per backend
- [ ] Recent memories list

### Web Dashboard
- [ ] `cortex dashboard` → localhost:3474
- [ ] Backend status cards
- [ ] Memory browser — search, filter, delete
- [ ] Query history
- [ ] Stats graphs

---

## v0.3 — Session Continuity

- [ ] `session_start` MCP tool — bootstrap context on conversation start
- [ ] `session_checkpoint` — save task/findings/decisions mid-session
- [ ] `session_end` — persist summary
- [ ] `cortex session list` — browse past sessions
- [ ] `cortex session resume <id>` — inject past session context

---

## v0.4 — ByteRover + Advanced Routing

- [ ] ByteRover adapter
- [ ] Three-backend fan-out with weighted merge
- [ ] `cortex stats` — full analytics (query count, latency, cache rate, per-backend)
- [ ] `cortex index <path>` — easy QMD collection management
- [ ] Smart routing improvement — track which backend returns best results per query type
- [ ] LITM-aware result ordering (best results at start + end of context)

---

## v0.5 — Polish & Distribution

- [ ] Homebrew formula
- [ ] Install script
- [ ] `cortex update` — self-update
- [ ] `cortex cheatsheet` — pretty quick reference
- [ ] `cortex wrapped` — weekly/monthly memory summary (lean-ctx inspired)
- [ ] Proper error messages for every failure mode
- [ ] Man page

---

## Future Ideas

**Custom backends**
Plugin API so anyone can write a Cortex backend adapter. Memory system you built yourself? Notion? Obsidian? Connect it.

**Smart compaction**
Automatically summarize old memories when a backend gets large. Keep recency-weighted, compact long-term store.

**Cross-machine sync**
Optional: push your full Cortex memory state to a private git repo or S3. Pull on another machine.

**Memory diff**
`cortex diff --since 7d` — what did you learn / decide this week?

**Export / import**
`cortex export --format json > memories.json`
`cortex import memories.json`

**Obsidian / Notion adapter**
Index your personal notes directly — QMD handles the search, Cortex routes queries there when appropriate.

**`cortex ask`**
`cortex ask "how do we handle errors in this project?"` — CLI-native memory query with formatted answer, not just raw results.

---

## Non-Goals (explicitly out of scope)

- Being a vector database
- Context compression (use lean-ctx for this)
- LLM inference
- Cloud hosting / SaaS
- Mobile
- GUI app (web dashboard is enough)
