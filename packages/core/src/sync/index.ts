import fs from "node:fs/promises";
import { adapters } from "../agents/adapters/index.js";
import { detectAgents } from "../agents/detect.js";
import { instructionsForAgent } from "../agents/inspect.js";
import { cleanupLegacyResidue, snapshotAgentConfigs } from "../backup/index.js";
import { applyImport } from "../import/index.js";
import { applyRulesToAgents } from "../rules/index.js";
import { readConfig } from "../store/config.js";
import { readAllMCP, readMCP, writeMCP } from "../store/mcp.js";
import { mergeMCP, mergeSkills } from "../store/merge.js";
import { ALL_AGENTS } from "../store/paths.js";
import { readEffectiveRules, readRules, writePersonalRules } from "../store/rules.js";
import { readAllSkills, readSkills, resolveSkillSourceDir, writeSkill } from "../store/skills.js";
import type { AgentId, MCPServerDef, RulesApplyResult, SkillDef, SyncReport } from "../types.js";

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

  const targets: AgentId[] = (only && only.length > 0 ? only : ALL_AGENTS).filter((id) => {
    const d = detected.find((x) => x.id === id);
    return d?.installed && config.agents[id] !== false;
  });

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

export interface ShareAllReport extends SyncReport {
  mode: "share-all";
  targetAgents: AgentId[];
  imported: Awaited<ReturnType<typeof applyImport>>;
  shared: {
    mcp: number;
    skills: number;
  };
  rules: {
    applied: RulesApplyResult[];
    importedFrom?: AgentId;
    skipped?: string;
  };
  backup?: string;
}

async function getSyncTargets(only?: AgentId[]): Promise<AgentId[]> {
  const config = await readConfig();
  const detected = detectAgents();
  return (only && only.length > 0 ? only : ALL_AGENTS).filter((id) => {
    const d = detected.find((x) => x.id === id);
    return d?.installed && config.agents[id] !== false;
  });
}

function withTargets<T extends MCPServerDef | SkillDef>(item: T, targets: AgentId[]): T {
  return { ...item, enabledAgents: [...targets] };
}

async function shareMcpWithTargets(targets: AgentId[]): Promise<number> {
  if (targets.length === 0) return 0;

  const [team, personal] = await Promise.all([readMCP("team"), readMCP("personal")]);
  const personalById = new Map(personal.map((item) => [item.id, item]));
  const nextById = new Map<string, MCPServerDef>();

  for (const item of personal) {
    nextById.set(item.id, withTargets(item, targets));
  }

  for (const item of team) {
    if (!personalById.has(item.id)) {
      nextById.set(item.id, withTargets({ ...item, layer: "personal" }, targets));
    }
  }

  const next = Array.from(nextById.values());
  await writeMCP("personal", next);
  return next.length;
}

async function shareSkillsWithTargets(targets: AgentId[]): Promise<number> {
  if (targets.length === 0) return 0;

  const [team, personal] = await Promise.all([readSkills("team"), readSkills("personal")]);
  const personalById = new Map(personal.map((item) => [item.id, item]));
  const nextById = new Map<string, SkillDef>();

  for (const item of personal) {
    nextById.set(item.id, withTargets(item, targets));
  }

  for (const item of team) {
    if (!personalById.has(item.id)) {
      nextById.set(item.id, withTargets({ ...item, layer: "personal" }, targets));
    }
  }

  for (const item of nextById.values()) {
    await writeSkill(item);
  }
  return nextById.size;
}

async function firstAgentRulesSource(targets: AgentId[]): Promise<AgentId | undefined> {
  for (const agent of targets) {
    const [instruction] = instructionsForAgent(agent);
    if (!instruction) continue;
    try {
      const content = await fs.readFile(instruction.abs, "utf8");
      if (content.trim().length === 0) continue;
      await writePersonalRules(content);
      return agent;
    } catch {
      // Agent has no readable instruction file yet.
    }
  }
  return undefined;
}

async function ensurePersonalRules(targets: AgentId[]): Promise<AgentId | undefined> {
  const personal = await readRules("personal");
  if (personal) return undefined;

  const effective = await readEffectiveRules();
  if (effective) {
    await writePersonalRules(effective.content);
    return undefined;
  }

  return firstAgentRulesSource(targets);
}

/**
 * One-click sharing flow for the dashboard and CLI.
 *
 * This intentionally does more than the lower-level `runSync()`:
 * 1. Import MCP/skills already present in native agent files into Plexus.
 * 2. Enable every personal/team MCP and skill for every installed enabled agent.
 * 3. Ensure a personal rules baseline exists, then apply it to every target.
 * 4. Run the normal MCP/skills sync.
 */
export async function runShareAll(only?: AgentId[]): Promise<ShareAllReport> {
  const startedAt = new Date().toISOString();
  const targetAgents = await getSyncTargets(only);
  const imported = await applyImport();

  const [mcpShared, skillsShared, importedRulesFrom] = await Promise.all([
    shareMcpWithTargets(targetAgents),
    shareSkillsWithTargets(targetAgents),
    ensurePersonalRules(targetAgents),
  ]);

  const [sync, rulesApplied] = await Promise.all([
    runSync(targetAgents),
    readRules("personal").then((rules) => (rules ? applyRulesToAgents(targetAgents) : undefined)),
  ]);

  return {
    mode: "share-all",
    targetAgents,
    imported,
    shared: {
      mcp: mcpShared,
      skills: skillsShared,
    },
    rules: rulesApplied
      ? { applied: rulesApplied, importedFrom: importedRulesFrom }
      : {
          applied: [],
          skipped:
            "No rules baseline exists yet. Add rules in the Rules page or keep an instruction file in one installed agent, then sync again.",
        },
    results: sync.results,
    startedAt,
    finishedAt: new Date().toISOString(),
    backup: sync.backup,
  };
}
