import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, writeGlobalConfig, ensureConfigDir } from "../config/loader.js";

const exec = promisify(execFile);

// ── ANSI helpers ───────────────────────────────────────────
const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";
const ACCENT = "#ff6428";

function ok(msg: string)   { console.log(`    ${chalk.greenBright("✓")}  ${msg}`); }
function fail(msg: string) { console.log(`    ${chalk.dim("✗")}  ${chalk.dim(msg)}`); }
function info(msg: string) { console.log(`    ${chalk.dim("·")}  ${chalk.dim(msg)}`); }
function blank()           { console.log(); }
function hr(label?: string) {
  if (!label) { console.log("  " + chalk.dim("─".repeat(54))); return; }
  const pad = Math.max(0, 54 - label.length - 4);
  console.log("  " + chalk.dim(`── ${label} ${"─".repeat(pad)}`));
}

function box(title: string, lines: string[]) {
  const w = 52;
  console.log("  " + chalk.dim("┌─ ") + chalk.white(title) + chalk.dim(" " + "─".repeat(Math.max(0, w - title.length - 3)) + "┐"));
  for (const l of lines) {
    const plain = l.replace(/\x1B\[[0-9;]*m/g, "");
    console.log("  " + chalk.dim("│") + "  " + l + " ".repeat(Math.max(0, w - plain.length - 1)) + chalk.dim("│"));
  }
  console.log("  " + chalk.dim("└" + "─".repeat(w + 1) + "┘"));
}

// ── Interactive prompts ────────────────────────────────────
async function confirm(q: string, def = false): Promise<boolean> {
  if (!process.stdin.isTTY) return def;
  process.stdout.write("  " + q + chalk.dim(def ? " [Y/n] " : " [y/N] "));
  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", data => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      const k = data.toString().toLowerCase().trim();
      if (k === "\x03") { process.stdout.write(SHOW + "\n"); process.exit(0); }
      const yes = k === "y" || (def && (k === "\r" || k === ""));
      process.stdout.write((yes ? chalk.hex(ACCENT)("yes") : chalk.dim("no")) + "\n");
      resolve(yes);
    });
  });
}

async function promptMasked(q: string): Promise<string> {
  process.stdout.write("  " + q);
  process.stdout.write(SHOW);
  return new Promise(resolve => {
    let input = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const handler = (data: Buffer) => {
      const k = data.toString();
      if (k === "\r" || k === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", handler);
        process.stdout.write("\n");
        process.stdout.write(HIDE);
        resolve(input);
      } else if (k === "\x03") {
        process.stdout.write(SHOW + "\n");
        process.exit(0);
      } else if (k === "\x7f") {
        if (input.length) { input = input.slice(0, -1); process.stdout.write("\b \b"); }
      } else if (k.charCodeAt(0) >= 32) {
        input += k;
        process.stdout.write(chalk.dim("•"));
      }
    };
    process.stdin.on("data", handler);
  });
}

// ── Tool probing ───────────────────────────────────────────
async function which(cmd: string): Promise<boolean> {
  try { await exec("which", [cmd]); return true; } catch { return false; }
}

async function binVersion(cmd: string, args = ["--version"]): Promise<string | null> {
  try {
    const { stdout, stderr } = await exec(cmd, args, { timeout: 4000 });
    return (stdout + stderr).trim().split("\n")[0] ?? null;
  } catch { return null; }
}

async function checkDockerStatus(): Promise<"running" | "installed" | "missing"> {
  if (!await which("docker")) return "missing";
  try { await exec("docker", ["info"], { timeout: 6000 }); return "running"; }
  catch { return "installed"; }
}

async function checkUrl(url: string): Promise<boolean> {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(3000) }); return r.ok; }
  catch { return false; }
}

async function detectPkgManager(): Promise<"bun" | "pnpm" | "npm" | null> {
  for (const m of ["bun", "pnpm", "npm"] as const) {
    if (await which(m)) return m;
  }
  return null;
}

// Run a command silently. Spinner stays alive.
async function runSilent(cmd: string, args: string[], cwd?: string): Promise<boolean> {
  try {
    await exec(cmd, args, { timeout: 120_000, ...(cwd ? { cwd } : {}) } as Parameters<typeof exec>[2]);
    return true;
  } catch { return false; }
}

