import chalk from "chalk";
import { indexMemory } from "../cache/sqlite.js";

// Rich seed dataset — varied types, projects, tags, and some deliberate
// override chains so the knowledge graph shows connected nodes.
const SEEDS: Array<{
  content: string;
  type: string;
  tags: string[];
  project?: string;
  overrides?: number; // index of a previous seed this supersedes
}> = [
  // ── Preferences ─────────────────────────────────────────
  { content: "Always use TypeScript — never plain JavaScript",          type: "preference", tags: ["typescript", "code-style"] },
  { content: "Prefer named exports over default exports",               type: "preference", tags: ["code-style", "modules"] },
  { content: "React functional components only — no class components",  type: "preference", tags: ["react", "code-style"] },
  { content: "Tailwind CSS for styling — no CSS modules or styled-components", type: "preference", tags: ["css", "tailwind"] },
  { content: "Tests live in __tests__ folder adjacent to source files", type: "preference", tags: ["testing", "structure"] },
  { content: "Commits follow conventional commits (feat:, fix:, chore:)", type: "preference", tags: ["git", "workflow"] },
  { content: "Use kebab-case for file names, PascalCase for components", type: "preference", tags: ["code-style", "naming"] },
  { content: "Error messages must always include the action the user should take", type: "preference", tags: ["ux", "errors"] },
  { content: "Always write JSDoc for exported functions",               type: "preference", tags: ["code-style", "docs"] },
  // Override chain: old CSS preference superseded by Tailwind
  { content: "CSS Modules for component-scoped styles",                 type: "preference", tags: ["css", "code-style"] },
  // ↑ index 9 — will be superseded by index 3 below
  // Another override: old error style
  { content: "Use console.error for all errors in production",          type: "preference", tags: ["errors", "logging"] },
  // ↑ index 10 — superseded by structured logging

  // ── Decisions ──────────────────────────────────────────
  { content: "Use Bun as the runtime — faster startup and native SQLite", type: "decision", tags: ["runtime", "bun"] },
  { content: "Use Zod for all runtime validation and schema definitions", type: "decision", tags: ["validation", "zod"] },
  { content: "PostgreSQL for primary DB, SQLite for local dev/cache",   type: "decision", tags: ["database", "postgres"] },
  { content: "All API responses wrapped in { data, error } envelope",  type: "decision", tags: ["api", "patterns"] },
  { content: "Authentication via JWT — 7-day expiry, refresh tokens",  type: "decision", tags: ["auth", "security"] },
  { content: "Use pino for structured logging, not console.error",     type: "decision", tags: ["logging", "errors"], overrides: 10 },
  { content: "Deploy via Docker containers on Railway",                type: "decision", tags: ["deployment", "docker"] },
  { content: "API versioning with /v1/ prefix from day one",           type: "decision", tags: ["api", "versioning"] },

  // ── Facts ───────────────────────────────────────────────
  { content: "The project uses React 18 with concurrent features",     type: "fact",       tags: ["react", "project"] },
  { content: "API rate limiting: 100 req/min per user, 1000 per key",  type: "fact",       tags: ["api", "limits"] },
  { content: "Target bundle size: <200KB gzipped for initial load",    type: "fact",       tags: ["performance", "frontend"] },
  { content: "CI runs on GitHub Actions, deploys on push to main",     type: "fact",       tags: ["ci", "deployment"] },

  // ── Project-specific ────────────────────────────────────
  { content: "Cortex: MCP server listens on :7474 by default",        type: "fact",       tags: ["cortex", "config"],   project: "cortex" },
  { content: "Cortex: use bun:sqlite not better-sqlite3 in compiled binary", type: "decision", tags: ["cortex", "bun"], project: "cortex" },
  { content: "Cortex: backends are QMD (local) + OpenMemory (prefs)",  type: "fact",       tags: ["cortex", "backends"], project: "cortex" },
];

export async function runSeed(): Promise<void> {
  console.log();
  console.log("  " + chalk.hex("#ff6428").bold("CORTEX") + "  " + chalk.dim("seed"));
  console.log();

  const ids: string[] = [];
  let count = 0;

  for (let i = 0; i < SEEDS.length; i++) {
    const s = SEEDS[i];
    const id = `seed-${i.toString().padStart(3, "0")}`;
    ids.push(id);

    // If this seed overrides an earlier one, update that one first
    let supersedes_id: string | undefined;
    if (s.overrides !== undefined) {
      const oldId = ids[s.overrides];
      if (oldId) {
        supersedes_id = oldId;
        // Mark the old memory as superseded
        const { getMemoryById, updateMemoryContent } = await import("../cache/sqlite.js");
        try {
          const { db: _db, ...rest } = await import("../cache/sqlite.js") as any;
          // Use a direct DB query via the exposed indexMemory to update status
          indexMemory({
            id: oldId,
            content: SEEDS[s.overrides].content,
            type: SEEDS[s.overrides].type as any,
            backend: "local",
            score: 0,
            created_at: new Date(Date.now() - (SEEDS.length - s.overrides) * 60_000),
            tags: SEEDS[s.overrides].tags,
            project: SEEDS[s.overrides].project,
            status: "superseded",
          });
        } catch { /* ok */ }
      }
    }

    indexMemory({
      id,
      content: s.content,
      type: s.type as any,
      backend: "local",
      score: 0.85 + Math.random() * 0.15,
      // Stagger creation times so timeline looks interesting
      created_at: new Date(Date.now() - (SEEDS.length - i) * 3 * 60_000 * 60),
      tags: s.tags,
      project: s.project,
      status: "active",
      supersedes_id,
    });

    count++;
  }

  console.log(`  ${chalk.greenBright("✓")}  Added ${count} memories to local index`);
  console.log();
  console.log(chalk.dim("  Open the dashboard to explore them:  ") + chalk.hex("#ff6428")("cortex dashboard"));
  console.log();
}
