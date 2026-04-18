```
                                                             
               :                                             
        .,    t#,                               ,;           
       ,Wt   ;##W.   j.                       f#i            
      i#D.  :#L:WE   EW,       GEEEEEEEL    .E#t             
     f#f   .KG  ,#D  E##j      ,;;L#K;;.   i#W,   :KW,      L
   .D#i    EE    ;#f E###D.       t#E     L#D.     ,#W:   ,KG
  :KW,    f#.     t#iE#jG#W;      t#E   :K#Wfff;    ;#W. jWi 
  t#f     :#G     GK E#t t##f     t#E   i##WLLLLt    i#KED.  
   ;#G     ;#L   LW. E#t  :K#E:   t#E    .E#L         L#W.   
    :KE.    t#f f#:  E#KDDDD###i  t#E      f#E:     .GKj#K.  
     .DW:    f#D#;   E#f,t#Wi,,,  t#E       ,WW;   iWf  i#K. 
       L#,    G#t    E#t  ;#W:    t#E        .D#; LK:    t#E 
        jt     t     DWi   ,KK:    fE          tt i       tDj
                                    :                        
```

# Cortex

Local-first memory router for AI coding tools. Runs as an MCP server that sits between your AI clients (Claude, Cursor, Copilot, Windsurf) and memory backends (QMD, OpenMemory, ByteRover). Your AI tools connect once; Cortex handles routing, merging, and caching.

## The Problem

Every AI session starts cold. You tell Claude you prefer TypeScript — it forgets. Cursor doesn't know what decisions were made last week. Copilot reinvents patterns you've already solved. Different tools can't share context because they don't share memory.

Cortex fixes this with a persistent, queryable memory layer that all your tools access. Preferences, decisions, code patterns, architectural choices — once stored, always available.

## How It Works

Cortex runs as a local MCP server. When you start an AI session, the client connects to Cortex once and gets access to all your memory through a unified interface:

- **memory_add** — write a memory (preference, decision, fact, session context, document)
- **memory_search** — semantic + keyword search across all backends
- **memory_list** — browse stored memories by type or tag
- **memory_delete** — remove a memory
- **cortex_status** — check backend health
- **cortex_backends** — list available backends

Behind the scenes, Cortex classifies each query and routes it intelligently:
- Keyword searches go to QMD (BM25 is fast)
- Preference recalls go to OpenMemory (designed for this)
- Semantic queries hit both backends in parallel and merge results
- Full bootstrap hits all backends to seed context at session start

All results get cached locally in SQLite, indexed, and deduplicated. Every AI tool reads from the same source of truth.

## Features

### MCP Server
- Standard Model Context Protocol — works with Claude, Cursor, Copilot, Windsurf, and any MCP-compatible tool
- Stdio transport (default, spawned per-session) and HTTP daemon mode (one server, many clients)
- Smart routing based on query type and backend availability
- Local SQLite cache for instant recalls, stats tracking, memory indexing

### CLI Tools
- **cortex** — animated intro showing current stats and recent memories
- **cortex setup** — guided backend installation and client configuration
- **cortex search <query>** — prettier results with backend breakdowns
- **cortex add <text>** — manual memory entry (with optional --type and --tags)
- **cortex seed** — load 26 example memories to demo the graph and override chains
- **cortex wipe** — clear all memories (requires typed confirmation)
- **cortex status** — real-time backend health dashboard
- **cortex doctor** — diagnose config, backends, client setup
- **cortex dashboard** — web dashboard at localhost:3474
- **cortex init --client <name>** — configure individual AI clients

### Web Dashboard
Force-directed knowledge graph powered by vis.js. Nodes represent memories; edges represent override chains and tag proximity. Side panel shows memory details, full edit/delete workflow, and override flow.

- Filter by type (preference, decision, fact, session, document)
- Inline edit with blur-to-save
- Override a belief: mark old as superseded, enter updated version, watch the graph animate the chain
- Search and status filter in the "All memories" tab
- Add new memories via type selector
- Auto-refresh every 5s

### Backends
- **QMD** — fast local BM25 semantic search (<50ms)
- **OpenMemory** — preference and session persistence via Docker
- **ByteRover** — distributed, team-shared memory (v0.4; stubbed in v0.1)

Mix and match backends. Cortex handles the plumbing.

## Tech Stack

**Bun** — runtime. Sub-50ms startup for stdio MCP (clients spawn it per-session). Native SQLite binding, TypeScript without transpilation, single-binary compile.

**MCP (Model Context Protocol)** — Anthropic's standard for tool use. Every major AI client supports it. Cortex exposes one server; clients don't know or care what backends exist.

**SQLite** — local cache, index, stats. Zero network dependency. ACID transactions, WAL mode for concurrent reads. Every memory written through any backend gets indexed locally.

**Hono** — web framework for dashboard API. Tiny, runs natively in Bun.

**vis.js Network** — force-directed knowledge graph. Obsidian-style layout for showing memory relationships and override chains.

**Zod** — runtime schema validation. TypeScript types derived from validators.

