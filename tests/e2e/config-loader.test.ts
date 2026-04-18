/**
 * E2E: config/loader — getDataDir override, ensureConfigDir, loadConfig, writeGlobalConfig
 * All file I/O is redirected to a temp dir via _CORTEX_DATA_DIR_OVERRIDE.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "fs";
import { tmpdir, homedir } from "os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cortex-cfg-test-"));
  process.env._CORTEX_DATA_DIR_OVERRIDE = tmpDir;
  (globalThis as any).__cortexDbReset?.();
});

afterEach(() => {
  (globalThis as any).__cortexDbReset?.();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env._CORTEX_DATA_DIR_OVERRIDE;
});

// ── getDataDir ─────────────────────────────────────────────────
describe("getDataDir", () => {
  it("returns the override path when env var is set", async () => {
    const { getDataDir } = await import("../../src/config/loader.js");
    expect(getDataDir()).toBe(tmpDir);
  });

  it("returns ~/.cortex when override is not set", async () => {
    delete process.env._CORTEX_DATA_DIR_OVERRIDE;
    const { getDataDir } = await import("../../src/config/loader.js");
    expect(getDataDir()).toBe(join(homedir(), ".cortex"));
    process.env._CORTEX_DATA_DIR_OVERRIDE = tmpDir; // restore for cleanup
  });
});

// ── ensureConfigDir ────────────────────────────────────────────
describe("ensureConfigDir", () => {
  it("creates the data dir if it does not exist", async () => {
    const subDir = join(tmpDir, "nested");
    process.env._CORTEX_DATA_DIR_OVERRIDE = subDir;

    const { ensureConfigDir } = await import("../../src/config/loader.js");
    expect(existsSync(subDir)).toBe(false);
    ensureConfigDir();
    expect(existsSync(subDir)).toBe(true);

    process.env._CORTEX_DATA_DIR_OVERRIDE = tmpDir;
  });

  it("does not throw if dir already exists", async () => {
    const { ensureConfigDir } = await import("../../src/config/loader.js");
    expect(() => ensureConfigDir()).not.toThrow();
  });
});

// ── loadConfig ─────────────────────────────────────────────────
describe("loadConfig", () => {
  it("returns defaults when no config file exists", async () => {
    const { loadConfig } = await import("../../src/config/loader.js");
    const cfg = loadConfig();
    expect(cfg.daemon.port).toBe(7474);
    expect(cfg.routing.cache_ttl_seconds).toBe(300);
    expect(cfg.routing.default_mode).toBe("hybrid");
  });

  it("loads and merges values from global config file", async () => {
    // Write a partial config into the temp data dir (which is the override)
    writeFileSync(
      join(tmpDir, "config.json"),
      JSON.stringify({ daemon: { port: 9999 } })
    );
    const { loadConfig } = await import("../../src/config/loader.js");
    const cfg = loadConfig();
    expect(cfg.daemon.port).toBe(9999);
    // Other defaults still present
    expect(cfg.routing.default_mode).toBe("hybrid");
  });

  it("falls back to DEFAULT_CONFIG when config file has invalid JSON", async () => {
    writeFileSync(join(tmpDir, "config.json"), "{ not valid json }}}");
    const { loadConfig } = await import("../../src/config/loader.js");
    // safeParse will fail → falls back to DEFAULT_CONFIG (port 7474)
    const cfg = loadConfig();
    // Invalid JSON → readJsonFile returns null → loadRawConfig returns {}
    // {} parses fine with all defaults
    expect(cfg.daemon.port).toBe(7474);
  });

  it("config has the expected nested shape", async () => {
    const { loadConfig } = await import("../../src/config/loader.js");
    const cfg = loadConfig();
    expect(typeof cfg.daemon.port).toBe("number");
    expect(typeof cfg.backends.qmd.enabled).toBe("boolean");
    expect(typeof cfg.backends.openmemory.url).toBe("string");
    expect(typeof cfg.routing.max_results).toBe("number");
  });
});

// ── writeGlobalConfig ──────────────────────────────────────────
describe("writeGlobalConfig", () => {
  it("writes config to the data dir and can be read back", async () => {
    const { writeGlobalConfig, loadConfig } = await import("../../src/config/loader.js");
    const { DEFAULT_CONFIG } = await import("../../src/config/defaults.js");

    // Write a modified config
    const modified = {
      ...DEFAULT_CONFIG,
      daemon: { ...DEFAULT_CONFIG.daemon, port: 8888 },
    };
    writeGlobalConfig(modified);

    // Verify the file was written to the override dir
    const cfgFile = join(tmpDir, "config.json");
    expect(existsSync(cfgFile)).toBe(true);

    // Load it back
    const loaded = loadConfig();
    expect(loaded.daemon.port).toBe(8888);
  });
});

// ── getConfigPath ──────────────────────────────────────────────
describe("getConfigPath", () => {
  it("returns the global config path (in override dir) when no local config exists", async () => {
    const { getConfigPath } = await import("../../src/config/loader.js");
    expect(getConfigPath()).toBe(join(tmpDir, "config.json"));
  });
});
