import { Database } from "bun:sqlite";
import { join } from "path";
import { getDataDir, ensureConfigDir } from "../config/loader.js";
import type { MemoryResult } from "../router/types.js";

let _db: Database | null = null;

function db(): Database {
  if (!_db) {
    ensureConfigDir();
    _db = new Database(join(getDataDir(), "cortex.db"));
    _db.exec("PRAGMA journal_mode = WAL;");
    migrate(_db);
  }
  return _db;
}

function migrate(d: Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS query_cache (
      hash TEXT PRIMARY KEY,
      results TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      backend TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS stats_created_at ON stats(created_at);

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      backend TEXT NOT NULL,
      project TEXT,
      tags TEXT,
      source TEXT,
      score REAL DEFAULT 0,
      created_at INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      supersedes_id TEXT
    );

    CREATE INDEX IF NOT EXISTS memories_created_at ON memories(created_at);
    CREATE INDEX IF NOT EXISTS memories_backend ON memories(backend);
    CREATE INDEX IF NOT EXISTS memories_type ON memories(type);
  `);

  // Non-destructive column additions for existing DBs — must run BEFORE
  // any query that references these columns (including index creation).
  const existing = new Set(
    (d.query("PRAGMA table_info(memories)").all() as Array<{ name: string }>).map(r => r.name)
  );
  if (!existing.has("status"))
    d.exec("ALTER TABLE memories ADD COLUMN status TEXT DEFAULT 'active'");
  if (!existing.has("supersedes_id"))
    d.exec("ALTER TABLE memories ADD COLUMN supersedes_id TEXT");

  // Now safe to create indexes that reference the new columns
  d.exec(`
    CREATE INDEX IF NOT EXISTS memories_status ON memories(status);
  `);
}

// ── Cache ────────────────────────────────────────────────────
export function getCached(hash: string): MemoryResult[] | null {
  const row = db().query(
    "SELECT results FROM query_cache WHERE hash = ? AND expires_at > ?"
  ).get(hash, Date.now()) as { results: string } | null;
  return row ? JSON.parse(row.results) : null;
}

export function setCache(hash: string, results: MemoryResult[], ttlSeconds: number): void {
  const now = Date.now();
  db().query(
    "INSERT OR REPLACE INTO query_cache (hash, results, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(hash, JSON.stringify(results), now, now + ttlSeconds * 1000);
}

export function invalidateCache(): void {
  db().query("DELETE FROM query_cache WHERE expires_at <= ?").run(Date.now());
}

// ── Stats ────────────────────────────────────────────────────
export function recordStat(type: "query" | "write", backend: string, latency_ms: number): void {
  db().query(
    "INSERT INTO stats (type, backend, latency_ms, created_at) VALUES (?, ?, ?, ?)"
  ).run(type, backend, latency_ms, Date.now());
}

export interface DayStats {
  queries: number;
  writes: number;
  cache_hits: number;
  avg_latency_ms: number;
  backends_used: string[];
}

export function getTodayStats(): DayStats {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const ts = startOfDay.getTime();

  const rows = db().query(
    "SELECT type, backend, latency_ms FROM stats WHERE created_at >= ?"
  ).all(ts) as { type: string; backend: string; latency_ms: number }[];

  const queries  = rows.filter(r => r.type === "query").length;
  const writes   = rows.filter(r => r.type === "write").length;
  const avg      = rows.length ? Math.round(rows.reduce((s, r) => s + r.latency_ms, 0) / rows.length) : 0;
  const backends = [...new Set(rows.map(r => r.backend))];

  const cacheRow = db().query(
    "SELECT COUNT(*) as c FROM query_cache WHERE created_at >= ? AND expires_at > ?"
  ).get(ts, Date.now()) as { c: number };

  return { queries, writes, cache_hits: cacheRow.c, avg_latency_ms: avg, backends_used: backends };
}

// ── Memory index ─────────────────────────────────────────────
export function indexMemory(result: MemoryResult & { status?: string; supersedes_id?: string }): void {
  db().query(`
    INSERT OR REPLACE INTO memories
      (id, content, type, backend, project, tags, source, score, created_at, status, supersedes_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    result.id,
    result.content,
    result.type,
    result.backend,
    result.project ?? null,
    result.tags ? JSON.stringify(result.tags) : null,
    result.source ?? null,
    result.score,
    result.created_at.getTime(),
    result.status ?? "active",
    result.supersedes_id ?? null,
  );
}

export function getRecentMemories(limit = 10): MemoryResult[] {
  const rows = db().query(
    "SELECT * FROM memories ORDER BY created_at DESC LIMIT ?"
  ).all(limit) as any[];
  return rows.map(rowToMemory);
}

export function getAllMemories(): Array<MemoryResult & { status: string; supersedes_id: string | null }> {
  const rows = db().query(
    "SELECT * FROM memories ORDER BY created_at DESC"
  ).all() as any[];
  return rows.map(r => ({ ...rowToMemory(r), status: r.status ?? "active", supersedes_id: r.supersedes_id ?? null }));
}

export function getMemoryById(id: string): (MemoryResult & { status: string; supersedes_id: string | null }) | null {
  const row = db().query("SELECT * FROM memories WHERE id = ?").get(id) as any | null;
  if (!row) return null;
  return { ...rowToMemory(row), status: row.status ?? "active", supersedes_id: row.supersedes_id ?? null };
}

export function overrideMemory(oldId: string, newMemory: MemoryResult): void {
  // Mark old as superseded
  db().query("UPDATE memories SET status = 'superseded' WHERE id = ?").run(oldId);
  // Index new memory pointing back to old
  indexMemory({ ...newMemory, status: "active", supersedes_id: oldId });
}

export function updateMemoryContent(id: string, content: string): void {
  db().query("UPDATE memories SET content = ? WHERE id = ?").run(content, id);
}

export function deleteMemoryFromIndex(id: string): void {
  db().query("DELETE FROM memories WHERE id = ?").run(id);
}

export function wipeAllMemories(): number {
  const count = (db().query("SELECT COUNT(*) as c FROM memories").get() as { c: number }).c;
  db().exec("DELETE FROM memories; DELETE FROM query_cache; DELETE FROM stats;");
  return count;
}

export function getMemoryCount(): number {
  return (db().query("SELECT COUNT(*) as c FROM memories WHERE status = 'active'").get() as { c: number }).c;
}

function rowToMemory(row: any): MemoryResult {
  return {
    id: row.id,
    content: row.content,
    type: row.type,
    backend: row.backend,
    score: row.score ?? 0,
    created_at: new Date(row.created_at),
    project: row.project ?? undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    source: row.source ?? undefined,
  };
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
