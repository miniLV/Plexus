import fs from "node:fs/promises";
import YAML from "yaml";
import type { PlexusConfig } from "../types.js";
import { PLEXUS_PATHS } from "./paths.js";
import { ensureStoreScaffolding } from "./scaffolding.js";

export async function readConfig(): Promise<PlexusConfig> {
  await ensureStoreScaffolding();
  const raw = await fs.readFile(PLEXUS_PATHS.config, "utf8");
  return YAML.parse(raw) as PlexusConfig;
}

export async function writeConfig(cfg: PlexusConfig): Promise<void> {
  await ensureStoreScaffolding();
  await fs.writeFile(PLEXUS_PATHS.config, YAML.stringify(cfg), "utf8");
}
