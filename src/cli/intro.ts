import chalk from "chalk";
import { createBackends } from "../backends/factory.js";
import { loadConfig } from "../config/loader.js";
import { getTodayStats, getRecentMemories } from "../cache/sqlite.js";

// ── Pixel font: 5×7 bitmap ─────────────────────────────────────
const GLYPHS: Record<string, number[][]> = {
  C: [[0,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,0]],
  O: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  R: [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,1,0,0],[1,0,0,1,0],[1,0,0,0,1]],
  T: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  E: [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  X: [[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[1,0,0,0,1]],
};

const BANNER_ROWS = 7;
const BANNER_COLS = 80; // 6 letters × 10 chars + 5 gaps × 4 chars

// ── Gradient: purple → cyan → emerald ─────────────────────────
const STOPS: Array<[number, [number, number, number]]> = [
  [0.00, [168,  85, 247]],  // violet
  [0.40, [ 34, 211, 238]],  // cyan
  [1.00, [ 52, 211, 153]],  // emerald
];

function gradientHex(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  let lo = STOPS[0], hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (clamped >= STOPS[i][0] && clamped <= STOPS[i + 1][0]) { lo = STOPS[i]; hi = STOPS[i + 1]; break; }
  }
  const span = hi[0] - lo[0] || 1;
  const u = (clamped - lo[0]) / span;
  const r = Math.round(lo[1][0] + u * (hi[1][0] - lo[1][0]));
  const g = Math.round(lo[1][1] + u * (hi[1][1] - lo[1][1]));
  const b = Math.round(lo[1][2] + u * (hi[1][2] - lo[1][2]));
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

// ── Per-pixel color based on scan position ─────────────────────
function pixelStr(charCol: number, scanPos: number): string {
  if (charCol > scanPos) {
    return chalk.hex("#0c1f1f")("██");           // unrevealed — dark teal shadow
  }
  const behind = scanPos - charCol;
  if (behind <= 1) return chalk.whiteBright("██");            // scan head — white flash
  if (behind <= 3) return chalk.hex("#b8fff5")("██");         // near glow
  if (behind <= 5) return chalk.hex("#66eedd")("██");         // fade out
  return chalk.hex(gradientHex(charCol / (BANNER_COLS - 2)))("██"); // settled gradient
}

// ── Render one animation frame ─────────────────────────────────
function renderFrame(scanPos: number): string[] {
  const rows: string[] = Array(BANNER_ROWS).fill("");
  const text = "CORTEX";
  for (let i = 0; i < text.length; i++) {
    const glyph = GLYPHS[text[i]]!;
    const letterStart = i * 14;   // 10 chars + 4 gap
    const gap = i < text.length - 1 ? "    " : "";
    for (let r = 0; r < BANNER_ROWS; r++) {
      let s = "";
      for (let px = 0; px < 5; px++) {
        const charCol = letterStart + px * 2;
        s += glyph[r][px] ? pixelStr(charCol, scanPos) : "  ";
      }
      rows[r] += s + gap;
    }
  }
  return rows;
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

// ── Animate the banner, then hold ─────────────────────────────
async function animateBanner(indent: string): Promise<void> {
  const isTTY = process.stdout.isTTY;
  const FRAMES = 20;
  const DELAY  = 32; // ms per frame → ~640ms total

  // Print initial frame (all dark)
  const initial = renderFrame(-8);
  for (const row of initial) process.stdout.write(indent + row + "\n");

  if (!isTTY) return; // skip animation in piped output

  for (let f = 1; f <= FRAMES; f++) {
    const scanPos = Math.round((f / FRAMES) * (BANNER_COLS + 14)) - 7;
    process.stdout.write(`\x1b[${BANNER_ROWS}A`);       // cursor up
    for (const row of renderFrame(scanPos)) {
      process.stdout.write(indent + row + "\n");
    }
    await sleep(DELAY);
  }
}

// ── Main intro ─────────────────────────────────────────────────
export async function runIntro(): Promise<void> {
  const config  = loadConfig();
  const backends = createBackends(config);

  const [backendStats, dayStats, recentMems] = await Promise.all([
    Promise.all(backends.map(b => b.stats())),
    Promise.resolve(getTodayStats()),
    Promise.resolve(getRecentMemories(3)),
  ]);

  const onlineCount    = backendStats.filter(b => b.available).length;
  const totalMemories  = backendStats.reduce((s, b) => s + b.total_memories, 0);

  const indent = "  ";
  console.log();
  await animateBanner(indent);

  // Subtitle — centred under 80-char banner
  const subtitle   = "Memory Router for AI Tools";
  const subPad     = Math.floor((BANNER_COLS - subtitle.length) / 2);
  console.log(indent + " ".repeat(subPad) + chalk.dim(subtitle));
  console.log();

  // Stats card
  const cardWidth  = 60;
  const backendsLabel = backends.length === 0
    ? "none set up"
    : `${onlineCount} / ${backends.length}`;

  printCard(indent, cardWidth, [
    { label: totalMemories.toLocaleString(), sub: "memories" },
    { label: backendsLabel,                  sub: "backends" },
    { label: String(dayStats.queries),       sub: "queries"  },
    { label: dayStats.avg_latency_ms > 0 ? dayStats.avg_latency_ms + "ms" : "—", sub: "latency" },
  ]);

  // Backend dots
  if (backends.length > 0) {
    console.log();
    const dots = backendStats.map(b => {
      const dot = b.available ? chalk.hex("#4dd9c0")("●") : chalk.dim("○");
      return dot + " " + chalk.dim(b.name);
    }).join(chalk.dim("  ·  "));
    console.log(indent + "  " + dots);
  }

  // Recent memories
  if (recentMems.length > 0) {
    console.log();
    for (const m of recentMems) {
      const type    = chalk.dim(`[${m.type}]`.padEnd(12));
      const content = chalk.white(trunc(m.content, 54));
      console.log(indent + "  " + type + " " + content);
    }
  }

  // Footer
  console.log();
  console.log(
    indent + chalk.dim("  run ") +
    chalk.hex("#4dd9c0")("cortex help") +
    chalk.dim(" for all commands  ·  ") +
    chalk.hex("#4dd9c0")("cortex dash") +
    chalk.dim(" for live dashboard")
  );
  console.log();
}

// ── Helpers ────────────────────────────────────────────────────
interface Stat { label: string; sub: string }

function printCard(indent: string, cardWidth: number, stats: Stat[]): void {
  const border = chalk.dim("─".repeat(cardWidth));
  const colW   = Math.floor(cardWidth / stats.length);

  const pad = (s: string, w: number) => {
    const plain = s.replace(/\x1B\[[0-9;]*m/g, "");
    return s + " ".repeat(Math.max(0, w - plain.length));
  };

  console.log(indent + chalk.dim("┌") + border + chalk.dim("┐"));
  console.log(indent + chalk.dim("│") + stats.map(s => pad(chalk.hex("#4dd9c0").bold(s.label), colW)).join("") + chalk.dim("│"));
  console.log(indent + chalk.dim("│") + stats.map(s => pad(chalk.dim(s.sub), colW)).join("") + chalk.dim("│"));
  console.log(indent + chalk.dim("└") + border + chalk.dim("┘"));
}

function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