// Run with live output (spinner must be stopped first).
function runLive(cmd: string, args: string[], cwd?: string): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"], cwd });
    proc.on("close", code => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

// ── Main setup ─────────────────────────────────────────────
export async function runSetup(): Promise<void> {
  process.stdout.write(HIDE);
  const restore = () => process.stdout.write(SHOW);
  process.on("exit", restore);
  process.on("SIGINT", () => { restore(); blank(); process.exit(0); });

  blank();
  console.log("  " + chalk.hex(ACCENT).bold("CORTEX") + "  " + chalk.dim("setup"));
  hr();
  blank();
  console.log(chalk.dim("  Cortex is a memory layer for AI tools. It connects Claude,"));
  console.log(chalk.dim("  Cursor, and others to shared memory so they remember your"));
  console.log(chalk.dim("  preferences and past decisions across sessions."));
  blank();

  ensureConfigDir();
  const config = loadConfig();

  // ── System check ──────────────────────────────────────────
  const spin = ora({ text: "Checking your system...", color: "yellow" }).start();

  const [pkgManager, dockerStatus, gitOk, qmdPath, qmdVersion, openMemUp] = await Promise.all([
    detectPkgManager(),
    checkDockerStatus(),
    which("git"),
    which("qmd"),
    binVersion("qmd"),
    checkUrl("http://localhost:8765/health"),
  ]);

  spin.stop();
  console.log(chalk.dim("  System:"));
  blank();

  // Package manager
  if (pkgManager) ok(`${pkgManager}`);
  else fail("No package manager found  →  install npm, bun, or pnpm");

  // Docker
  if (dockerStatus === "running")   ok("Docker  " + chalk.dim("(running)"));
  else if (dockerStatus === "installed") {
    fail("Docker is installed but not running");
    info("Open Docker Desktop, wait for it to start, then re-run `cortex setup`");
    blank(); hr(); blank();
    console.log("  " + chalk.dim("Fix Docker first, then re-run `cortex setup`"));
    blank(); restore(); return;
  } else {
    fail("Docker not found");
    info("Download Docker Desktop at https://docker.com/get-started");
    info("It's free and takes about 5 minutes to install.");
    info("After installing, run `cortex setup` again.");
    blank(); hr(); blank();
    restore(); return;
  }

  blank();

  // ── Backends ───────────────────────────────────────────────
  hr("memory backends");
  blank();
  console.log(chalk.dim("  Backends are where your memories live. Cortex routes each"));
  console.log(chalk.dim("  memory to the best backend automatically."));
  blank();

  // ── QMD ──────────────────────────────────────────────────
  box("QMD  —  local search", [
    "Fast keyword + semantic search over your code and docs.",
    "Runs entirely on your machine. No internet or API keys.",
    "Best for: code snippets, decisions, project notes.",
  ]);
  blank();

  const qmdOk = !!qmdPath;
  if (qmdOk) {
    ok(`QMD ${qmdVersion?.match(/\d+\.\d+\.\d+/)?.[0] ?? ""} is installed`);
    config.backends.qmd.enabled = true;
  } else if (!pkgManager) {
    fail("QMD not installed — install a package manager first");
    info("Then run: npm install -g @tobilu/qmd");
  } else {
    fail("QMD is not installed");
    const go = await confirm(`Install QMD now? (uses ${pkgManager})`);
    if (go) {
      blank();
      const s = ora({ text: "Installing QMD...", color: "yellow" }).start();
      const installed = await runSilent(pkgManager, ["install", "-g", "@tobilu/qmd"]);
      s.stop();
      if (installed) {
        ok("QMD installed successfully");
        config.backends.qmd.enabled = true;
      } else {
        fail("Installation failed");
        info(`Try manually: ${pkgManager} install -g @tobilu/qmd`);
      }
    }
  }

  // ── OpenMemory ───────────────────────────────────────────
  blank();
  blank();
  box("OpenMemory  —  persistent preferences", [
    "Remembers your preferences across every AI conversation.",
    `Tell Claude "always use TypeScript" once — it persists forever.`,
    "Requires: Docker (✓) + an OpenAI API key for semantic search.",
  ]);
  blank();

  if (openMemUp) {
    ok("OpenMemory is already running at :8765");
    config.backends.openmemory.enabled = true;
  } else if (!gitOk) {
    fail("OpenMemory requires git to install");
    info("Install git from https://git-scm.com then re-run `cortex setup`");
  } else {
    fail("OpenMemory is not running");
    const go = await confirm("Set up OpenMemory?");
    if (go) {
      blank();
      info("OpenMemory needs an OpenAI API key to understand and search memories.");
      info("You can get one free at platform.openai.com/api-keys");
      blank();
      const apiKey = await promptMasked("OpenAI API key: ");
      blank();

      if (!apiKey || apiKey.length < 10) {
        fail("No API key provided — skipping OpenMemory");
        info("Re-run `cortex setup` when you have an OpenAI API key.");
      } else {
        await setupOpenMemory(config, apiKey);
      }
    }
  }

  writeGlobalConfig(config);
  blank();

  // ── Clients ───────────────────────────────────────────────
  hr("AI clients");
  blank();
  console.log(chalk.dim("  Adding Cortex to your AI tools so they use shared memory automatically."));
  blank();

  const clients = [
    { name: "Claude Desktop", path: join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"), kind: "mcp" as const },
    { name: "Cursor",         path: join(homedir(), ".cursor", "mcp.json"),                                                    kind: "mcp" as const },
    { name: "Claude Code",    path: join(homedir(), ".claude", "settings.json"),                                               kind: "settings" as const },
    { name: "Windsurf",       path: join(homedir(), ".codeium", "windsurf", "mcp_config.json"),                                kind: "mcp" as const },
  ];

  for (const c of clients) configureClient(c.name, c.path, c.kind);
  blank();

  // ── Daemon ────────────────────────────────────────────────
  const { isDaemonRunning } = await import("../daemon/manager.js");
  if (!isDaemonRunning()) {
    const go = await confirm("Start the Cortex background service on :7474?", true);
    if (go) {
      spawn("cortex", ["mcp", "--http", "--daemon"], { detached: true, stdio: "ignore" }).unref();
      ok("Background service started on :7474");
    }
  } else {
    ok("Background service already running on :7474");
  }

  blank();
  hr();
  blank();
  console.log("  " + chalk.greenBright("✓") + "  " + chalk.white("Cortex is ready!"));
  blank();
  console.log(chalk.dim("  Your AI tools will now use shared memory automatically."));
  console.log(chalk.dim("  Try it:"));
  blank();
  console.log(`    ${chalk.hex(ACCENT)("cortex add")} ${chalk.dim('"I prefer TypeScript over JavaScript"')}`);
  console.log(`    ${chalk.hex(ACCENT)("cortex search")} ${chalk.dim('"my preferences"')}`);
  console.log(`    ${chalk.hex(ACCENT)("cortex dash")}`);
  blank();
  restore();
}

// ── OpenMemory: clone → env → build → start ───────────────
async function setupOpenMemory(config: ReturnType<typeof loadConfig>, apiKey: string): Promise<void> {
  const srcDir    = join(homedir(), ".cortex", "openmemory-src");
  const omDir     = join(srcDir, "openmemory");
  const composePath = join(omDir, "docker-compose.yml");

  // Step 1: clone or update
  if (!existsSync(srcDir)) {
    const s = ora({ text: "Downloading OpenMemory...", color: "yellow" }).start();
    const cloned = await runSilent("git", [
      "clone", "--depth", "1", "--filter=blob:none", "--sparse",
      "https://github.com/mem0ai/mem0", srcDir,
    ]);
    if (cloned) await runSilent("git", ["sparse-checkout", "set", "openmemory"], srcDir);
    s.stop();
    if (!cloned || !existsSync(composePath)) {
      fail("Download failed — check your internet connection");
      info("Try manually: git clone https://github.com/mem0ai/mem0 ~/.cortex/openmemory-src");
      return;
    }
    ok("OpenMemory source downloaded");
  } else {
    const s = ora({ text: "Updating OpenMemory...", color: "yellow" }).start();
    await runSilent("git", ["pull", "--depth", "1"], srcDir);
    s.stop();
  }

  // Step 2: create env files
  const apiEnvPath = join(omDir, "api", ".env");
  const composeEnvPath = join(omDir, ".env");

  writeFileSync(apiEnvPath, `API_KEY=${apiKey}\n`);
  writeFileSync(composeEnvPath, `NEXT_PUBLIC_API_URL=http://localhost:8765\n`);
  ok("Configuration files created");

  // Step 3: build and start (no live output — this is silent)
  blank();
  const s = ora({ text: "Building OpenMemory containers (first run takes 2–4 min)...", color: "yellow" }).start();
  const built = await runSilent("docker", ["compose", "-f", composePath, "build"], omDir);
  s.stop();

  if (!built) {
    fail("Build failed");
    info(`Run manually to see errors: docker compose -f ${composePath.replace(homedir(), "~")} build`);
    return;
  }
  ok("Containers built");

  const s2 = ora({ text: "Starting OpenMemory...", color: "yellow" }).start();
  const started = await runSilent("docker", ["compose", "-f", composePath, "up", "-d"], omDir);
  s2.stop();

  if (!started) {
    fail("Failed to start containers");
    info(`Run manually: docker compose -f ${composePath.replace(homedir(), "~")} up -d`);
    return;
  }

  // Step 4: wait for health
  const s3 = ora({ text: "Waiting for OpenMemory to be ready...", color: "yellow" }).start();
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await checkUrl("http://localhost:8765/health")) { ready = true; break; }
  }
  s3.stop();

  if (ready) {
    ok("OpenMemory is running at :8765");
    config.backends.openmemory.enabled = true;
  } else {
    info("OpenMemory started but isn't responding yet — it may still be initializing.");
    info("Check status: docker compose -f " + composePath.replace(homedir(), "~") + " ps");
    info("Re-run `cortex setup` once it's ready.");
  }
}

// ── Configure MCP client ───────────────────────────────────
function configureClient(name: string, configPath: string, kind: "mcp" | "settings"): void {
  const dir = configPath.substring(0, configPath.lastIndexOf("/"));
  if (!existsSync(dir)) {
    console.log(`    ${chalk.dim("○")}  ${chalk.dim(name)}  ${chalk.dim("— not installed")}`);
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
    ok(`${name}  ${chalk.dim("— configured")}`);
  } catch (e) {
    info(`${name}  — write failed: ${String(e)}`);
  }
}
