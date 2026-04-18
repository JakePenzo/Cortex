import chalk from "chalk";
import { wipeAllMemories } from "../cache/sqlite.js";

const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  process.stdout.write("  " + question + chalk.dim(" [y/N] "));
  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", data => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      const k = data.toString().toLowerCase().trim();
      if (k === "\x03") { process.stdout.write(SHOW + "\n"); process.exit(0); }
      const yes = k === "y";
      process.stdout.write((yes ? chalk.red("yes") : chalk.dim("no")) + "\n");
      resolve(yes);
    });
  });
}

export async function runWipe(): Promise<void> {
  process.stdout.write(HIDE);
  process.on("exit", () => process.stdout.write(SHOW));

  console.log();
  console.log("  " + chalk.hex("#ff6428").bold("CORTEX") + "  " + chalk.dim("wipe"));
  console.log();
  console.log(chalk.yellow("  This will permanently delete all memories, cache, and stats"));
  console.log(chalk.yellow("  from the local Cortex index. Backend data is not affected."));
  console.log();

  const go = await confirm("Are you sure you want to wipe everything?");

  if (!go) {
    console.log();
    console.log("  " + chalk.dim("Cancelled."));
    console.log();
    process.stdout.write(SHOW);
    return;
  }

  const count = wipeAllMemories();
  console.log();
  console.log(`  ${chalk.greenBright("✓")}  Wiped ${count} memories, cache, and stats.`);
  console.log();
  process.stdout.write(SHOW);
}
