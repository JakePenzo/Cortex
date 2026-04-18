import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, writeGlobalConfig, ensureConfigDir } from "../config/loader.js";

const exec = promisify(execFile);

// ── Terminal helpers ────────────────────────────────────────
const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";

async function confirm(question: string, def = false): Promise<boolean> {
  if (!process.stdin.isTTY) return def;
  process.stdout.write("  " + question + chalk.dim(def ? " [Y/n] " : " [y/N] "));
  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", data => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      const key = data.toString().toLowerCase().trim();
      if (key === "\x03") { process.stdout.write(SHOW + "\n"); process.exit(0); }
      const yes = key === "y" || (def && (key === "\r" || key === ""));
      process.stdout.write((yes ? chalk.hex("#ff6428")("yes") : chalk.dim("no")) + "\n");
      resolve(yes);
    });
  });
}

function hr(label?: string): void {
  if (!label) { console.log("  " + chalk.dim("─".repeat(52))); return; }
  const side = Math.max(0, 52 - label.length - 4);
  console.log("  " + chalk.dim("── " + label + " " + "─".repeat(side)));
}

function step(msg: string): void {
  console.log("       " + chalk.dim(msg));
}

// ── Tool detection ──────────────────────────────────────────
async function which(cmd: string): Promise<string | null> {
  try { const { stdout } = await exec("which", [cmd]); return stdout.trim() || null; }
  catch { return null; }
}

async function binVersion(cmd: string, args = ["--version"]): Promise<string | null> {
  try {
    const { stdout, stderr } = await exec(cmd, args, { timeout: 4000 });
    return (stdout + stderr).trim().split("\n")[0] ?? null;
  } catch { return null; }
}

async function checkUrl(url: string): Promise<boolean> {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(3000) }); return r.ok; }
  catch { return false; }
}

async function detectPkgManager(): Promise<"bun" | "npm" | "pnpm" | null> {
  if (await which("bun"))  return "bun";
  if (await which("pnpm")) return "pnpm";
  if (await which("npm"))  return "npm";
  return null;
}

// Run a command with output piped directly to terminal.
// Spinner must be stopped before calling this.
function runLive(cmd: string, args: string[], cwd?: string): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"], cwd });
    proc.on("close", code => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

// Run a command silently, return combined output string.
async function runSilent(cmd: string, args: string[], cwd?: string): Promise<{ ok: boolean; out: string }> {
  try {
    const { stdout, stderr } = await exec(cmd, args, { timeout: 30_000, cwd } as Parameters<typeof exec>[2]);
    return { ok: true, out: (stdout + stderr).trim() };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: ((err.stdout ?? "") + (err.stderr ?? "")).trim() };
  }
}

