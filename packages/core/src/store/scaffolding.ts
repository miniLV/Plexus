import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { ConfigLayer, PlexusConfig } from "../types.js";
import { ensureDir, pathExists } from "./fs-utils.js";
import { ALL_AGENTS, PLEXUS_PATHS } from "./paths.js";

/**
 * Create the on-disk store layout under ~/.config/plexus/ if it doesn't exist
 * yet, and write a default config.yaml on first run.
 *
 * Called by every public read/write API for safety.
 */
export async function ensureStoreScaffolding(): Promise<void> {
  await ensureDir(PLEXUS_PATHS.root);
  for (const layer of ["team", "personal"] as ConfigLayer[]) {
    const base = layer === "team" ? PLEXUS_PATHS.team : PLEXUS_PATHS.personal;
    await ensureDir(path.join(base, PLEXUS_PATHS.mcpDirRel));
    await ensureDir(path.join(base, PLEXUS_PATHS.skillsDirRel));
    await ensureDir(path.join(base, "rules"));
  }

  if (!(await pathExists(PLEXUS_PATHS.config))) {
    const defaults: PlexusConfig = {
      agents: Object.fromEntries(ALL_AGENTS.map((a) => [a, true])) as PlexusConfig["agents"],
      syncStrategy: "symlink",
    };
    await fs.writeFile(PLEXUS_PATHS.config, YAML.stringify(defaults), "utf8");
  }
}

/** Resolve the root directory for a given config layer. */
export function layerRoot(layer: ConfigLayer): string {
  return layer === "team" ? PLEXUS_PATHS.team : PLEXUS_PATHS.personal;
}
