# Cortex — CLI Design

## Philosophy

The CLI is the primary interface for humans. It should be:
- **Beautiful** — rich terminal output, colors, box drawing, ASCII charts
- **Fast** — commands feel instant
- **Informative** — always show what's happening, what's connected, what's saved
- **Discoverable** — `cortex help` teaches you everything

Inspired heavily by lean-ctx's terminal UX.

---

## Command Structure

```
cortex <command> [subcommand] [flags]
```

---

## Setup & Configuration

```bash
# One-command setup — installs daemon, detects backends, configures clients
cortex setup

# Init specific clients
cortex init --client claude
cortex init --client cursor  
cortex init --client all

# Show/edit config
cortex config
cortex config init          # create default cortex.config.json
cortex config set qmd.enabled true

# Diagnostics
cortex doctor               # checks backends, clients, config, paths
```

### `cortex setup` output:
```
  ╔═══════════════════════════════════════╗
  ║           CORTEX  SETUP               ║
  ╚═══════════════════════════════════════╝

  Detecting backends...
    ✓ QMD         found at /usr/local/bin/qmd (v2.3.1)
    ✓ OpenMemory  running at localhost:8765
    ✗ ByteRover   not found  →  run: npm install -g @byterover/cli

  Configuring clients...
    ✓ Claude Desktop  →  ~/Library/.../claude_desktop_config.json
    ✓ Cursor          →  ~/.cursor/mcp.json

  Starting daemon...
    ✓ cortex daemon  →  localhost:7474

  Done in 1.2s. Run `cortex status` to verify.
```

---

## Status & Monitoring

```bash
cortex status               # backend health + connected clients
cortex status --watch       # live-updating status
cortex stats                # memory counts, query performance
```

### `cortex status` output:
```
  CORTEX  v0.1.0  ·  daemon running (pid 38291)  ·  localhost:7474

  BACKENDS
  ─────────────────────────────────────────────
  ● QMD          ✓ running   9,234 docs indexed   42ms avg
  ● OpenMemory   ✓ running   312 memories          18ms avg
  ○ ByteRover    ✗ offline   —                     routing to QMD

  CLIENTS
  ─────────────────────────────────────────────
  ● Claude Desktop   connected   last query: 2m ago
  ● Cursor           connected   last query: 8m ago

  TODAY
  ─────────────────────────────────────────────
  Queries: 47    Writes: 12    Cache hits: 31 (66%)
  Avg latency: 38ms    Backends saved: 2.1s total
```

---

## Memory Management

```bash
# Search your memories
cortex search "auth decisions"
cortex search "typescript preferences" --backend openmemory
cortex search "deploy process" --project myapp

# Add a memory manually
cortex add "We use Zod for all runtime validation"
cortex add "Prefer named exports over default exports" --type preference

# List memories
cortex list
cortex list --type decision
cortex list --project myapp --since 7d

# View a specific memory
cortex get <id>

# Delete
cortex delete <id>
```

### `cortex search "auth"` output:
```
  Searching: "auth"  [hybrid mode]  ·  3 backends  ·  44ms

  ┌─ OpenMemory ──────────────────────────────────────────┐
  │ [decision] We use JWT with 24h expiry + refresh tokens │
  │ project: api-service  ·  3 days ago  ·  score: 0.94   │
  └───────────────────────────────────────────────────────┘

  ┌─ ByteRover ───────────────────────────────────────────┐
  │ [fact] Auth service at /apps/auth, port 3001           │
  │ project: api-service  ·  1 week ago  ·  score: 0.88   │
  └───────────────────────────────────────────────────────┘

  ┌─ QMD ─────────────────────────────────────────────────┐
  │ docs/auth.md · line 42                                 │
  │ "...middleware validates token via verifyJWT()..."     │
  │ score: 0.81                                            │
  └───────────────────────────────────────────────────────┘

  3 results from 3 backends  ·  44ms
```

---

## Dashboard

```bash
cortex dash                 # terminal dashboard (full-screen TUI)
cortex dash --live          # auto-refreshing
cortex dashboard            # web dashboard at localhost:3474
```

### Terminal dashboard sections:
- **Backend health** — live status of each backend
- **Query activity** — real-time query log with latency
- **Memory graph** — memories added over time (ASCII bar chart)
- **Top queries** — most frequent queries (cache candidates)
- **Recent memories** — last 10 written memories

---

## Indexing (QMD)

```bash
# Index directories into QMD collections
cortex index ~/notes --name notes
cortex index ~/work/docs --name work-docs
cortex index . --name current-project

# Rebuild embeddings
cortex index --rebuild

# List collections
cortex index --list
```

---

## Session Tools

```bash
cortex session              # show current session state
cortex session list         # list recent sessions
cortex session save         # checkpoint current session
cortex session resume <id>  # load a past session into context
```

---

## Backend Management

```bash
cortex backends             # list configured backends + status
cortex backends add qmd     # add/configure a backend
cortex backends test        # test all backend connections
```

---

## Utility

```bash
cortex update               # self-update
cortex version              # version info + changelog link  
cortex help                 # full help
cortex cheatsheet           # quick reference card (pretty-printed)
```

### `cortex cheatsheet` output:
```
  CORTEX QUICK REFERENCE
  ══════════════════════════════════════════════════

  SETUP          cortex setup · cortex init --client all
  STATUS         cortex status · cortex dash --live
  SEARCH         cortex search "<query>"
  ADD            cortex add "<memory>"
  INDEX          cortex index <path> --name <name>
  CLIENTS        Claude + Cursor auto-configured via MCP

  DAEMON         cortex mcp --http --daemon
  STOP           cortex stop

  ══════════════════════════════════════════════════
  docs: github.com/codefishstudio/cortex
```

---

## Output Styling

- Box-drawing characters for result cards (─ │ ┌ ┐ └ ┘)
- Color scheme: cyan for headers, green for success, yellow for warnings, red for errors, dim for metadata
- Scores displayed as decimals (0.94) not percentages
- Timestamps as human-relative ("3 days ago", "2m ago")
- Backend names always color-coded consistently across all commands
