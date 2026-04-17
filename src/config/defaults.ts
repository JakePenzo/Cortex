import type { CortexConfig } from "./schema.js";

export const DEFAULT_CONFIG: CortexConfig = {
  daemon: { port: 7474, dashboard_port: 3474, auto_start: true },
  backends: {
    qmd: { enabled: true, binary: "qmd", mode: "subprocess", port: 8181, collections: [] },
    openmemory: { enabled: false, url: "http://localhost:8765", user_id: "default" },
    byterover: { enabled: false, binary: "brv" },
  },
  routing: { default_mode: "hybrid", cache_ttl_seconds: 300, merge_strategy: "score_weighted", max_results: 10 },
  session: { auto_checkpoint: true, checkpoint_interval: 15, bootstrap_on_start: true },
  ui: { theme: "dark", timestamps: "relative", show_scores: true, show_backend_labels: true },
};
