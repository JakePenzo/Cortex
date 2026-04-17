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

const BANNER_ROWS = BANNER_LINES.length;
const BANNER_WIDTH = Math.max(...BANNER_LINES.map(l => l.length));

// ── Gradient: violet → cyan → emerald ─────────────────────
const STOPS: Array<[number, [number, number, number]]> = [
  [0.00, [168,  85, 247]],
  [0.45, [ 34, 211, 238]],
  [1.00, [ 52, 211, 153]],
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

// ── Render one animation frame ─────────────────────────────
function renderFrame(scanPos: number): string[] {
  return BANNER_LINES.map(row => {
    const padded = row.padEnd(BANNER_WIDTH);
    let out = "";
    for (let col = 0; col < BANNER_WIDTH; col++) {
      const ch = padded[col] ?? " ";
      if (ch === " ") { out += " "; continue; }
      if (col > scanPos) {
        out += chalk.hex("#0d1b1b")(ch);
      } else {
        const behind = scanPos - col;
        if (behind <= 1)  out += chalk.whiteBright(ch);
        else if (behind <= 3) out += chalk.hex("#c8fff8")(ch);
        else if (behind <= 6) out += chalk.hex("#55e8d8")(ch);
        else out += chalk.hex(gradientHex(col / (BANNER_WIDTH - 1)))(ch);
      }
    }
    return out;
  });
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

// ── Animate the banner ─────────────────────────────────────
async function animateBanner(indent: string): Promise<void> {
  const isTTY = process.stdout.isTTY;
  const FRAMES = 28;
  const DELAY  = 28; // ~780ms total sweep

  const initial = renderFrame(-4);
  for (const row of initial) process.stdout.write(indent + row + "\n");

  if (!isTTY) return;

  for (let f = 1; f <= FRAMES; f++) {
    const scanPos = Math.round((f / FRAMES) * (BANNER_WIDTH + 10)) - 5;
    process.stdout.write(`\x1b[${BANNER_ROWS}A`);
    for (const row of renderFrame(scanPos)) {
      process.stdout.write(indent + row + "\n");
    }
    await sleep(DELAY);
  }
}

// ── Main intro ─────────────────────────────────────────────
export async function runIntro(): Promise<void> {
  const config   = loadConfig();
  const backends = createBackends(config);

  const [backendStats, dayStats, recentMems] = await Promise.all([
    Promise.all(backends.map(b => b.stats())),
    Promise.resolve(getTodayStats()),
    Promise.resolve(getRecentMemories(3)),
  ]);

  const onlineCount   = backendStats.filter(b => b.available).length;
  const totalMemories = backendStats.reduce((s, b) => s + b.total_memories, 0);

  const indent = "  ";
  console.log();
  await animateBanner(indent);

  // Subtitle centred under banner
  const subtitle = "Memory Router for AI Tools";
  const subPad   = Math.floor((BANNER_WIDTH - subtitle.length) / 2);
  console.log(indent + " ".repeat(subPad) + chalk.dim(subtitle));
  console.log();

  // Stats card
  const cardWidth     = 60;
  const backendsLabel = backends.length === 0 ? "none set up" : `${onlineCount} / ${backends.length}`;

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

// ── Helpers ────────────────────────────────────────────────
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
