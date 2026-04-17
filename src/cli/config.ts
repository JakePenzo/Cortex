import { existsSync, readFileSync } from "fs";
import chalk from "chalk";
import { loadConfig, writeGlobalConfig, getConfigPath, ensureConfigDir } from "../config/loader.js";
import { DEFAULT_CONFIG } from "../config/defaults.js";
import { CortexConfigSchema } from "../config/schema.js";
import { c, bullet } from "../ui/output.js";

export async function runConfig(subcommand?: string, args?: string[]): Promise<void> {
  switch (subcommand) {
    case "init":
      return initConfig();
    case "set":
      return setConfig(args ?? []);
    default:
      return showConfig();
  }
}

function showConfig(): void {
  const path = getConfigPath();
  const config = loadConfig();
  console.log();
  console.log(c.header("  CORTEX CONFIG") + chalk.dim(`  —  ${path}`));
  console.log(chalk.dim("  " + "─".repeat(60)));
  console.log();
  console.log(JSON.stringify(config, null, 2).split("\n").map(l => "  " + l).join("\n"));
  console.log();
}

function initConfig(): void {
  ensureConfigDir();
  const path = getConfigPath();
  if (existsSync(path)) {
    console.log(`  ${bullet.warn} Config already exists at ${chalk.dim(path)}`);
    return;
  }
  writeGlobalConfig(DEFAULT_CONFIG);
  console.log(`  ${bullet.check} Created config at ${chalk.cyan(path)}`);
}

function setConfig(args: string[]): void {
  if (args.length < 2) {
    console.error(chalk.red("Usage: cortex config set <key.path> <value>"));
    return;
  }
  const [keyPath, rawValue] = args;
  const config = loadConfig();
  const value = parseValue(rawValue);

  setNestedValue(config as Record<string, unknown>, keyPath.split("."), value);

  const result = CortexConfigSchema.safeParse(config);
  if (!result.success) {
    console.error(chalk.red("Invalid config value:"), result.error.format());
    return;
  }
  writeGlobalConfig(result.data);
  console.log(`  ${bullet.check} Set ${chalk.cyan(keyPath)} = ${chalk.cyan(String(rawValue))}`);
}

function parseValue(v: string): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  const n = Number(v);
  if (!isNaN(n)) return n;
  return v;
}

function setNestedValue(obj: Record<string, unknown>, keys: string[], value: unknown): void {
  const [head, ...rest] = keys;
  if (!head) return;
  if (rest.length === 0) {
    obj[head] = value;
  } else {
    if (!obj[head] || typeof obj[head] !== "object") obj[head] = {};
    setNestedValue(obj[head] as Record<string, unknown>, rest, value);
  }
}
