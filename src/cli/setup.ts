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
  const base = "─".repeat(52);
  if (!label) { console.log("  " + chalk.dim(base)); return; }
  const side = Math.max(0, 52 - label.length - 4);
  console.log("  " + chalk.dim("── " + label + " " + "─".repeat(side)));
}

// ── Tool detection ──────────────────────────────────────────
async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await exec("which", [cmd]);
    return stdout.trim() || null;
  } catch { return null; }
}

async function binVersion(cmd: string, args = ["--version"]): Promise<string | null> {
  try {
    const { stdout, stderr } = await exec(cmd, args, { timeout: 4000 });
    return (stdout + stderr).trim().split("\n")[0] ?? null;
  } catch { return null; }
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}

async function detectPkgManager(): Promise<"bun" | "npm" | "pnpm" | null> {
  if (await which("bun"))  return "bun";
  if (await which("pnpm")) return "pnpm";
  if (await which("npm"))  return "npm";
  return null;
}

function runLive(cmd: string, args: string[]): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    proc.on("close", code => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

// ── OpenMemory Docker compose ───────────────────────────────
const OPENMEMORY_COMPOSE = `services:
  openmemory:
    image: mem0ai/openmemory-mcp
    container_name: cortex_openmemory
    ports:
      - "8765:8765"
    restart: unless-stopped
    volumes:
      - openmemory_data:/app/data
volumes:
  openmemory_data:
`;

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

  const [pkgManager, dockerPath, dockerVersion, qmdPath, qmdVersion, openMemUp] = await Promise.all([
    detectPkgManager(),
    which("docker"),
    binVersion("docker", ["--version"]),
    which("qmd"),
    binVersion("qmd"),
    checkUrl("http://localhost:8765/health"),
  ]);

  const dockerOk = !!dockerPath;
  const envRows: Array<[string, boolean, string]> = [
    [pkgManager ?? "node pkg manager", !!pkgManager, pkgManager ?? "not found — install npm, bun, or pnpm"],
    ["docker", dockerOk, dockerVersion?.replace("Docker version ", "").split(",")[0] ?? "not found"],
  ];
  for (const [name, ok, info] of envRows) {
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
    console.log(chalk.dim("       install npm/bun/pnpm first, then: npm install -g @tobilu/qmd"));
  } else {
    const go = await confirm(`Install QMD via ${pkgManager}?`);
    if (go) {
      process.stdout.write(SHOW);
      const spin = ora({ text: "Installing @tobilu/qmd...", color: "yellow" }).start();
      const ok = await runLive(pkgManager, ["install", "-g", "@tobilu/qmd"]);
      spin.stop();
      process.stdout.write(HIDE);
      if (ok) {
        printBackend("QMD", true, "installed");
        config.backends.qmd.enabled = true;
      } else {
        console.log(chalk.red(`    ✗  QMD install failed`) + chalk.dim("  →  npm install -g @tobilu/qmd"));
      }
    }
  }

  // OpenMemory ───────────────────────────────────────────────
  console.log();
  printBackend("OpenMemory", openMemUp, openMemUp ? "running at :8765" : "not running");

  if (openMemUp) {
    config.backends.openmemory.enabled = true;
  } else if (!dockerOk) {
    console.log(chalk.dim("       Docker is required — https://docs.docker.com/get-docker/"));
  } else {
    const go = await confirm("Start OpenMemory with Docker?");
    if (go) {
      process.stdout.write(SHOW);
      await startOpenMemory(config);
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

  for (const client of clients) {
    configureClient(client.name, client.path, client.kind);
  }

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
  console.log("  " + chalk.hex("#ff6428")("✓") + "  Done.  " + chalk.dim("Run `cortex status` to verify backends.\n"));
  restore();
}

// ── Start OpenMemory with Docker compose ────────────────────
async function startOpenMemory(config: ReturnType<typeof loadConfig>): Promise<void> {
  const dir = join(homedir(), ".cortex", "openmemory");
  mkdirSync(dir, { recursive: true });
  const composePath = join(dir, "docker-compose.yml");
  writeFileSync(composePath, OPENMEMORY_COMPOSE);

  console.log();
  const spin = ora({ text: "Pulling image and starting OpenMemory...", color: "yellow" }).start();
  const ok = await runLive("docker", ["compose", "-f", composePath, "up", "-d", "--pull", "missing"]);
  spin.stop();

  if (!ok) {
    console.log(chalk.red("    ✗  docker compose failed"));
    console.log(chalk.dim(`       compose file saved to: ${composePath.replace(homedir(), "~")}`));
    console.log(chalk.dim(`       try manually: docker compose -f ${composePath} up -d`));
    return;
  }

  const wait = ora({ text: "Waiting for OpenMemory health check...", color: "yellow" }).start();
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await checkUrl("http://localhost:8765/health")) { ready = true; break; }
  }
  wait.stop();

  if (ready) {
    printBackend("OpenMemory", true, "running at :8765");
    config.backends.openmemory.enabled = true;
  } else {
    console.log(chalk.yellow("    ~  container started but health check timed out — may still be initializing"));
    console.log(chalk.dim(`       check: docker logs cortex_openmemory`));
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
    const cortexEntry = { command: "cortex", args: ["mcp"] };
    let existing: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try { existing = JSON.parse(readFileSync(configPath, "utf-8")); } catch {}
    }

    if (kind === "settings") {
      const s = existing as { mcpServers?: Record<string, unknown> };
      s.mcpServers = { ...(s.mcpServers ?? {}), cortex: cortexEntry };
      writeFileSync(configPath, JSON.stringify(s, null, 2));
    } else {
      const m = existing as { mcpServers?: Record<string, unknown> };
      m.mcpServers = { ...(m.mcpServers ?? {}), cortex: cortexEntry };
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
