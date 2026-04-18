import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { CortexConfigSchema, type CortexConfig } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";

const GLOBAL_CONFIG_DIR = join(homedir(), ".cortex");

// ── Dynamic path helpers (respect _CORTEX_DATA_DIR_OVERRIDE) ──
export function getDataDir(): string {
  return process.env._CORTEX_DATA_DIR_OVERRIDE ?? GLOBAL_CONFIG_DIR;
}

function globalConfigPath(): string {
  return join(getDataDir(), "config.json");
}

// Local project config: .cortex/config.json relative to cwd
const LOCAL_CONFIG_PATH = join(process.cwd(), ".cortex", "config.json");

// ── Public API ─────────────────────────────────────────────────
export function loadConfig(): CortexConfig {
  const raw = loadRawConfig();
  const result = CortexConfigSchema.safeParse(raw);
  if (!result.success) {
    console.error("Invalid cortex config:", result.error.format());
    return DEFAULT_CONFIG;
  }
  return result.data;
}

export function ensureConfigDir(): void {
  const dir = getDataDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function writeGlobalConfig(config: CortexConfig): void {
  ensureConfigDir();
  writeFileSync(globalConfigPath(), JSON.stringify(config, null, 2));
}

export function getConfigPath(): string {
  return existsSync(LOCAL_CONFIG_PATH) ? LOCAL_CONFIG_PATH : globalConfigPath();
}

// ── Internal helpers ───────────────────────────────────────────
function loadRawConfig(): unknown {
  // Project-local config overrides global
  if (existsSync(LOCAL_CONFIG_PATH)) {
    return mergeConfigs(
      readJsonFile(globalConfigPath()) ?? {},
      readJsonFile(LOCAL_CONFIG_PATH) ?? {}
    );
  }
  const global = globalConfigPath();
  if (existsSync(global)) {
    return readJsonFile(global) ?? {};
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
