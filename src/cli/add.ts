import chalk from "chalk";
import { createBackends } from "../backends/factory.js";
import { loadConfig } from "../config/loader.js";
import { Dispatcher } from "../router/dispatcher.js";
import { indexMemory } from "../cache/sqlite.js";
import { c, bullet } from "../ui/output.js";
import type { MemoryType } from "../router/types.js";

interface AddOptions {
  type?: MemoryType;
  project?: string;
  tags?: string[];
}

export async function runAdd(content: string, opts: AddOptions = {}): Promise<void> {
  const config = loadConfig();
  const backends = createBackends(config);
  const dispatcher = new Dispatcher(backends, config.routing.cache_ttl_seconds, config.routing.max_results);

  const spinner = (await import("ora")).default("Storing memory...").start();

  try {
    const { id, backends_used } = await dispatcher.write({
      content,
      type: opts.type,
      project: opts.project,
      tags: opts.tags,
    });

    indexMemory({
      id,
      content,
      type: opts.type ?? "fact",
      backend: backends_used[0] ?? "local",
      score: 1,
      created_at: new Date(),
      project: opts.project,
      tags: opts.tags,
    });

    spinner.stop();
    console.log();
    console.log(`  ${bullet.check} Stored`);
    console.log(`  ${chalk.dim("id:")}      ${chalk.cyan(id)}`);
    console.log(`  ${chalk.dim("backends:")} ${backends_used.map(b => c.backend(b)(b)).join(", ") || chalk.dim("none")}`);
    if (opts.type) console.log(`  ${chalk.dim("type:")}    ${opts.type}`);
    console.log();
  } catch (err) {
    spinner.fail("Failed to store memory");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }
}
