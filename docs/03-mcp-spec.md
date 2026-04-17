# Cortex — MCP Server Specification

## Overview

Cortex exposes a single MCP server that all clients connect to. Internally it fans out to backends. Clients never need to know which backend handled a query.

---

## Transport

### Default: stdio
Each client (Claude Desktop, Cursor) spawns Cortex as a subprocess via stdio. Simple, no port conflicts.

```json
{
  "mcpServers": {
    "cortex": {
      "command": "cortex",
      "args": ["mcp"]
    }
  }
}
```

### Optional: HTTP daemon mode
For shared memory across clients without spawning multiple processes:

```bash
cortex mcp --http             # localhost:7474
cortex mcp --http --daemon    # background daemon
cortex stop                   # stop daemon
```

Point all clients at `http://localhost:7474/mcp` — one process, shared state, shared cache.

**This is the recommended mode** once you have 2+ clients (Claude + Cursor). One daemon = consistent memory state across all tools.

---

## MCP Tools Exposed

### Memory Write

#### `memory_add`
Store a new memory. Cortex classifies and routes to appropriate backend(s).

```typescript
{
  content: string,        // The memory content
  type?: MemoryType,      // Optional hint: "preference" | "decision" | "fact" | "session"
  project?: string,       // Project scope (defaults to current working dir)
  tags?: string[],        // Optional tags for retrieval
  ttl?: number,           // Optional TTL in days (null = permanent)
}
```

#### `memory_update`
Update an existing memory by ID.

#### `memory_delete`
Delete a memory by ID.

---

### Memory Read

#### `memory_search`
Main retrieval tool. Cortex fans out to relevant backends and merges results.

```typescript
{
  query: string,
  mode?: "fast" | "semantic" | "hybrid",  // default: "hybrid"
  project?: string,
  limit?: number,                          // default: 10
  backends?: BackendName[],                // force specific backends
}
```

Returns:
```typescript
{
  results: MemoryResult[],
  backends_used: string[],
  latency_ms: number,
  from_cache: boolean,
}
```

#### `memory_get`
Retrieve a specific memory by ID.

#### `memory_list`
List memories with optional filters (type, project, date range, backend).

---

### Session Management

#### `session_start`
Called at conversation start. Returns bootstrapped context from all backends.

```typescript
// Returns:
{
  preferences: string,      // User coding preferences
  recent_decisions: string, // Last N project decisions
  current_task: string,     // Last known session state
  project_context: string,  // Key project facts
}
```

#### `session_checkpoint`
Save current session state (task, findings, decisions made).

#### `session_end`
Persist session summary to appropriate backends.

---

### System Tools

#### `cortex_status`
Returns health of all backends, routing stats, cache state.

#### `cortex_backends`
Lists configured backends and their capabilities.

#### `cortex_stats`
Returns memory stats — total memories, per-backend counts, query performance.

---

## Memory Result Schema

```typescript
interface MemoryResult {
  id: string
  content: string
  type: MemoryType
  backend: string           // which backend returned this
  score: number             // 0-1 relevance score
  created_at: string
  project?: string
  tags?: string[]
  source?: string           // file path if from QMD
}
```

---

## Client Setup Commands

```bash
cortex init --client claude     # writes to ~/Library/Application Support/Claude/claude_desktop_config.json
cortex init --client cursor     # writes to ~/.cursor/mcp.json
cortex init --client all        # all supported clients
```

---

## Supported Clients

| Client | Transport | Config Location |
|--------|-----------|----------------|
| Claude Desktop | stdio | `~/Library/.../claude_desktop_config.json` |
| Cursor | stdio | `~/.cursor/mcp.json` |
| Claude Code | stdio | `~/.claude/settings.json` |
| Windsurf | stdio | `.windsurf/mcp.json` |
| Any MCP client | HTTP | `http://localhost:7474/mcp` |
