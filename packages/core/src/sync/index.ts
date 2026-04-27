import { adapters } from "../agents/adapters/index.js";
import { detectAgents } from "../agents/detect.js";
import { cleanupLegacyResidue, snapshotAgentConfigs } from "../backup/index.js";
import { mergeMCP, mergeSkills } from "../store/merge.js";
import { ALL_AGENTS } from "../store/paths.js";
import { readConfig } from "../store/config.js";
import { readMCP, readAllMCP } from "../store/mcp.js";
import {
  readAllSkills,
  readSkills,
  resolveSkillSourceDir,
} from "../store/skills.js";
import type { AgentId, SyncReport } from "../types.js";

/**
 * Run a full sync: load merged MCP + skills, apply to every enabled
 * AND installed agent.
 *
 * Before any write, snapshot every agent's current MCP file under
 * ~/.config/plexus/backups/<ts>/ so the user can recover from a bad change.
 */
export async function runSync(only?: AgentId[]): Promise<SyncReport & { backup?: string }> {
  const startedAt = new Date().toISOString();
  const config = await readConfig();
  const detected = detectAgents();

  // Snapshot before we touch anything.
  const backup = await snapshotAgentConfigs({
    reason: only ? `partial sync: ${only.join(",")}` : "full sync",
  }).catch(() => undefined);

  // One-shot cleanup of pre-v0.0.2 inline `.plexus-backup-*` residue.
  await cleanupLegacyResidue().catch(() => undefined);

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
    skillSourcePaths.set(s.id, resolveSkillSourceDir(s.layer, s.id));
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
    backup: backup?.dir,
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
