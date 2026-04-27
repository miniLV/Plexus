import { adapters } from "../agents/adapters/index.js";
import { detectAgents } from "../agents/detect.js";
import { snapshotAgentConfigs } from "../backup/index.js";
import { buildImportPreview } from "../import/from-agents.js";
import { mergeMCP, mergeSkills } from "../store/merge.js";
import { ALL_AGENTS } from "../store/paths.js";
import { readConfig } from "../store/config.js";
import { readMCP, writeMCP } from "../store/mcp.js";
import {
  readSkills,
  resolveSkillSourceDir,
  writeSkill,
} from "../store/skills.js";
import type {
  AgentId,
  ConfigLayer,
  MCPServerDef,
  SkillDef,
  SyncResult,
} from "../types.js";

/**
 * "Effective view" = the union of items present in any agent's native
 * config OR in the Plexus store. Each item is keyed by id; the row tells
 * you which agents currently have it and where authority lives.
 *
 * This is what the MCP Servers and Skills pages show.
 */

export type ItemAuthority = "personal" | "team" | "native";

export interface EffectiveMcpRow {
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** Where the canonical record lives. */
  authority: ItemAuthority;
  /** Agents that currently have this item (native or via store). */
  effectiveAgents: AgentId[];
  /** Agents that have it natively (read from each agent's mcp config). */
  nativeAgents: AgentId[];
  /** If in store: the store's enabledAgents. */
  enabledAgents?: AgentId[];
}

export interface EffectiveSkillRow {
  id: string;
  name: string;
  description?: string;
  authority: ItemAuthority;
  effectiveAgents: AgentId[];
  nativeAgents: AgentId[];
  enabledAgents?: AgentId[];
}

export async function getEffectiveMcp(): Promise<EffectiveMcpRow[]> {
  const [team, personal] = await Promise.all([readMCP("team"), readMCP("personal")]);
  const merged = mergeMCP(team, personal);
  const teamIds = new Set(team.map((m) => m.id));
  const personalIds = new Set(personal.map((m) => m.id));

  // Read native config across all agents (we reuse the import helper).
  const nativePreview = await buildImportPreview({ storeMcp: [], storeSkills: [] });
  const nativeById = new Map<string, { sources: AgentId[]; first: MCPServerDef }>();
  for (const cand of nativePreview.mcp) {
    if (cand.kind !== "new") continue;
    nativeById.set(cand.item.id, {
      sources: cand.sourceAgents,
      first: cand.item,
    });
  }

  const allIds = new Set<string>([
    ...merged.map((m) => m.id),
    ...nativeById.keys(),
  ]);

  const rows: EffectiveMcpRow[] = [];
  for (const id of allIds) {
    const storeRow = merged.find((m) => m.id === id);
    const native = nativeById.get(id);
    const nativeAgents = native?.sources ?? [];
    const enabledAgents = storeRow?.enabledAgents ?? [];
    const effectiveAgents = Array.from(
      new Set<AgentId>([...nativeAgents, ...enabledAgents]),
    );

    let authority: ItemAuthority;
    if (personalIds.has(id)) authority = "personal";
    else if (teamIds.has(id)) authority = "team";
    else authority = "native";

    const base = storeRow ?? native!.first;
    rows.push({
      id,
      command: base.command,
      args: base.args,
      env: base.env,
      authority,
      effectiveAgents,
      nativeAgents,
      enabledAgents: storeRow ? enabledAgents : undefined,
    });
  }

  rows.sort((a, b) => a.id.localeCompare(b.id));
  return rows;
}

