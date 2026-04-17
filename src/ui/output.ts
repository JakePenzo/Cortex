import chalk from "chalk";

// ── Color palette ──────────────────────────────────────────────
export const c = {
  header: chalk.cyan.bold,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  dim: chalk.dim,
  accent: chalk.cyan,
  backend: (name: string) => BACKEND_COLORS[name] ?? chalk.white,
};

const BACKEND_COLORS: Record<string, chalk.Chalk> = {
  qmd: chalk.blue,
  openmemory: chalk.magenta,
  byterover: chalk.green,
};

// ── Box drawing ────────────────────────────────────────────────
export function card(title: string, lines: string[], color = chalk.white): string {
  const width = Math.max(title.length + 4, ...lines.map(l => stripAnsi(l).length + 2), 50);
  const bar = "─".repeat(width);
  const top = `┌─ ${color(title)} ${"─".repeat(Math.max(0, width - title.length - 3))}┐`;
  const bottom = `└${"─".repeat(width)}┘`;
  const body = lines.map(l => `│ ${l.padEnd(width - 2 + ansiExtra(l))} │`).join("\n");
  return [top, body, bottom].join("\n");
}

export function box(title: string, lines: string[]): string {
  const width = Math.max(title.length + 4, ...lines.map(l => stripAnsi(l).length + 4), 45);
  const inner = width - 2;
  const top = `╔${"═".repeat(inner)}╗`;
  const titleLine = `║ ${chalk.cyan.bold(title.padEnd(inner - 2 + ansiExtra(chalk.cyan.bold(title))))} ║`;
  const sep = `╠${"═".repeat(inner)}╣`;
  const body = lines.map(l => `║ ${l.padEnd(inner - 2 + ansiExtra(l))} ║`).join("\n");
  const bottom = `╚${"═".repeat(inner)}╝`;
  return [top, titleLine, sep, body, bottom].join("\n");
}

// ── Relative timestamps ───────────────────────────────────────
export function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} days ago`;
  return date.toLocaleDateString();
}

// ── Status bullets ────────────────────────────────────────────
export const bullet = {
  ok: chalk.green("●"),
  warn: chalk.yellow("○"),
  err: chalk.red("✗"),
  check: chalk.green("✓"),
  cross: chalk.red("✗"),
};

// ── Helpers ───────────────────────────────────────────────────
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, "");
}

function ansiExtra(str: string): number {
  return str.length - stripAnsi(str).length;
}
