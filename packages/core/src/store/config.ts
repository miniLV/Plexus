import fs from "node:fs/promises";
import YAML from "yaml";
import type { AgentId, PlexusConfig } from "../types.js";
import { ALL_AGENTS, PLEXUS_PATHS } from "./paths.js";
import { ensureStoreScaffolding } from "./scaffolding.js";

function defaultConfig(): PlexusConfig {
  return {
    agents: Object.fromEntries(ALL_AGENTS.map((agent) => [agent, true])) as Record<
      AgentId,
      boolean
    >,
    syncStrategy: "symlink",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeConfig(value: unknown): PlexusConfig {
  if (!isRecord(value)) {
    throw new Error("config must be an object");
  }

  const defaults = defaultConfig();
  const rawStrategy = value.syncStrategy;
  if (rawStrategy !== undefined && rawStrategy !== "symlink" && rawStrategy !== "copy") {
    throw new Error("syncStrategy must be 'symlink' or 'copy'");
  }

  const agents = { ...defaults.agents };
  if (value.agents !== undefined) {
    if (!isRecord(value.agents)) throw new Error("agents must be an object");
    for (const agent of ALL_AGENTS) {
      const enabled = value.agents[agent];
      if (enabled !== undefined && typeof enabled !== "boolean") {
        throw new Error(`agents.${agent} must be a boolean`);
      }
      if (typeof enabled === "boolean") agents[agent] = enabled;
    }
  }

  const config: PlexusConfig = {
    agents,
    syncStrategy: rawStrategy === "copy" ? "copy" : "symlink",
  };
  if (typeof value.teamRepo === "string" && value.teamRepo.trim()) {
    config.teamRepo = value.teamRepo.trim();
  }
  return config;
}

export async function readConfig(): Promise<PlexusConfig> {
  await ensureStoreScaffolding();
  const raw = await fs.readFile(PLEXUS_PATHS.config, "utf8");
  try {
    return normalizeConfig(YAML.parse(raw));
  } catch {
    return defaultConfig();
  }
}

export async function writeConfig(cfg: unknown): Promise<void> {
  await ensureStoreScaffolding();
  const next = normalizeConfig(cfg);
  const tmp = `${PLEXUS_PATHS.config}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, YAML.stringify(next), "utf8");
  await fs.rename(tmp, PLEXUS_PATHS.config);
}
