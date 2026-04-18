import chalk from "chalk";
import { createBackends } from "../backends/factory.js";
import { loadConfig } from "../config/loader.js";
import { getTodayStats, getRecentMemories } from "../cache/sqlite.js";

// ── ASCII banner ───────────────────────────────────────────
const BANNER_LINES = [
  `                                                             `,
  `               :                                             `,
  `        .,    t#,                               ,;           `,
  `       ,Wt   ;##W.   j.                       f#i            `,
  `      i#D.  :#L:WE   EW,       GEEEEEEEL    .E#t             `,
  `     f#f   .KG  ,#D  E##j      ,;;L#K;;.   i#W,   :KW,      L`,
  `   .D#i    EE    ;#f E###D.       t#E     L#D.     ,#W:   ,KG`,
  `  :KW,    f#.     t#iE#jG#W;      t#E   :K#Wfff;    ;#W. jWi `,
  `  t#f     :#G     GK E#t t##f     t#E   i##WLLLLt    i#KED.  `,
  `   ;#G     ;#L   LW. E#t  :K#E:   t#E    .E#L         L#W.   `,
  `    :KE.    t#f f#:  E#KDDDD###i  t#E      f#E:     .GKj#K.  `,
  `     .DW:    f#D#;   E#f,t#Wi,,,  t#E       ,WW;   iWf  i#K. `,
  `       L#,    G#t    E#t  ;#W:    t#E        .D#; LK:    t#E `,
  `        jt     t     DWi   ,KK:    fE          tt i       tDj`,
  `                                    :                        `,
  `                                                             `,
];

const BANNER_ROWS  = BANNER_LINES.length;
const BANNER_WIDTH = Math.max(...BANNER_LINES.map(l => l.length));

// ── Gradient: violet → cyan → emerald ─────────────────────
const STOPS: Array<[number, [number, number, number]]> = [
  [0.00, [255,  30,  60]],   // deep red
  [0.35, [255, 100,  20]],   // orange
  [0.65, [255, 200,  40]],   // amber
  [1.00, [220,  80,  20]],   // burnt orange
];

function gradientHex(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  let lo = STOPS[0], hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (c >= STOPS[i][0] && c <= STOPS[i + 1][0]) { lo = STOPS[i]; hi = STOPS[i + 1]; break; }
  }
  const span = hi[0] - lo[0] || 1;
  const u = (c - lo[0]) / span;
  const r = Math.round(lo[1][0] + u * (hi[1][0] - lo[1][0]));
  const g = Math.round(lo[1][1] + u * (hi[1][1] - lo[1][1]));
  const b = Math.round(lo[1][2] + u * (hi[1][2] - lo[1][2]));
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

// ── Glitch substitution pools ──────────────────────────────
// Each char maps to alternates it can flicker between.
// Original char appears multiple times to weight toward it.
const GLITCH: Record<string, string> = {
  "#": "#*@&#%#",
  ":": ":;|!:",
  ".": ".,..",
  ",": ",.,",
  ";": ";:;",
  "!": "!|;!",
  "t": "t7+tt",
  "f": "f4ff",
  "i": "i1|ii",
  "j": "j!jj",
  "W": "WMWW",
  "E": "E3FEE",
  "G": "G6CGG",
  "K": "KXkKK",
  "L": "L1|LL",
  "D": "D0ODD",
  "j": "j!jj",
  "e": "e3ee",
};

// Pre-compute all glitch-eligible positions
const GLITCH_POOL: Array<[row: number, col: number]> = [];
for (let r = 0; r < BANNER_LINES.length; r++) {
  for (let c = 0; c < BANNER_LINES[r].length; c++) {
    if (GLITCH[BANNER_LINES[r][c]]) GLITCH_POOL.push([r, c]);
  }
}

function pickGlitches(n: number): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < n * 4 && set.size < n; i++) {
    const [r, c] = GLITCH_POOL[Math.floor(Math.random() * GLITCH_POOL.length)];
    set.add(`${r},${c}`);
  }
  return set;
}

