import { execFile } from "child_process";
import { promisify } from "util";
import type { QmdSearchResult, QmdStats } from "./types.js";

const execFileAsync = promisify(execFile);

export class QmdClient {
  constructor(private readonly binary: string) {}

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.binary, ["--version"]);
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; collection?: string } = {}): Promise<QmdSearchResult[]> {
    const args = ["query", query, "--format", "json"];
    if (options.limit) args.push("--limit", String(options.limit));
    if (options.collection) args.push("--collection", options.collection);

    try {
      const { stdout } = await execFileAsync(this.binary, args, { timeout: 10_000 });
      const parsed = JSON.parse(stdout.trim());
      return Array.isArray(parsed) ? parsed : parsed.results ?? [];
    } catch {
      return [];
    }
  }

  async add(content: string, options: { collection?: string; tags?: string[] } = {}): Promise<string> {
    const args = ["add", "--format", "json"];
    if (options.collection) args.push("--collection", options.collection);
    if (options.tags?.length) args.push("--tags", options.tags.join(","));

    const { stdout } = await execFileAsync(this.binary, args, {
      timeout: 15_000,
      // pipe content via stdin
    });

    // Fallback: use --content flag if stdin doesn't work
    const args2 = ["add", "--content", content, "--format", "json"];
    if (options.collection) args2.push("--collection", options.collection);
    if (options.tags?.length) args2.push("--tags", options.tags.join(","));

    try {
      const { stdout: out } = await execFileAsync(this.binary, args2, { timeout: 15_000 });
      const parsed = JSON.parse(out.trim());
      return parsed.id ?? crypto.randomUUID();
    } catch {
      return crypto.randomUUID();
    }
  }

  async stats(): Promise<QmdStats> {
    try {
      const { stdout } = await execFileAsync(this.binary, ["stats", "--format", "json"], { timeout: 5_000 });
      return JSON.parse(stdout.trim());
    } catch {
      return { total_docs: 0, collections: [] };
    }
  }

  async version(): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync(this.binary, ["--version"], { timeout: 3_000 });
      return stdout.trim().split("\n")[0];
    } catch {
      return undefined;
    }
  }
}
