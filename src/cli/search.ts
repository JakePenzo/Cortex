import chalk from "chalk";
import { createBackends } from "../backends/factory.js";
import { loadConfig } from "../config/loader.js";
import { Dispatcher } from "../router/dispatcher.js";
import { c, card, relativeTime, bullet } from "../ui/output.js";
import type { MemoryResult } from "../router/types.js";

interface SearchOptions {
  backend?: string;
  project?: string;
  mode?: "fast" | "semantic" | "hybrid";
  limit?: number;
}

export async function runSearch(query: string, opts: SearchOptions = {}): Promise<void> {
  const config = loadConfig();
  const backends = createBackends(config);
  const dispatcher = new Dispatcher(backends, config.routing.cache_ttl_seconds, config.routing.max_results);

  const spinner = (await import("ora")).default(`Searching: "${query}"  [${opts.mode ?? "hybrid"} mode]`).start();

  const result = await dispatcher.search({
    query,
    mode: opts.mode ?? config.routing.default_mode,
    project: opts.project,
    limit: opts.limit ?? config.routing.max_results,
    backends: opts.backend ? [opts.backend] : undefined,
  });

  spinner.stop();

  if (result.results.length === 0) {
    console.log(chalk.dim(`\n  No results for "${query}"\n`));
    return;
  }

  const cacheLabel = result.from_cache ? chalk.dim(" [cached]") : "";
  console.log();
  console.log(
    chalk.dim(`  Searching: `) + chalk.cyan(`"${query}"`) +
    chalk.dim(`  [${opts.mode ?? "hybrid"} mode]  ·  `) +
    chalk.dim(`${result.backends_used.length} backends  ·  `) +
    chalk.cyan(`${result.latency_ms}ms`) + cacheLabel
  );
  console.log();

  // Group results by backend
  const byBackend = new Map<string, MemoryResult[]>();
  for (const r of result.results) {
    if (!byBackend.has(r.backend)) byBackend.set(r.backend, []);
    byBackend.get(r.backend)!.push(r);
  }

  for (const [backendName, results] of byBackend) {
    const backendColor = c.backend(backendName);
    for (const r of results) {
      const lines = [
        chalk.white(truncate(r.content, 80)),
        chalk.dim(
          [
            r.type ? `[${r.type}]` : null,
            r.project ? `project: ${r.project}` : null,
            relativeTime(r.created_at),
            `score: ${r.score.toFixed(2)}`,
            r.source ? `  ${r.source}` : null,
          ].filter(Boolean).join("  ·  ")
        ),
      ];

      console.log(card(backendName, lines, backendColor));
      console.log();
    }
  }

  console.log(chalk.dim(`  ${result.results.length} result(s) from ${result.backends_used.join(", ") || "cache"}  ·  ${result.latency_ms}ms`));
  console.log();
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}
