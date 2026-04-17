import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import chalk from "chalk";
import { c, bullet } from "../ui/output.js";

const CLIENT_CONFIGS: Record<string, string> = {
  claude: join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"),
  cursor: join(homedir(), ".cursor", "mcp.json"),
  "claude-code": join(homedir(), ".claude", "settings.json"),
  windsurf: join(process.cwd(), ".windsurf", "mcp.json"),
};

const CORTEX_MCP_ENTRY = { command: "cortex", args: ["mcp"] };

export async function runInit(client: string): Promise<void> {
  const targets = client === "all" ? Object.keys(CLIENT_CONFIGS) : [client];

  console.log();
  for (const name of targets) {
    const path = CLIENT_CONFIGS[name];
    if (!path) {
      console.log(`  ${bullet.warn} ${chalk.dim(`Unknown client: ${name}`)}`);
      continue;
    }
    await writeClientConfig(name, path);
  }
  console.log();
}

async function writeClientConfig(name: string, configPath: string): Promise<void> {
  const dir = configPath.substring(0, configPath.lastIndexOf("/"));

  if (!existsSync(dir)) {
    try { mkdirSync(dir, { recursive: true }); } catch {}
  }

  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try { existing = JSON.parse(readFileSync(configPath, "utf-8")); } catch {}
  }

  if (name === "claude-code") {
    const s = existing as { mcpServers?: Record<string, unknown> };
    s.mcpServers = { ...(s.mcpServers ?? {}), cortex: CORTEX_MCP_ENTRY };
    writeFileSync(configPath, JSON.stringify(s, null, 2));
  } else {
    const s = existing as { mcpServers?: Record<string, unknown> };
    s.mcpServers = { ...(s.mcpServers ?? {}), cortex: CORTEX_MCP_ENTRY };
    writeFileSync(configPath, JSON.stringify(s, null, 2));
  }

  console.log(`  ${bullet.check} ${c.accent(name.padEnd(14))} ${chalk.dim(`→  ${configPath}`)}`);
}
