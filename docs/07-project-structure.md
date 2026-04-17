# Cortex — Project Structure

## Repository Layout

```
cortex/
├── README.md
├── package.json
├── bunfig.toml
├── tsconfig.json
│
├── src/
│   ├── index.ts                  # CLI entry point
│   │
│   ├── cli/                      # CLI commands
│   │   ├── setup.ts
│   │   ├── status.ts
│   │   ├── search.ts
│   │   ├── add.ts
│   │   ├── init.ts
│   │   ├── doctor.ts
│   │   ├── dash.ts
│   │   ├── session.ts
│   │   └── index.ts              # command registry
│   │
│   ├── mcp/                      # MCP server
│   │   ├── server.ts             # MCP server setup
│   │   ├── tools/
│   │   │   ├── memory-add.ts
│   │   │   ├── memory-search.ts
│   │   │   ├── memory-list.ts
│   │   │   ├── memory-delete.ts
│   │   │   ├── session-start.ts
│   │   │   ├── session-checkpoint.ts
│   │   │   └── cortex-status.ts
│   │   └── transport/
│   │       ├── stdio.ts
│   │       └── http.ts
│   │
│   ├── router/                   # Routing logic
│   │   ├── classifier.ts         # classify query → operation type
│   │   ├── dispatcher.ts         # fan out to backends
│   │   ├── merger.ts             # merge + deduplicate results
│   │   └── types.ts
│   │
│   ├── backends/                 # Backend adapters
│   │   ├── base.ts               # BackendAdapter interface
│   │   ├── qmd/
│   │   │   ├── adapter.ts
│   │   │   ├── client.ts         # QMD MCP/CLI client
│   │   │   └── types.ts
│   │   ├── openmemory/
│   │   │   ├── adapter.ts
│   │   │   ├── client.ts         # OpenMemory HTTP client
│   │   │   └── types.ts
│   │   └── byterover/
│   │       ├── adapter.ts
│   │       ├── client.ts
│   │       └── types.ts
│   │
│   ├── ui/                       # Terminal UI
│   │   ├── dashboard/            # Ink TUI components
│   │   │   ├── App.tsx
│   │   │   ├── BackendPanel.tsx
│   │   │   ├── QueryLog.tsx
│   │   │   ├── StatsPanel.tsx
│   │   │   └── MemoryList.tsx
│   │   ├── web/                  # Web dashboard
│   │   │   ├── server.ts         # Hono server
│   │   │   └── public/
│   │   └── output.ts             # Shared pretty-print utilities
│   │
│   ├── cache/
│   │   └── sqlite.ts             # Query cache + stats store
│   │
│   ├── config/
│   │   ├── schema.ts             # Zod schema
│   │   ├── loader.ts
│   │   └── defaults.ts
│   │
│   └── daemon/
│       ├── manager.ts            # Start/stop/restart daemon
│       └── service.ts            # launchd/systemd service files
│
├── tests/
│   ├── router/
│   ├── backends/
│   └── mcp/
│
└── docs/                         # (copy of cortex-docs/)
    ├── 01-overview.md
    ├── 02-routing.md
    ├── 03-mcp-spec.md
    ├── 04-cli-design.md
    ├── 05-runtime-stack.md
    └── 06-roadmap.md
```

---

## Key Interfaces

### BackendAdapter

Every backend implements this interface:

```typescript
interface BackendAdapter {
  name: string
  isAvailable(): Promise<boolean>
  search(query: SearchQuery): Promise<MemoryResult[]>
  add(memory: MemoryInput): Promise<string>          // returns ID
  get(id: string): Promise<MemoryResult | null>
  delete(id: string): Promise<void>
  list(filter?: ListFilter): Promise<MemoryResult[]>
  stats(): Promise<BackendStats>
}
```

### MemoryResult

```typescript
interface MemoryResult {
  id: string
  content: string
  type: 'preference' | 'decision' | 'fact' | 'session' | 'document'
  backend: string
  score: number           // 0-1
  created_at: Date
  project?: string
  tags?: string[]
  source?: string         // file path (QMD)
  metadata?: Record<string, unknown>
}
```

### Router

```typescript
interface RouterConfig {
  backends: BackendAdapter[]
  strategy: 'fast' | 'semantic' | 'hybrid'
}

class Router {
  classify(query: string): OperationType
  dispatch(op: MemoryOperation): Promise<MemoryResult[]>
  merge(results: MemoryResult[][]): MemoryResult[]
}
```

---

## Dev Setup

```bash
git clone https://github.com/codefishstudio/cortex
cd cortex
bun install
bun run dev          # watch mode
bun run build        # compile single binary
bun test             # run tests
```

### Local binary link for testing:
```bash
bun run build
ln -s $(pwd)/dist/cortex /usr/local/bin/cortex
cortex setup
```
