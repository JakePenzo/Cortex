import { z } from "zod";

export const BackendQmdSchema = z.object({
  enabled: z.boolean().default(true),
  binary: z.string().default("qmd"),
  mode: z.enum(["subprocess", "http"]).default("subprocess"),
  port: z.number().default(8181),
  collections: z.array(z.string()).default([]),
});

export const BackendOpenMemorySchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().default("http://localhost:8765"),
  user_id: z.string().default("default"),
});

export const BackendByteRoverSchema = z.object({
  enabled: z.boolean().default(false),
  binary: z.string().default("brv"),
});

export const DaemonSchema = z.object({
  port: z.number().default(7474),
  dashboard_port: z.number().default(3474),
  auto_start: z.boolean().default(true),
});

export const RoutingSchema = z.object({
  default_mode: z.enum(["fast", "semantic", "hybrid"]).default("hybrid"),
  cache_ttl_seconds: z.number().default(300),
  merge_strategy: z.enum(["score_weighted", "round_robin"]).default("score_weighted"),
  max_results: z.number().default(10),
});

export const SessionSchema = z.object({
  auto_checkpoint: z.boolean().default(true),
  checkpoint_interval: z.number().default(15),
  bootstrap_on_start: z.boolean().default(true),
});

export const UiSchema = z.object({
  theme: z.enum(["dark", "light"]).default("dark"),
  timestamps: z.enum(["relative", "absolute"]).default("relative"),
  show_scores: z.boolean().default(true),
  show_backend_labels: z.boolean().default(true),
});

export const CortexConfigSchema = z.object({
  daemon: DaemonSchema.default({}),
  backends: z.object({
    qmd: BackendQmdSchema.default({}),
    openmemory: BackendOpenMemorySchema.default({}),
    byterover: BackendByteRoverSchema.default({}),
  }).default({}),
  routing: RoutingSchema.default({}),
  session: SessionSchema.default({}),
  ui: UiSchema.default({}),
});

export type CortexConfig = z.infer<typeof CortexConfigSchema>;
