import chalk from "chalk";
import { runSetup } from "./setup.js";
import { runStatus } from "./status.js";
import { runSearch } from "./search.js";
import { runAdd } from "./add.js";
import { runInit } from "./init.js";
import { runDoctor } from "./doctor.js";
import { runConfig } from "./config.js";
import { startMcpServer } from "../mcp/server.js";
import { startHttpMcpServer } from "../mcp/transport/http.js";
import { createBackends } from "../backends/factory.js";
import { loadConfig } from "../config/loader.js";
import { isDaemonRunning, stopDaemon, writePid } from "../daemon/manager.js";
import { runDash } from "./dash.js";
import { runIntro } from "./intro.js";
import { startWebDashboard } from "../ui/web/server.js";
import type { MemoryType } from "../router/types.js";

export async function run(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  switch (command) {
    case "setup":
      return runSetup();

    case "status":
      return runStatus(rest.includes("--watch"));

    case "search": {
      const query = rest.filter(a => !a.startsWith("--")).join(" ");
      if (!query) { console.error(chalk.red("Usage: cortex search <query>")); process.exit(1); }
      return runSearch(query, parseSearchOpts(rest));
    }

    case "add": {
      const content = rest.filter(a => !a.startsWith("--")).join(" ");
      if (!content) { console.error(chalk.red("Usage: cortex add <memory>")); process.exit(1); }
      return runAdd(content, parseAddOpts(rest));
    }

    case "init": {
      const client = flagValue(rest, "--client") ?? "all";
      return runInit(client);
    }

    case "doctor":
      return runDoctor();

    case "config":
      return runConfig(rest[0], rest.slice(1));

    case "mcp": {
      const config = loadConfig();
      const backends = createBackends(config);
      const useHttp = rest.includes("--http");
      const daemonMode = rest.includes("--daemon");

      if (useHttp) {
        if (daemonMode) {
          if (isDaemonRunning()) {
            console.log(chalk.yellow("  Cortex daemon is already running. Use `cortex stop` first."));
            return;
          }
          writePid(process.pid);
          process.on("SIGTERM", () => { import("../daemon/manager.js").then(m => m.clearPid()); process.exit(0); });
          process.on("SIGINT", () => { import("../daemon/manager.js").then(m => m.clearPid()); process.exit(0); });
        }
        return startHttpMcpServer(backends, config, config.daemon.port);
      }

      return startMcpServer(backends, config);
    }

    case "stop": {
      const stopped = stopDaemon();
      console.log(stopped ? chalk.green("  Daemon stopped.") : chalk.dim("  No daemon running."));
      return;
    }

    case "dash":
      return runDash(rest.includes("--live"));

    case "dashboard": {
      const config = loadConfig();
      const backends = createBackends(config);
      const webPort = config.daemon.dashboard_port;
      await startWebDashboard(backends, webPort);
      console.log(`\n  Open: http://localhost:${webPort}\n`);
      await new Promise(() => {}); // keep alive
      return;
    }

    case "version":
    case "--version":
    case "-v":
      console.log("cortex v0.1.0");
      return;

    case undefined:
      return runIntro();

    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;

    default:
      console.error(chalk.red(`Unknown command: ${command}`));
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
  ${chalk.cyan.bold("CORTEX")}  ${chalk.dim("v0.1.0 — local-first memory router for AI tools")}

  ${chalk.dim("USAGE")}
    cortex <command> [options]

  ${chalk.dim("COMMANDS")}
    setup                     Detect backends, configure clients
    status                    Backend health and today's stats
    status --watch            Live-updating status
    search <query>            Search memories
    add <memory>              Store a memory manually
    init --client <name>      Configure MCP client (claude, cursor, claude-code, all)
    doctor                    Diagnose backends, config, and client setup
    config                    Show current config
    config init               Create default config file
    config set <key> <value>  Update a config value
    mcp                       Start MCP server (stdio, for client use)
    mcp --http                Start HTTP MCP server on :7474
    mcp --http --daemon       Run HTTP MCP server as background daemon
    stop                      Stop the running daemon
    dash                      Full-screen terminal dashboard
    dashboard                 Web dashboard at localhost:3474
    version                   Show version

  ${chalk.dim("EXAMPLES")}
    cortex setup
    cortex search "auth decisions"
    cortex add "We use Zod for all runtime validation"
    cortex add "prefer named exports" --type preference
    cortex init --client all

  ${chalk.dim("DOCS")}
    github.com/codefishstudio/cortex
`);
}

function parseSearchOpts(args: string[]): { backend?: string; project?: string; mode?: "fast" | "semantic" | "hybrid"; limit?: number } {
  return {
    backend: flagValue(args, "--backend"),
    project: flagValue(args, "--project"),
    mode: flagValue(args, "--mode") as "fast" | "semantic" | "hybrid" | undefined,
    limit: flagValue(args, "--limit") ? Number(flagValue(args, "--limit")) : undefined,
  };
}

function parseAddOpts(args: string[]): { type?: MemoryType; project?: string; tags?: string[] } {
  const tags = flagValue(args, "--tags");
  return {
    type: flagValue(args, "--type") as MemoryType | undefined,
    project: flagValue(args, "--project"),
    tags: tags ? tags.split(",") : undefined,
  };
}

function flagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}
