/**
 * Browser test server — seeds a temp DB and starts the Hono dashboard
 * on port 3475 so Playwright can drive it.
 */
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Point all SQLite I/O to a fresh temp dir
const tmpDir = mkdtempSync(join(tmpdir(), "cortex-browser-test-"));
process.env._CORTEX_DATA_DIR_OVERRIDE = tmpDir;

// Seed example data
const { indexMemory } = await import("../../src/cache/sqlite.js");

const seeds = [
  { id: "s1", content: "Always use TypeScript",          type: "preference", tags: ["typescript"] },
  { id: "s2", content: "Use Bun as the runtime",         type: "decision",   tags: ["bun"] },
  { id: "s3", content: "PostgreSQL for primary DB",      type: "decision",   tags: ["database"] },
  { id: "s4", content: "React 18 with concurrent mode",  type: "fact",       tags: ["react"] },
  { id: "s5", content: "Prefer named exports",           type: "preference", tags: ["typescript", "modules"] },
  // Override chain: s6 superseded by s7
  { id: "s6", content: "Use CSS Modules",                type: "preference", tags: ["css"], status: "superseded" },
  { id: "s7", content: "Use Tailwind CSS",               type: "preference", tags: ["css"], supersedes_id: "s6" },
];

for (const s of seeds) {
  indexMemory({
    id: s.id,
    content: s.content,
    type: s.type as any,
    backend: "local",
    score: 0.9,
    created_at: new Date(),
    tags: s.tags,
    status: (s as any).status ?? "active",
    supersedes_id: (s as any).supersedes_id,
  });
}

// Start the dashboard server
const { buildApp } = await import("../../src/ui/web/server.js");
const app = buildApp([]);
Bun.serve({ port: 3475, fetch: app.fetch });

console.log("Test server ready on http://localhost:3475");
