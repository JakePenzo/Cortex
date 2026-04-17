import { execFile } from "child_process";
import { promisify } from "util";
import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, writeGlobalConfig, ensureConfigDir } from "../config/loader.js";
import { box, bullet, c } from "../ui/output.js";

const exec = promisify(execFile);

export async function runSetup(): Promise<void> {
  console.log("\n" + box("CORTEX  SETUP", ["Detecting backends and configuring clients..."]));
  console.log();

  ensureConfigDir();
  const config = loadConfig();

  // ── Detect backends ─────────────────────────────────────────
  console.log(c.header("  Detecting backends..."));

  const qmdAvailable = await checkBinary("qmd");
  const qmdVersion = qmdAvailable ? await getBinaryVersion("qmd") : null;
  printBackendStatus("QMD", qmdAvailable, qmdVersion, "npm install -g @tobilu/qmd");

  const openMemAvailable = await checkUrl("http://localhost:8765/health");
  printBackendStatus("OpenMemory", openMemAvailable, null, "git clone + docker compose up");

  const brvAvailable = await checkBinary("brv");
  printBackendStatus("ByteRover", brvAvailable, null, "npm install -g @byterover/cli");
  console.log();

  // ── Update config ───────────────────────────────────────────
  config.backends.qmd.enabled = qmdAvailable;
  config.backends.openmemory.enabled = openMemAvailable;
  config.backends.byterover.enabled = brvAvailable;
  writeGlobalConfig(config);

  // ── Configure clients ────────────────────────────────────────
  console.log(c.header("  Configuring clients..."));
  await configureClient("claude", join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"));
  await configureClient("cursor", join(homedir(), ".cursor", "mcp.json"));
  await configureClient("claude-code", join(homedir(), ".claude", "settings.json"));
  console.log();

  console.log(c.success("  Done! Run `cortex status` to verify.\n"));
}

async function checkBinary(name: string): Promise<boolean> {
  try {
    await exec(name, ["--version"], { timeout: 3000 });
    return true;
  } catch { return false; }
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}

async function getBinaryVersion(name: string): Promise<string | null> {
  try {
    const { stdout } = await exec(name, ["--version"], { timeout: 3000 });
    return stdout.trim().split("\n")[0] ?? null;
  } catch { return null; }
}

function printBackendStatus(name: string, available: boolean, version: string | null, installHint: string): void {
  if (available) {
    const v = version ? chalk.dim(`(${version})`) : "";
    console.log(`    ${bullet.check} ${c.accent(name.padEnd(14))} ${v}`);
  } else {
    console.log(`    ${bullet.cross} ${chalk.dim(name.padEnd(14))} not found  ${chalk.dim(`→  run: ${installHint}`)}`);
  }
}

async function configureClient(name: string, configPath: string): Promise<void> {
  try {
    const dir = configPath.substring(0, configPath.lastIndexOf("/"));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const cortexEntry = { command: "cortex", args: ["mcp"] };

    let existing: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try { existing = JSON.parse(readFileSync(configPath, "utf-8")); } catch {}
    }

    if (name === "claude-code") {
      // Claude Code uses settings.json with mcpServers key
      const settings = existing as { mcpServers?: Record<string, unknown> };
      settings.mcpServers = { ...(settings.mcpServers ?? {}), cortex: cortexEntry };
      writeFileSync(configPath, JSON.stringify(settings, null, 2));
    } else {
      const mcp = existing as { mcpServers?: Record<string, unknown> };
      mcp.mcpServers = { ...(mcp.mcpServers ?? {}), cortex: cortexEntry };
      writeFileSync(configPath, JSON.stringify(mcp, null, 2));
    }

    console.log(`    ${bullet.check} ${c.accent(name.padEnd(14))} ${chalk.dim(`→  ${configPath}`)}`);
  } catch {
    console.log(`    ${bullet.warn} ${chalk.dim(name.padEnd(14))} skipped (path not found)`);
  }
}