// ── Render banner frame ────────────────────────────────────
function renderBanner(opts: {
  scanPos?: number;     // scan sweep head (intro only)
  glitches?: Set<string>;
}): string[] {
  const { scanPos = Infinity, glitches = new Set() } = opts;

  return BANNER_LINES.map((row, rowIdx) => {
    const padded = row.padEnd(BANNER_WIDTH);
    let out = "";
    for (let col = 0; col < BANNER_WIDTH; col++) {
      let ch = padded[col] ?? " ";

      // Apply glitch substitution
      const key = `${rowIdx},${col}`;
      if (glitches.has(key) && GLITCH[ch]) {
        const pool = GLITCH[ch];
        ch = pool[Math.floor(Math.random() * pool.length)];
      }

      if (ch === " ") { out += " "; continue; }

      // Scan sweep coloring
      if (col > scanPos) {
        out += chalk.hex("#0d1b1b")(ch);
      } else if (scanPos !== Infinity) {
        const behind = scanPos - col;
        if (behind <= 1)      out += chalk.whiteBright(ch);
        else if (behind <= 3) out += chalk.hex("#fff0c0")(ch);
        else if (behind <= 6) out += chalk.hex("#ffb050")(ch);
        else                  out += chalk.hex(gradientHex(col / (BANNER_WIDTH - 1)))(ch);
      } else {
        // Steady state: gradient + glitch highlight
        const color = glitches.has(key)
          ? "#ffe8c0"
          : gradientHex(col / (BANNER_WIDTH - 1));
        out += chalk.hex(color)(ch);
      }
    }
    return out;
  });
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

// ── One-time scan sweep ────────────────────────────────────
async function runSweep(indent: string): Promise<void> {
  const isTTY = process.stdout.isTTY;
  const FRAMES = 28;
  const DELAY  = 28;

  for (const row of renderBanner({ scanPos: -4 })) process.stdout.write(indent + row + "\n");
  if (!isTTY) return;

  for (let f = 1; f <= FRAMES; f++) {
    const scanPos = Math.round((f / FRAMES) * (BANNER_WIDTH + 10)) - 5;
    process.stdout.write(`\x1b[${BANNER_ROWS}A`);
    for (const row of renderBanner({ scanPos })) process.stdout.write(indent + row + "\n");
    await sleep(DELAY);
  }
}

// ── Continuous idle flicker ────────────────────────────────
async function runFlicker(indent: string, linesBelow: number): Promise<void> {
  if (!process.stdout.isTTY) return;

  let alive = true;
  const timer = setTimeout(() => { alive = false; }, 30_000);

  try {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", () => { alive = false; });
  } catch { /* not a TTY stdin */ }

  while (alive) {
    await sleep(90 + Math.random() * 60); // 90–150ms between ticks
    if (!alive) break;

    // Burst occasionally: many glitches, or near-zero
    const burst = Math.random() < 0.15;
    const count = burst ? 8 + Math.floor(Math.random() * 6) : Math.floor(Math.random() * 4);
    const glitches = count > 0 ? pickGlitches(count) : new Set<string>();

    process.stdout.write(`\x1b[${linesBelow + BANNER_ROWS}A`);
    for (const row of renderBanner({ glitches })) process.stdout.write(indent + row + "\n");
    if (linesBelow > 0) process.stdout.write(`\x1b[${linesBelow}B`);
  }

  clearTimeout(timer);
  try { process.stdin.setRawMode(false); process.stdin.pause(); } catch { /* ok */ }
}

// ── Main intro ─────────────────────────────────────────────
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";

export async function runIntro(): Promise<void> {
  process.stdout.write(HIDE_CURSOR);
  const restoreCursor = () => process.stdout.write(SHOW_CURSOR);
  process.on("exit", restoreCursor);
  process.on("SIGINT", () => { restoreCursor(); process.exit(0); });

  const config   = loadConfig();
  const backends = createBackends(config);

  const [backendStats, dayStats, recentMems] = await Promise.all([
    Promise.all(backends.map(b => b.stats())),
    Promise.resolve(getTodayStats()),
    Promise.resolve(getRecentMemories(3)),
  ]);

  const onlineCount   = backendStats.filter(b => b.available).length;
  const totalMemories = backendStats.reduce((s, b) => s + b.total_memories, 0);
  const indent        = "  ";

  console.log();
  await runSweep(indent);

  // Print content below banner; track line count for flicker cursor management
  let linesBelow = 0;
  const pl = (s = "") => { console.log(s); linesBelow++; };

  const subtitle = "Memory Router for AI Tools";
  const subPad   = Math.floor((BANNER_WIDTH - subtitle.length) / 2);
  pl(indent + " ".repeat(subPad) + chalk.dim(subtitle));
  pl();

  const cardWidth     = 60;
  const backendsLabel = backends.length === 0 ? "none set up" : `${onlineCount} / ${backends.length}`;
  printCard(indent, cardWidth, [
    { label: totalMemories.toLocaleString(), sub: "memories" },
    { label: backendsLabel,                  sub: "backends" },
    { label: String(dayStats.queries),       sub: "queries"  },
    { label: dayStats.avg_latency_ms > 0 ? dayStats.avg_latency_ms + "ms" : "—", sub: "latency" },
  ], linesBelow);
  linesBelow += 4; // card is always 4 lines

  if (backends.length > 0) {
    pl();
    const dots = backendStats.map(b => {
      const dot = b.available ? chalk.hex("#ff6428")("●") : chalk.dim("○");
      return dot + " " + chalk.dim(b.name);
    }).join(chalk.dim("  ·  "));
    pl(indent + "  " + dots);
  }

  if (recentMems.length > 0) {
    pl();
    for (const m of recentMems) {
      pl(indent + "  " + chalk.dim(`[${m.type}]`.padEnd(12)) + " " + chalk.white(trunc(m.content, 54)));
    }
  }

  pl();
  pl(
    indent + chalk.dim("  run ") +
    chalk.hex("#ff6428")("cortex help") +
    chalk.dim(" for all commands  ·  ") +
    chalk.hex("#ff6428")("cortex dash") +
    chalk.dim(" for live dashboard")
  );
  pl(indent + chalk.dim("  press any key to exit"));
  pl();

  await runFlicker(indent, linesBelow);
  restoreCursor();
}

// ── Helpers ────────────────────────────────────────────────
interface Stat { label: string; sub: string }

function printCard(indent: string, cardWidth: number, stats: Stat[], _startLine: number): void {
  const border = chalk.dim("─".repeat(cardWidth));
  const colW   = Math.floor(cardWidth / stats.length);
  const pad    = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.replace(/\x1B\[[0-9;]*m/g, "").length));
  console.log(indent + chalk.dim("┌") + border + chalk.dim("┐"));
  console.log(indent + chalk.dim("│") + stats.map(s => pad(chalk.hex("#ff6428").bold(s.label), colW)).join("") + chalk.dim("│"));
  console.log(indent + chalk.dim("│") + stats.map(s => pad(chalk.dim(s.sub), colW)).join("") + chalk.dim("│"));
  console.log(indent + chalk.dim("└") + border + chalk.dim("┘"));
}

function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
