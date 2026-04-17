import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { CortexConfigSchema, type CortexConfig } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";

const GLOBAL_CONFIG_DIR = join(homedir(), ".cortex");
const GLOBAL_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, "config.json");
const LOCAL_CONFIG_PATH = join(process.cwd(), ".cortex", "config.json");

export function loadConfig(): CortexConfig {
  const raw = loadRawConfig();
  const result = CortexConfigSchema.safeParse(raw);
  if (!result.success) {
    console.error("Invalid cortex config:", result.error.format());
    return DEFAULT_CONFIG;
  }
  return result.data;
}

function loadRawConfig(): unknown {
  // Project-local config overrides global
  if (existsSync(LOCAL_CONFIG_PATH)) {
    return mergeConfigs(
      readJsonFile(GLOBAL_CONFIG_PATH) ?? {},
      readJsonFile(LOCAL_CONFIG_PATH) ?? {}
    );
  }
  if (existsSync(GLOBAL_CONFIG_PATH)) {
    return readJsonFile(GLOBAL_CONFIG_PATH) ?? {};
  }
  return {};
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function mergeConfigs(base: unknown, override: unknown): unknown {
  if (typeof base !== "object" || base === null) return override;
  if (typeof override !== "object" || override === null) return base;
  return { ...(base as object), ...(override as object) };
}

export function ensureConfigDir(): void {
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
}

export function writeGlobalConfig(config: CortexConfig): void {
  ensureConfigDir();
  writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getConfigPath(): string {
  return existsSync(LOCAL_CONFIG_PATH) ? LOCAL_CONFIG_PATH : GLOBAL_CONFIG_PATH;
}

export function getDataDir(): string {
  return GLOBAL_CONFIG_DIR;
}
