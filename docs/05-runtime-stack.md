# Cortex — Local Runtime & Tech Stack

## How it Runs Locally

Cortex is designed to feel like infrastructure — install once, forget it's running, always there.

```
~/.cortex/
├── config.json          # main config
├── cortex.db            # SQLite — query cache, memory index, stats
├── logs/
│   └── cortex.log
└── sessions/            # session state files
```

---

## Daemon Architecture

```
cortex mcp --http --daemon
         │
         ▼
  cortex-daemon (background process)
  ├── MCP HTTP server     :7474
  ├── Web dashboard       :3474
  ├── Backend connectors
  │   ├── QMD adapter     (subprocess / HTTP)
  │   ├── OpenMemory      (HTTP → localhost:8765)
  │   └── ByteRover       (subprocess / MCP stdio)
  ├── Router
  ├── Merger
  ├── Cache (SQLite)
  └── Stats collector
```

When clients connect via stdio (non-daemon mode), each client spawns its own Cortex process — fine for one client, but the daemon is better for multiple clients sharing memory state.

---

## Tech Stack

### Language: TypeScript (Bun runtime)

**Why Bun:**
- Fast startup (<50ms) — critical for stdio MCP spawning
- Single binary distribution (via `bun build --compile`)
- Native SQLite support (no extra deps)
- Compatible with the QMD/lean-ctx ecosystem (both use Bun)
- npm-installable

**Why not Rust:**
- lean-ctx already does Rust well
- TS is faster to iterate on for routing logic
- Backend adapters are easier to write and test in TS

### Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",    // MCP server
    "better-sqlite3": "^9.0.0",              // local cache + stats
    "zod": "^3.0.0",                         // config + schema validation
    "chalk": "^5.0.0",                       // terminal colors
    "ora": "^8.0.0",                         // spinners
    "ink": "^5.0.0",                         // TUI dashboard (React for terminal)
    "boxen": "^7.0.0",                       // box-drawing for output
    "clipboardy": "^4.0.0",                  // copy to clipboard
    "chokidar": "^3.0.0"                     // file watching for QMD re-index
  }
}
```

### Dashboard: Ink (React for terminal)
Ink lets us build the full-screen TUI dashboard using React components — same mental model, renders to terminal. This is how we get lean-ctx-quality visuals without writing raw ANSI escape codes.

### Web Dashboard: Hono
Lightweight, fast HTTP server for the web dashboard at :3474. Static HTML + JSON API — no heavy framework needed.

---

## Configuration

### `cortex.config.json`

Lives at `~/.cortex/config.json`. Can also be project-local at `.cortex/config.json`.

```json
{
  "daemon": {
    "port": 7474,
    "dashboard_port": 3474,
    "auto_start": true
  },
  "backends": {
    "qmd": {
      "enabled": true,
      "binary": "qmd",
      "mode": "http",
      "port": 8181,
      "collections": ["notes", "work-docs", "current-project"]
    },
    "openmemory": {
      "enabled": true,
      "url": "http://localhost:8765",
      "user_id": "default"
    },
    "byterover": {
      "enabled": false,
      "binary": "brv"
    }
  },
  "routing": {
    "default_mode": "hybrid",
    "cache_ttl_seconds": 300,
    "merge_strategy": "score_weighted",
    "max_results": 10
  },
  "session": {
    "auto_checkpoint": true,
    "checkpoint_interval": 15,
    "bootstrap_on_start": true
  },
  "ui": {
    "theme": "dark",
    "timestamps": "relative",
    "show_scores": true,
    "show_backend_labels": true
  }
}
```

---

## Installation

### Via npm / bun (primary)
```bash
npm install -g @cortex-ai/cortex
# or
bun install -g @cortex-ai/cortex
```

### Via Homebrew (macOS)
```bash
brew tap codefishstudio/cortex
brew install cortex
```

### Via script
```bash
curl -fsSL https://cortex.codefishstudio.com/install.sh | sh
```

### First run
```bash
cortex setup
```

---

## Backend Prerequisites

Cortex is the router — backends must be installed separately:

| Backend | Install | Requirement |
|---------|---------|-------------|
| QMD | `npm install -g @tobilu/qmd` | Bun, ~2GB for models |
| OpenMemory | `git clone + docker compose up` | Docker, OpenAI key |
| ByteRover | `npm install -g @byterover/cli` | Node |

`cortex setup` detects which are installed and configures accordingly.
`cortex doctor` tells you exactly what's missing and how to fix it.

---

## Platforms

| Platform | Status |
|----------|--------|
| macOS (Apple Silicon) | ✓ Primary |
| macOS (Intel) | ✓ |
| Linux (x64) | ✓ |
| Linux (ARM64) | ✓ |
| Windows (WSL2) | ✓ |
| Windows (native) | Planned |

---

## Privacy & Security

- Zero telemetry. No data leaves your machine via Cortex.
- All routing decisions are local.
- Backend cloud sync (if any) is controlled by the backend's own config, not Cortex.
- Logs stored at `~/.cortex/logs/` — no external logging.
- SQLite cache is local, readable, deletable: `cortex cache clear`
