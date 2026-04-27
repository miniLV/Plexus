import { adapters } from "../agents/adapters/index.js";
import { detectAgents } from "../agents/detect.js";
import { buildImportPreview } from "../import/from-agents.js";
import { readConfig } from "../store/config.js";
import { readAllMCP, readMCP, writeMCP } from "../store/mcp.js";
import { mergeMCP, mergeSkills } from "../store/merge.js";
import { ALL_AGENTS } from "../store/paths.js";
import { readAllSkills, readSkills, resolveSkillSourceDir, writeSkill } from "../store/skills.js";
import type { AgentId, MCPServerDef, SkillDef, SyncResult } from "../types.js";

/**
 * "Spread" = copy MCP servers and skills from agent A to agent B.
 *
 * Effective set for an agent = items present in its native config OR items
 * in the Plexus store whose `enabledAgents` includes that agent.
 *
 * The diff (in A but not in B) is computed by `previewSpread`, which never
 * writes anything. `applySpread` writes the diff into Plexus's personal
 * layer (creating items if missing, otherwise just adding `to` to their
 * `enabledAgents`) and then syncs the target agent.
 */

export interface SpreadCandidate<T> {
  /** Effective item from agent A. */
  item: T;
  /** Whether this id already exists in the Plexus store. */
  inStore: boolean;
}

export interface SpreadPreview {
  from: AgentId;
  to: AgentId;
  mcp: SpreadCandidate<MCPServerDef>[];
  skills: SpreadCandidate<SkillDef>[];
}

/** Compute the effective MCP set for an agent from native + store. */
async function effectiveMcpFor(agentId: AgentId): Promise<Map<string, MCPServerDef>> {
  const result = new Map<string, MCPServerDef>();

  // Plexus store entries enabled for this agent
  const merged = mergeMCP(await readMCP("team"), await readMCP("personal"));
  for (const m of merged) {
    if (m.enabledAgents.includes(agentId)) result.set(m.id, m);
  }

  // Plus anything still in the agent's native config that we don't manage yet.
  // The "new" candidates from buildImportPreview cover this case (id not in store).
  const importPreview = await buildImportPreview({ storeMcp: merged, storeSkills: [] });
  for (const cand of importPreview.mcp) {
    if (cand.kind !== "new") continue;
    if (!cand.sourceAgents.includes(agentId)) continue;
    if (result.has(cand.item.id)) continue;
    result.set(cand.item.id, { ...cand.item, enabledAgents: [agentId] });
  }
  return result;
}

/** Compute the effective skill set for an agent from native + store. */
async function effectiveSkillsFor(agentId: AgentId): Promise<Map<string, SkillDef>> {
  const result = new Map<string, SkillDef>();

  const merged = mergeSkills(await readSkills("team"), await readSkills("personal"));
  for (const s of merged) {
    if (s.enabledAgents.includes(agentId)) result.set(s.id, s);
  }

  const importPreview = await buildImportPreview({ storeMcp: [], storeSkills: merged });
  for (const cand of importPreview.skills) {
    if (cand.kind !== "new") continue;
    if (!cand.sourceAgents.includes(agentId)) continue;
    if (result.has(cand.item.id)) continue;
    result.set(cand.item.id, { ...cand.item, enabledAgents: [agentId] });
  }
  return result;
}

export async function previewSpread(from: AgentId, to: AgentId): Promise<SpreadPreview> {
  if (from === to) {
    return { from, to, mcp: [], skills: [] };
  }
  const [fromMcp, toMcp, fromSkills, toSkills, allStoreMcp, allStoreSkills] = await Promise.all([
    effectiveMcpFor(from),
    effectiveMcpFor(to),
    effectiveSkillsFor(from),
    effectiveSkillsFor(to),
    readAllMCP(),
    readAllSkills(),
  ]);

  const storeMcpIds = new Set(allStoreMcp.map((m) => m.id));
  const storeSkillIds = new Set(allStoreSkills.map((s) => s.id));

  const mcp: SpreadCandidate<MCPServerDef>[] = [];
  for (const [id, item] of fromMcp) {
    if (toMcp.has(id)) continue;
    mcp.push({ item, inStore: storeMcpIds.has(id) });
  }

  const skills: SpreadCandidate<SkillDef>[] = [];
  for (const [id, item] of fromSkills) {
    if (toSkills.has(id)) continue;
    skills.push({ item, inStore: storeSkillIds.has(id) });
  }

  return { from, to, mcp, skills };
}

