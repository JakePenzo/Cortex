import chalk from "chalk";
import { createBackends } from "../backends/factory.js";
import { loadConfig } from "../config/loader.js";
import { getTodayStats } from "../cache/sqlite.js";
import { c, bullet, relativeTime } from "../ui/output.js";

export async function runStatus(watch = false): Promise<void> {
  if (watch) {
    const render = async () => { process.stdout.write("\x1Bc"); await printStatus(); };
    await render();
    setInterval(render, 2000);
  } else {
    await printStatus();
  }
}

async function printStatus(): Promise<void> {
  const config = loadConfig();
  const backends = createBackends(config);

  console.log();
  console.log(
    c.header("  CORTEX") + chalk.dim(`  v0.1.0  ·  `) +
    chalk.dim("localhost:") + chalk.cyan(`${config.daemon.port}`)
  );
  console.log();

  // ── Backends ──────────────────────────────────────────────────
  console.log(c.header("  BACKENDS"));
  console.log(chalk.dim("  " + "─".repeat(60)));

  const stats = await Promise.all(backends.map(b => b.stats()));
  for (const s of stats) {
    const dot = s.available ? bullet.ok : bullet.warn;
    const name = (s.available ? c.accent : chalk.dim)(s.name.padEnd(14));
    const status = s.available ? c.success("✓ running") : chalk.dim("✗ offline");
    const count = s.available ? chalk.dim(`${s.total_memories.toLocaleString()} memories`) : chalk.dim("—");
    const latency = s.available && s.avg_latency_ms > 0 ? chalk.dim(`${s.avg_latency_ms}ms avg`) : "";
    const version = s.version ? chalk.dim(`(${s.version})`) : "";
    console.log(`  ${dot} ${name} ${status.padEnd(12)}  ${count.padEnd(20)} ${latency} ${version}`);
  }

  if (backends.length === 0) {
    console.log(chalk.dim("  No backends configured. Run `cortex setup`."));
  }
  console.log();

  // ── Today's stats ─────────────────────────────────────────────
  const day = getTodayStats();
  console.log(c.header("  TODAY"));
  console.log(chalk.dim("  " + "─".repeat(60)));
  const cacheRate = day.queries > 0 ? Math.round((day.cache_hits / day.queries) * 100) : 0;
  console.log(
    `  Queries: ${chalk.cyan(day.queries)}` +
    `    Writes: ${chalk.cyan(day.writes)}` +
    `    Cache hits: ${chalk.cyan(day.cache_hits)} ${chalk.dim(`(${cacheRate}%)`)}` +
    `    Avg latency: ${chalk.cyan(day.avg_latency_ms + "ms")}`
  );
  console.log();
}
