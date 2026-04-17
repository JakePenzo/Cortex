import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { c, bullet } from "../ui/output.js";
import { getConfigPath, getDataDir } from "../config/loader.js";

const exec = promisify(execFile);

export async function runDoctor(): Promise<void> {
  console.log();
  console.log(c.header("  CORTEX DOCTOR"));
  console.log(chalk.dim("  " + "─".repeat(60)));
  console.log();

  // ── Config ───────────────────────────────────────────────────
  section("Config");
  const configPath = getConfigPath();
  check("Config file", existsSync(configPath), configPath, "Run `cortex config init`");
  check("Data directory", existsSync(getDataDir()), getDataDir());
  console.log();

  // ── Binaries ─────────────────────────────────────────────────
  section("Binaries");
  await checkBinary("cortex", "npm install -g @cortex-ai/cortex");
  await checkBinary("qmd", "npm install -g @tobilu/qmd");
  await checkBinary("brv", "npm install -g @byterover/cli");
  console.log();

  // ── Network services ─────────────────────────────────────────
  section("Services");
  await checkUrl("OpenMemory", "http://localhost:8765/health", "git clone + docker compose up");
  await checkUrl("Cortex daemon", "http://localhost:7474/health", "cortex mcp --http --daemon");
  console.log();

  // ── Client configs ────────────────────────────────────────────
  section("Client configs");
  checkClientConfig("Claude Desktop", join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"));
  checkClientConfig("Cursor", join(homedir(), ".cursor", "mcp.json"));
  checkClientConfig("Claude Code", join(homedir(), ".claude", "settings.json"));
  console.log();
}

function section(title: string): void {
  console.log(`  ${c.accent(title)}`);
}

function check(label: string, ok: boolean, detail?: string, fix?: string): void {
  const icon = ok ? bullet.check : bullet.cross;
  const d = detail ? chalk.dim(` — ${detail}`) : "";
  const f = !ok && fix ? chalk.dim(`  →  ${fix}`) : "";
  console.log(`    ${icon} ${label}${d}${f}`);
}

async function checkBinary(name: string, fix?: string): Promise<void> {
  try {
    const { stdout } = await exec(name, ["--version"], { timeout: 3000 });
    check(name, true, stdout.trim().split("\n")[0]);
  } catch {
    check(name, false, undefined, fix);
  }
}

async function checkUrl(label: string, url: string, fix?: string): Promise<void> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    check(label, res.ok, url, res.ok ? undefined : fix);
  } catch {
    check(label, false, url, fix);
  }
}

function checkClientConfig(label: string, path: string): void {
  if (!existsSync(path)) {
    check(label, false, path, "cortex init --client all");
    return;
  }
  try {
    const content = JSON.parse(require("fs").readFileSync(path, "utf-8"));
    const hasCortex = content?.mcpServers?.cortex !== undefined;
    check(label, hasCortex, hasCortex ? "cortex configured" : "cortex not in mcpServers", hasCortex ? undefined : `cortex init --client ${label.toLowerCase().replace(" ", "-")}`);
  } catch {
    check(label, false, "parse error", "cortex init --client all");
  }
}
