import path from "node:path";
import { adapters } from "./adapters/index.js";
import { detectAgents } from "./detect.js";
import { mergeMCP, mergeSkills } from "./merge.js";
import { ALL_AGENTS, PLEXUS_PATHS } from "./paths.js";
import {
  readAllMCP,
  readAllSkills,
  readConfig,
  readMCP,
  readSkills,
} from "./store.js";
import type { AgentId, SyncReport } from "./types.js";

/**
 * Run a full sync: load merged MCP + skills, apply to every enabled
 * AND installed agent.
 */
export async function runSync(only?: AgentId[]): Promise<SyncReport> {
  const startedAt = new Date().toISOString();
  const config = await readConfig();
  const detected = detectAgents();

  const [teamMcp, personalMcp, teamSkills, personalSkills] = await Promise.all([
    readMCP("team"),
    readMCP("personal"),
    readSkills("team"),
    readSkills("personal"),
  ]);

  const mcp = mergeMCP(teamMcp, personalMcp);
  const skills = mergeSkills(teamSkills, personalSkills);

  // Build a map of skillId -> on-disk source dir
  const skillSourcePaths = new Map<string, string>();
  for (const s of skills) {
    const layerDir =
      s.layer === "team" ? PLEXUS_PATHS.team : PLEXUS_PATHS.personal;
    skillSourcePaths.set(
      s.id,
      path.join(layerDir, PLEXUS_PATHS.skillsDirRel, s.id),
    );
  }

  const targets: AgentId[] = (only && only.length > 0 ? only : ALL_AGENTS).filter(
    (id) => {
      const d = detected.find((x) => x.id === id);
      return d?.installed && config.agents[id] !== false;
    },
  );

  const results = await Promise.all(
    targets.map((id) =>
      adapters[id].apply({
        agentId: id,
        mcp,
        skills,
        skillSourcePaths,
        syncStrategy: config.syncStrategy ?? "symlink",
      }),
    ),
  );

  return {
    results,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

export async function previewMerged() {
  const [mcp, skills] = await Promise.all([readAllMCP(), readAllSkills()]);
  return {
    mcp: mergeMCP(
      mcp.filter((m) => m.layer === "team"),
      mcp.filter((m) => m.layer === "personal"),
    ),
    skills: mergeSkills(
      skills.filter((s) => s.layer === "team"),
      skills.filter((s) => s.layer === "personal"),
    ),
  };
}