export async function getEffectiveSkills(): Promise<EffectiveSkillRow[]> {
  const [team, personal] = await Promise.all([readSkills("team"), readSkills("personal")]);
  const merged = mergeSkills(team, personal);
  const teamIds = new Set(team.map((s) => s.id));
  const personalIds = new Set(personal.map((s) => s.id));

  const nativePreview = await buildImportPreview({ storeMcp: [], storeSkills: [] });
  const nativeById = new Map<string, { sources: AgentId[]; first: SkillDef }>();
  for (const cand of nativePreview.skills) {
    if (cand.kind !== "new") continue;
    nativeById.set(cand.item.id, {
      sources: cand.sourceAgents,
      first: cand.item,
    });
  }

  const allIds = new Set<string>([
    ...merged.map((s) => s.id),
    ...nativeById.keys(),
  ]);

  const rows: EffectiveSkillRow[] = [];
  for (const id of allIds) {
    const storeRow = merged.find((s) => s.id === id);
    const native = nativeById.get(id);
    const nativeAgents = native?.sources ?? [];
    const enabledAgents = storeRow?.enabledAgents ?? [];
    const effectiveAgents = Array.from(
      new Set<AgentId>([...nativeAgents, ...enabledAgents]),
    );

    let authority: ItemAuthority;
    if (personalIds.has(id)) authority = "personal";
    else if (teamIds.has(id)) authority = "team";
    else authority = "native";

    const base = storeRow ?? native!.first;
    rows.push({
      id,
      name: base.name,
      description: base.description,
      authority,
      effectiveAgents,
      nativeAgents,
      enabledAgents: storeRow ? enabledAgents : undefined,
    });
  }

  rows.sort((a, b) => a.id.localeCompare(b.id));
  return rows;
}

/**
 * Toggle whether `agent` should have `id` (an MCP server). Promotes a
 * native-only item into the personal layer if needed, updates enabledAgents,
 * and runs sync so the change is visible immediately.
 *
 * When promoting a native item to the personal layer for the first time, we
 * sync EVERY native source agent too — that way the source agents stop
 * carrying their own copies and start reading the canonical Plexus copy.
 * For non-promote toggles we sync just the affected agent.
 */
export async function toggleMcpAgent(opts: {
  id: string;
  agent: AgentId;
  enabled: boolean;
}): Promise<{ ok: boolean; syncResult?: SyncResult; message?: string }> {
  const personal = await readMCP("personal");
  const team = await readMCP("team");
  const personalIdx = personal.findIndex((m) => m.id === opts.id);
  const teamRow = team.find((m) => m.id === opts.id);

  let nextPersonal = [...personal];
  let agentsToSync: AgentId[] = [opts.agent];

  if (personalIdx >= 0) {
    const row = { ...nextPersonal[personalIdx] };
    if (opts.enabled) {
      if (!row.enabledAgents.includes(opts.agent)) {
        row.enabledAgents = [...row.enabledAgents, opts.agent];
      }
    } else {
      row.enabledAgents = row.enabledAgents.filter((a) => a !== opts.agent);
    }
    nextPersonal[personalIdx] = row;
  } else if (teamRow) {
    const enabledAgents = opts.enabled
      ? Array.from(new Set([...teamRow.enabledAgents, opts.agent]))
      : teamRow.enabledAgents.filter((a) => a !== opts.agent);
    nextPersonal.push({ ...teamRow, layer: "personal", enabledAgents });
  } else {
    // Promote: pull from any agent's native config and copy to personal.
    const nativePreview = await buildImportPreview({ storeMcp: [], storeSkills: [] });
    const cand = nativePreview.mcp.find(
      (c) => c.kind === "new" && c.item.id === opts.id,
    );
    if (!cand || cand.kind !== "new") {
      return { ok: false, message: `Item ${opts.id} not found in any agent's native config` };
    }
    const enabledAgents = opts.enabled
      ? Array.from(new Set([...cand.sourceAgents, opts.agent]))
      : cand.sourceAgents.filter((a) => a !== opts.agent);
    nextPersonal.push({ ...cand.item, layer: "personal", enabledAgents });
    // Re-sync every native source so they pick up the canonical Plexus copy.
    agentsToSync = Array.from(new Set([...cand.sourceAgents, opts.agent]));
  }

  await writeMCP("personal", nextPersonal);

  // One backup snapshot per toggle, even if we sync multiple agents.
  const backup = await snapshotAgentConfigs({
    reason: `toggleMcpAgent ${opts.id} ${opts.agent} ${opts.enabled}`,
  }).catch(() => undefined);

  const results: SyncResult[] = [];
  for (const a of agentsToSync) {
    const r = await syncSingleAgent(a);
    if (r) results.push(r);
  }
  return { ok: true, syncResult: results[0], message: backup?.dir };
}