// ── Setup ───────────────────────────────────────────────────
export async function runSetup(): Promise<void> {
  process.stdout.write(HIDE);
  const restore = () => process.stdout.write(SHOW);
  process.on("exit", restore);
  process.on("SIGINT", () => { restore(); process.stdout.write("\n"); process.exit(0); });

  console.log();
  console.log("  " + chalk.hex("#ff6428").bold("CORTEX") + "  " + chalk.dim("setup"));
  hr();
  console.log();

  ensureConfigDir();
  const config = loadConfig();

  // ── 1. Environment ─────────────────────────────────────────
  console.log(chalk.dim("  Detecting environment..."));
  console.log();

  const [pkgManager, dockerPath, dockerVersion, gitPath, qmdPath, qmdVersion, openMemUp] = await Promise.all([
    detectPkgManager(),
    which("docker"),
    binVersion("docker", ["--version"]),
    which("git"),
    which("qmd"),
    binVersion("qmd"),
    checkUrl("http://localhost:8765/health"),
  ]);

  const dockerOk = !!dockerPath;
  const gitOk    = !!gitPath;

  for (const [name, ok, info] of [
    [pkgManager ?? "pkg manager", !!pkgManager, pkgManager ?? "not found — install npm, bun, or pnpm"],
    ["docker",  dockerOk, dockerVersion?.replace("Docker version ", "").split(",")[0] ?? "not found"],
    ["git",     gitOk,    gitOk ? "found" : "not found — required for OpenMemory"],
  ] as Array<[string, boolean, string]>) {
    const icon = ok ? chalk.hex("#ff6428")("✓") : chalk.dim("✗");
    console.log(`    ${icon}  ${chalk.white(name.padEnd(14))}  ${chalk.dim(info)}`);
  }
  console.log();

  // ── 2. Backends ────────────────────────────────────────────
  hr("backends");
  console.log();

  // QMD ──────────────────────────────────────────────────────
  const qmdOk = !!qmdPath;
  printBackend("QMD", qmdOk, qmdOk ? (qmdVersion ?? qmdPath!) : "not installed");

  if (qmdOk) {
    config.backends.qmd.enabled = true;
  } else if (!pkgManager) {
    step("install npm/bun/pnpm first, then: npm install -g @tobilu/qmd");
  } else {
    const go = await confirm(`Install QMD via ${pkgManager}?`);
    if (go) {
      console.log();
      restore();  // show cursor while streaming output
      const ok = await runLive(pkgManager, ["install", "-g", "@tobilu/qmd"]);
      process.stdout.write(HIDE);
      console.log();
      if (ok) {
        printBackend("QMD", true, "installed");
        config.backends.qmd.enabled = true;
      } else {
        printBackend("QMD", false, "install failed  →  npm install -g @tobilu/qmd");
      }
    }
  }

  // OpenMemory ───────────────────────────────────────────────
  console.log();
  printBackend("OpenMemory", openMemUp, openMemUp ? "running at :8765" : "not running");

  if (openMemUp) {
    config.backends.openmemory.enabled = true;
  } else if (!dockerOk) {
    step("Docker required — https://docs.docker.com/get-docker/");
  } else if (!gitOk) {
    step("git required to clone OpenMemory source");
  } else {
    const go = await confirm("Set up OpenMemory with Docker?");
    if (go) {
      restore();
      await setupOpenMemory(config);
      process.stdout.write(HIDE);
    }
  }

  writeGlobalConfig(config);
  console.log();

  // ── 3. Clients ─────────────────────────────────────────────
  hr("clients");
  console.log();

  const clients = [
    { name: "Claude Desktop", path: join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"), kind: "mcp" as const },
    { name: "Cursor",         path: join(homedir(), ".cursor", "mcp.json"),                                                    kind: "mcp" as const },
    { name: "Claude Code",    path: join(homedir(), ".claude", "settings.json"),                                               kind: "settings" as const },
    { name: "Windsurf",       path: join(homedir(), ".codeium", "windsurf", "mcp_config.json"),                                kind: "mcp" as const },
  ];

  for (const client of clients) configureClient(client.name, client.path, client.kind);
  console.log();

  // ── 4. Daemon ──────────────────────────────────────────────
  hr("daemon");
  console.log();

  const { isDaemonRunning } = await import("../daemon/manager.js");
  if (isDaemonRunning()) {
    printBackend("HTTP daemon", true, "already running on :7474");
  } else {
    const go = await confirm("Start Cortex daemon on :7474?", true);
    if (go) {
      spawn("cortex", ["mcp", "--http", "--daemon"], { detached: true, stdio: "ignore" }).unref();
      printBackend("HTTP daemon", true, ":7474");
    }
  }

  console.log();
  hr();
  console.log();
  console.log("  " + chalk.hex("#ff6428")("✓") + "  Done.  " + chalk.dim("Run `cortex status` to verify.\n"));
  restore();
}

// ── OpenMemory: sparse-clone mem0ai/mem0, build + run ───────
async function setupOpenMemory(config: ReturnType<typeof loadConfig>): Promise<void> {
  const srcDir      = join(homedir(), ".cortex", "openmemory-src");
  const composeDir  = join(srcDir, "openmemory");
  const composePath = join(composeDir, "docker-compose.yml");

  console.log();

  // Clone or update
  if (!existsSync(srcDir)) {
    step("Cloning mem0ai/mem0 (sparse, openmemory/ only)...");
    const cloned = await runLive("git", [
      "clone", "--depth", "1", "--filter=blob:none", "--sparse",
      "https://github.com/mem0ai/mem0", srcDir,
    ]);
    if (!cloned) {
      step("git clone failed — check your internet connection");
      return;
    }
    await runSilent("git", ["sparse-checkout", "set", "openmemory"], srcDir);
  } else {
    step("Pulling latest mem0ai/mem0...");
    await runSilent("git", ["pull", "--depth", "1"], srcDir);
  }

  if (!existsSync(composePath)) {
    step(`docker-compose.yml not found at ${composeDir}`);
    step("Check https://github.com/mem0ai/mem0/tree/main/openmemory");
    return;
  }

  step("Building and starting OpenMemory (first run may take a few minutes)...");
  const ok = await runLive("docker", ["compose", "-f", composePath, "up", "-d", "--build"]);

  if (!ok) {
    step("docker compose failed — check output above");
    step(`compose file: ${composePath.replace(homedir(), "~")}`);
    return;
  }

  // Wait for health
  const spin = ora({ text: "Waiting for OpenMemory to be ready...", color: "yellow" }).start();
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await checkUrl("http://localhost:8765/health")) { ready = true; break; }
  }
  spin.stop();

  if (ready) {
    printBackend("OpenMemory", true, "running at :8765");
    config.backends.openmemory.enabled = true;
  } else {
    console.log(chalk.yellow("    ~  started but health check timed out (may still be initializing)"));
    step("check: docker logs $(docker compose -f " + composePath + " ps -q)");
  }
}

// ── Configure MCP client ────────────────────────────────────
function configureClient(name: string, configPath: string, kind: "mcp" | "settings"): void {
  const dir = configPath.substring(0, configPath.lastIndexOf("/"));
  if (!existsSync(dir)) {
    console.log(`    ${chalk.dim("○")}  ${chalk.dim(name.padEnd(16))}  ${chalk.dim("not installed")}`);
    return;
  }
  try {
    const entry = { command: "cortex", args: ["mcp"] };
    let existing: Record<string, unknown> = {};
    if (existsSync(configPath)) { try { existing = JSON.parse(readFileSync(configPath, "utf-8")); } catch {} }
    if (kind === "settings") {
      const s = existing as { mcpServers?: Record<string, unknown> };
      s.mcpServers = { ...(s.mcpServers ?? {}), cortex: entry };
      writeFileSync(configPath, JSON.stringify(s, null, 2));
    } else {
      const m = existing as { mcpServers?: Record<string, unknown> };
      m.mcpServers = { ...(m.mcpServers ?? {}), cortex: entry };
      writeFileSync(configPath, JSON.stringify(m, null, 2));
    }
    console.log(`    ${chalk.hex("#ff6428")("✓")}  ${chalk.white(name.padEnd(16))}  ${chalk.dim(configPath.replace(homedir(), "~"))}`);
  } catch (e) {
    console.log(`    ${chalk.yellow("~")}  ${chalk.dim(name.padEnd(16))}  write failed: ${chalk.dim(String(e))}`);
  }
}

function printBackend(name: string, ok: boolean, info: string): void {
  const icon = ok ? chalk.hex("#ff6428")("✓") : chalk.dim("✗");
  console.log(`    ${icon}  ${chalk.white(name.padEnd(16))}  ${chalk.dim(info)}`);
}
