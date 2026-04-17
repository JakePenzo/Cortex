import type { BackendAdapter } from "./base.js";
import { QmdAdapter } from "./qmd/adapter.js";
import { OpenMemoryAdapter } from "./openmemory/adapter.js";
import { ByteRoverAdapter } from "./byterover/adapter.js";
import type { CortexConfig } from "../config/schema.js";

export function createBackends(config: CortexConfig): BackendAdapter[] {
  const adapters: BackendAdapter[] = [];

  if (config.backends.qmd.enabled) adapters.push(new QmdAdapter(config));
  if (config.backends.openmemory.enabled) adapters.push(new OpenMemoryAdapter(config));
  if (config.backends.byterover.enabled) adapters.push(new ByteRoverAdapter());

  return adapters;
}
