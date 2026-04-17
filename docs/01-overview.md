# Cortex — Architecture Overview

## What is Cortex?

Cortex is a **local-first memory router** for AI coding tools. It sits between your AI clients (Claude, Cursor, etc.) and multiple memory backends (QMD, OpenMemory, ByteRover), acting as a single unified MCP server that intelligently routes queries to the right backend and merges results.

Think of it as a memory operating system — you never talk to a backend directly. You talk to Cortex.

```
┌─────────────────────────────────────────────┐
│              AI Clients                     │
│   Claude Desktop  ·  Cursor  ·  Claude Code │
└────────────────┬────────────────────────────┘
                 │  MCP protocol
                 ▼
┌─────────────────────────────────────────────┐
│                 CORTEX                      │
│         Memory Router & Daemon              │
│                                             │
│  ┌──────────┐  ┌─────────┐  ┌───────────┐  │
│  │  Router  │  │ Merger  │  │  Monitor  │  │
│  └──────────┘  └─────────┘  └───────────┘  │
└──────┬──────────────┬───────────────┬───────┘
       │              │               │
       ▼              ▼               ▼
   ┌───────┐    ┌──────────┐   ┌───────────┐
   │  QMD  │    │OpenMemory│   │ ByteRover │
   └───────┘    └──────────┘   └───────────┘
   fast local   cross-session   project/team
   text+vector  preferences     context
```

---

## Core Principles

**1. Local-first**
Everything runs on your machine. No telemetry. No cloud unless you explicitly push to one of the backends' optional cloud sync.

**2. Backend-agnostic**
Backends are pluggable adapters. Run with just QMD, all three, or any combination. Cortex degrades gracefully if a backend is unavailable.

**3. Single surface**
One MCP config. One CLI. One dashboard. One place to manage everything across all your AI tools.

**4. Intelligent routing**
Cortex classifies each memory operation and directs it to the best backend — not just round-robin or broadcast.

**5. Great DX**
Beautiful CLI with live dashboards, ASCII charts, doctor diagnostics. Inspired by lean-ctx's terminal UX. Setup in under 2 minutes.

---

## The Memory Problem

AI tools are amnesiac by default:

- Every new Claude session starts blank
- Cursor and Claude don't share context
- Your coding preferences, decisions, project patterns — all re-explained every time
- Existing tools (QMD, OpenMemory, ByteRover) each solve a slice of this but require manual wiring

Cortex solves this by being the single memory layer every tool connects to — and by routing intelligently so each backend does what it's actually good at.

---

## What Cortex is NOT

- Not a replacement for QMD, OpenMemory, or ByteRover — it orchestrates them
- Not a vector database itself
- Not a cloud service
- Not an AI agent or LLM wrapper
- Not a context compression tool (that's lean-ctx's job — Cortex can sit alongside it)