export async function applySpread(opts: {
  from: AgentId;
  to: AgentId;
  mcpIds?: string[];
  skillIds?: string[];
}): Promise<{
  mcpAdded: number;
  skillsAdded: number;
  syncResult?: SyncResult;
}> {
  const { from, to } = opts;
  if (from === to) return { mcpAdded: 0, skillsAdded: 0 };

  const preview = await previewSpread(from, to);
  const wantedMcp = new Set(opts.mcpIds ?? preview.mcp.map((c) => c.item.id));
  const wantedSkills = new Set(opts.skillIds ?? preview.skills.map((c) => c.item.id));

  // ── MCP: ensure each in store, ensure `to` in enabledAgents ─────────────
  let mcpAdded = 0;
  if (wantedMcp.size > 0) {
    const personal = await readMCP("personal");
    const team = await readMCP("team");
    const personalById = new Map(personal.map((m) => [m.id, m]));
    const teamById = new Map(team.map((m) => [m.id, m]));

    const toWritePersonal: MCPServerDef[] = [...personal];

    for (const cand of preview.mcp) {
      if (!wantedMcp.has(cand.item.id)) continue;
      const existingPersonal = personalById.get(cand.item.id);
      const existingTeam = teamById.get(cand.item.id);

      if (existingPersonal) {
        if (!existingPersonal.enabledAgents.includes(to)) {
          existingPersonal.enabledAgents = [...existingPersonal.enabledAgents, to];
        }
      } else if (existingTeam) {
        // Don't mutate team layer here. Add a personal-layer override that
        // includes `to`. Personal overrides team in merge, so this works.
        toWritePersonal.push({
          ...existingTeam,
          layer: "personal",
          enabledAgents: Array.from(new Set([...existingTeam.enabledAgents, to])),
        });
      } else {
        // Brand new in store: write item from `from`, with enabledAgents=[from,to].
        toWritePersonal.push({
          ...cand.item,
          layer: "personal",
          enabledAgents: Array.from(new Set([...cand.item.enabledAgents, to])),
        });
      }
      mcpAdded += 1;
    }
    await writeMCP("personal", toWritePersonal);
  }

  // ── Skills: same logic ─────────────────────────────────────────────────
  let skillsAdded = 0;
  if (wantedSkills.size > 0) {
    const personalSkills = await readSkills("personal");
    const teamSkills = await readSkills("team");
    const personalById = new Map(personalSkills.map((s) => [s.id, s]));
    const teamById = new Map(teamSkills.map((s) => [s.id, s]));

    for (const cand of preview.skills) {
      if (!wantedSkills.has(cand.item.id)) continue;
      const existingPersonal = personalById.get(cand.item.id);
      const existingTeam = teamById.get(cand.item.id);

      if (existingPersonal) {
        if (!existingPersonal.enabledAgents.includes(to)) {
          await writeSkill({
            ...existingPersonal,
            enabledAgents: [...existingPersonal.enabledAgents, to],
          });
        }
      } else if (existingTeam) {
        await writeSkill({
          ...existingTeam,
          layer: "personal",
          enabledAgents: Array.from(new Set([...existingTeam.enabledAgents, to])),
        });
      } else {
        await writeSkill({
          ...cand.item,
          layer: "personal",
          enabledAgents: Array.from(new Set([...cand.item.enabledAgents, to])),
        });
      }
      skillsAdded += 1;
    }
  }

  // ── Sync only the target agent ─────────────────────────────────────────
  const config = await readConfig();
  const detected = detectAgents();
  const targetDetected = detected.find((d) => d.id === to);
  if (!targetDetected?.installed || config.agents[to] === false) {
    return { mcpAdded, skillsAdded };
  }

  const mergedMcp = mergeMCP(await readMCP("team"), await readMCP("personal"));
  const mergedSkills = mergeSkills(await readSkills("team"), await readSkills("personal"));
  const skillSourcePaths = new Map<string, string>();
  for (const s of mergedSkills) {
    skillSourcePaths.set(s.id, resolveSkillSourceDir(s.layer, s.id));
  }
  const syncResult = await adapters[to].apply({
    agentId: to,
    mcp: mergedMcp,
    skills: mergedSkills,
    skillSourcePaths,
    syncStrategy: config.syncStrategy ?? "symlink",
  });

  return { mcpAdded, skillsAdded, syncResult };
}

export const SPREAD_AGENTS: AgentId[] = ALL_AGENTS;
