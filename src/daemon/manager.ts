import { existsSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { getDataDir, ensureConfigDir } from "../config/loader.js";

const PID_FILE = () => join(getDataDir(), "cortex.pid");

export function writePid(pid: number): void {
  ensureConfigDir();
  writeFileSync(PID_FILE(), String(pid));
}

export function readPid(): number | null {
  const path = PID_FILE();
  if (!existsSync(path)) return null;
  const n = parseInt(readFileSync(path, "utf-8").trim(), 10);
  return isNaN(n) ? null : n;
}

export function clearPid(): void {
  const path = PID_FILE();
  if (existsSync(path)) unlinkSync(path);
}

export function isDaemonRunning(): boolean {
  const pid = readPid();
  if (!pid) return false;
  try {
    process.kill(pid, 0); // signal 0 = existence check
    return true;
  } catch {
    clearPid();
    return false;
  }
}

export function stopDaemon(): boolean {
  const pid = readPid();
  if (!pid) return false;
  try {
    process.kill(pid, "SIGTERM");
    clearPid();
    return true;
  } catch {
    clearPid();
    return false;
  }
}