**chalk + ora** — CLI polish. Colored status cards, spinners, animated ASCII banner with idle glitch effect.

## Install

```bash
git clone https://github.com/codefishstudio/cortex.git
cd Cortex
bun install
bun link   # makes `cortex` available globally
cortex setup
```

Setup walks you through:
- Detecting installed backends
- Installing OpenMemory via Docker (if chosen)
- Configuring your AI clients (Claude, Cursor, etc.)
- Testing connections

## Quick Start

```bash
# Load example memories to see the graph in action
cortex seed

# Open the web dashboard
cortex dashboard
# Browser opens to http://localhost:3474

# View the animated intro with current stats
cortex

# Search your memories from the CLI
cortex search "TypeScript patterns"

# Add a memory manually
cortex add "We prefer Bun for CLI tools" --type preference

# Check backend health
cortex status

# See what's wired up
cortex doctor

# Run the terminal dashboard (real-time, live updates)
cortex dash

# Get help
cortex help
```

## Configure a Client

After `cortex setup`, clients are configured automatically. To manually add or reconfigure:

### Claude Desktop

Edit `~/.claude/claude_desktop_config.json`:

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

### Cursor

Edit `.cursor/mcp_config.json` in your project:

```json
{
  "mcpServers": [
    {
      "name": "cortex",
      "command": "cortex",
      "args": ["mcp"]
    }
  ]
}
```

### Claude Code

Same as Claude Desktop — it uses the same config file.

### Windsurf

Edit `~/.windsurf/mcp_config.json`:

```json
{
  "mcpServers": [
    {
      "name": "cortex",
      "command": "cortex",
      "args": ["mcp"]
    }
  ]
}
```

## Daemon Mode

Run Cortex as a background HTTP server so multiple clients can connect to a single instance:

```bash
# Start the daemon
cortex mcp --http --daemon

# Check it's running
cortex status

# Stop it
cortex stop
```

The daemon listens on port 7474 by default. Configure clients to connect via HTTP:

```json
{
  "mcpServers": {
    "cortex": {
      "type": "stdio",
      "command": "curl",
      "args": ["-N", "-X", "POST", "http://localhost:7474/sse", "-H", "Content-Type: application/json", "-d", "@-"]
    }
  }
}
```

(This is complex; stdio mode is simpler and recommended for single-client use.)

## Testing

Cortex includes 60+ tests covering MCP tools, HTTP endpoints, config loading, SQLite migrations, and the query cache.

```bash
# Run tests
bun test

# With coverage (enforced >= 80% per file)
bun test --coverage

# Playwright: browser-based dashboard tests
bun run test:browser

# All tests + coverage + browser
bun run test:all
```

## Roadmap

**v0.1** — MCP server, CLI, QMD + OpenMemory adapters, local SQLite cache, web dashboard (shipped)

**v0.2** — Knowledge graph, override chains, seed/wipe commands, inline editing (shipped)

**v0.3** — Session continuity: `session_start`, `session_checkpoint`, `session_end` tools to let AI maintain context across checkpoints

**v0.4** — ByteRover backend: distributed, team-shared memory so teams can build collective patterns

## Contributing

Cortex is open source and welcomes contributions. Areas looking for help:

- New backend adapters (Pinecone, Weaviate, Anthropic's memory service when it ships)
- Improved routing heuristics (smarter multi-backend merging)
- Dashboard features (export/import, memory lineage, tagging workflows)
- Client integration docs (more detailed setup for each tool)
- Performance optimizations (index schemas, caching strategies)

See the roadmap above and open an issue to discuss before starting major work.

## Configuration

Config file location: `~/.cortex/config.toml` (created during setup)

```toml
[backends.qmd]
enabled = true
path = "/usr/local/bin/qmd"

[backends.openmemory]
enabled = true
api_key = "sk-..."   # OpenAI key for embeddings
docker_image = "codefishstudio/openmemory:latest"

[backends.byterover]
enabled = false
# v0.4

[routing]
cache_ttl_seconds = 300
max_results = 25
default_mode = "hybrid"

[daemon]
port = 7474
dashboard_port = 3474
```

Use `cortex config` to view and edit:

```bash
cortex config                          # show current
cortex config init                     # create default
cortex config set backends.qmd.enabled false
```

## Troubleshooting

### Cortex commands not found
Make sure you ran `bun link` after install. Or add to your shell profile:

```bash
export PATH="$PATH:$(bun pm bin)"
```

### Backend says unavailable
Run `cortex doctor` to see what's missing. For OpenMemory, check:
- Docker is running
- OpenAI API key is set in config
- `cortex setup` to re-run guided setup

### Search returns empty
Try `cortex seed` to load example memories. If it still fails, check `cortex status` to see if backends are available, and check logs in `~/.cortex/logs/`.

### Dashboard won't load
Make sure `cortex dashboard` is running, and try http://localhost:3474 in your browser. Check for network errors in your browser's DevTools.

## License

MIT. See LICENSE for details.

## Credits

Built with care by the CodeFish team. Uses Model Context Protocol by Anthropic.