/** Same idea for skills. Promote also re-syncs every native source. */
export async function toggleSkillAgent(opts: {
  id: string;
  agent: AgentId;
  enabled: boolean;
}): Promise<{ ok: boolean; syncResult?: SyncResult; message?: string }> {
  const personal = await readSkills("personal");
  const team = await readSkills("team");
  const personalRow = personal.find((s) => s.id === opts.id);
  const teamRow = team.find((s) => s.id === opts.id);

  let agentsToSync: AgentId[] = [opts.agent];

  if (personalRow) {
    const enabledAgents = opts.enabled
      ? Array.from(new Set([...personalRow.enabledAgents, opts.agent]))
      : personalRow.enabledAgents.filter((a) => a !== opts.agent);
    await writeSkill({ ...personalRow, enabledAgents });
  } else if (teamRow) {
    const enabledAgents = opts.enabled
      ? Array.from(new Set([...teamRow.enabledAgents, opts.agent]))
      : teamRow.enabledAgents.filter((a) => a !== opts.agent);
    await writeSkill({ ...teamRow, layer: "personal", enabledAgents });
  } else {
    const nativePreview = await buildImportPreview({ storeMcp: [], storeSkills: [] });
    const cand = nativePreview.skills.find(
      (c) => c.kind === "new" && c.item.id === opts.id,
    );
    if (!cand || cand.kind !== "new") {
      return { ok: false, message: `Skill ${opts.id} not found in any agent's native config` };
    }
    const enabledAgents = opts.enabled
      ? Array.from(new Set([...cand.sourceAgents, opts.agent]))
      : cand.sourceAgents.filter((a) => a !== opts.agent);
    await writeSkill({ ...cand.item, layer: "personal", enabledAgents });
    agentsToSync = Array.from(new Set([...cand.sourceAgents, opts.agent]));
  }

  const backup = await snapshotAgentConfigs({
    reason: `toggleSkillAgent ${opts.id} ${opts.agent} ${opts.enabled}`,
  }).catch(() => undefined);

  const results: SyncResult[] = [];
  for (const a of agentsToSync) {
    const r = await syncSingleAgent(a);
    if (r) results.push(r);
  }
  return { ok: true, syncResult: results[0], message: backup?.dir };
}

async function syncSingleAgent(agentId: AgentId): Promise<SyncResult | undefined> {
  const config = await readConfig();
  const detected = detectAgents();
  const target = detected.find((d) => d.id === agentId);
  if (!target?.installed || config.agents[agentId] === false) return undefined;

  const [team, personal] = await Promise.all([readMCP("team"), readMCP("personal")]);
  const [teamSk, personalSk] = await Promise.all([readSkills("team"), readSkills("personal")]);
  const mergedMcp = mergeMCP(team, personal);
  const mergedSkills = mergeSkills(teamSk, personalSk);
  const skillSourcePaths = new Map<string, string>();
  for (const s of mergedSkills) {
    skillSourcePaths.set(s.id, resolveSkillSourceDir(s.layer, s.id));
  }
  return adapters[agentId].apply({
    agentId,
    mcp: mergedMcp,
    skills: mergedSkills,
    skillSourcePaths,
    syncStrategy: config.syncStrategy ?? "symlink",
  });
}

export const __ALL_AGENTS = ALL_AGENTS;
