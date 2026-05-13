import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { adapters } from "../agents/adapters/index.js";
import { detectAgents } from "../agents/detect.js";
import { instructionsForAgent } from "../agents/inspect.js";
import { cleanupLegacyResidue, snapshotAgentConfigs } from "../backup/index.js";
import {
  firstNativeSkillSourceDir,
  readNativeMcpFromAgent,
  readNativeSkillsFromAgent,
  resolveNativeSkillSourceDir,
} from "../import/from-agents.js";
import { applyRulesToAgents } from "../rules/index.js";
import { readConfig } from "../store/config.js";
import { readAllMCP, readMCP, writeMCP } from "../store/mcp.js";
import { mergeMCP, mergeSkills } from "../store/merge.js";
import { ALL_AGENTS } from "../store/paths.js";
import { readEffectiveRules, readRules, writePersonalRules } from "../store/rules.js";
import {
  readAllSkills,
  readSkills,
  resolveSkillSourceDir,
  writeSkill,
  writeSkillBundle,
} from "../store/skills.js";
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

export interface ShareImportStats {
  mcpWritten: number;
  mcpExtended: number;
  skillsWritten: number;
  skillsExtended: number;
}

export type ShareSourceId = AgentId | "plexus";

export interface ShareSourceSummary {
  source: ShareSourceId;
  agent?: AgentId;
  mcp: number;
  skills: number;
  rules: boolean;
  total: number;
}

export interface ShareConflictSummary {
  id: string;
  sources: ShareSourceId[];
  preferredSource?: ShareSourceId;
  preferredAgent?: AgentId;
}

export interface SharePlan {
  targetAgents: AgentId[];
  sources: ShareSourceSummary[];
  recommendedPrimarySource?: ShareSourceId;
  recommendedPrimaryAgent?: AgentId;
  selectedPrimarySource?: ShareSourceId;
  selectedPrimaryAgent?: AgentId;
  conflictCount: number;
  mcp: {
    safe: number;
    conflicts: ShareConflictSummary[];
  };
  skills: {
    safe: number;
    conflicts: ShareConflictSummary[];
  };
  rules: {
    sources: ShareSourceId[];
    conflict: boolean;
    preferredSource?: ShareSourceId;
    preferredAgent?: AgentId;
  };
}

export interface ShareAllOptions {
  only?: AgentId[];
  preferredAgent?: AgentId;
}

export interface ShareAllReport extends SyncReport {
  mode: "share-all";
  targetAgents: AgentId[];
  imported: ShareImportStats;
  shared: {
    mcp: number;
    skills: number;
  };
  plan: SharePlan;
  preferredAgent?: AgentId;
  conflictsResolved: number;
  rules: {
    applied: RulesApplyResult[];
    importedFrom?: AgentId;
    skipped?: string;
  };
  backup?: string;
}

const AGENT_PRIORITY: AgentId[] = [
  "codex",
  "claude-code",
  "cursor",
  "gemini-cli",
  "qwen-code",
  "factory-droid",
];

interface Variant<T> {
  item: T;
  sources: AgentId[];
  fingerprint: string;
}

interface NativeGroup<T extends { id: string }> {
  id: string;
  variants: Variant<T>[];
}

interface RulesSource {
  agent: AgentId;
  content: string;
  fingerprint: string;
}

interface NativeShareState {
  sourceSummaries: ShareSourceSummary[];
  mcpGroups: Map<string, NativeGroup<MCPServerDef>>;
  skillGroups: Map<string, NativeGroup<SkillDef>>;
  rulesSources: RulesSource[];
}

interface StoreShareState {
  sourceSummary: ShareSourceSummary;
  mcpFingerprints: Map<string, string>;
  skillFingerprints: Map<string, string>;
  rulesSource?: {
    content: string;
    fingerprint: string;
  };
}

function normalizeShareOptions(input?: AgentId[] | ShareAllOptions): ShareAllOptions {
  return Array.isArray(input) ? { only: input } : (input ?? {});
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

function sortedAgents(agents: AgentId[]): AgentId[] {
  return [...new Set(agents)].sort(
    (a, b) => AGENT_PRIORITY.indexOf(a) - AGENT_PRIORITY.indexOf(b) || a.localeCompare(b),
  );
}

function sortedSources(sources: ShareSourceId[]): ShareSourceId[] {
  return [...new Set(sources)].sort((a, b) => sourcePriority(a) - sourcePriority(b));
}

function sourcePriority(source: ShareSourceId): number {
  return source === "plexus" ? -1 : AGENT_PRIORITY.indexOf(source);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const child = record[key];
      if (child !== undefined) out[key] = sortJson(child);
    }
    return out;
  }
  return value;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function mcpFingerprint(
  item: Pick<MCPServerDef, "type" | "command" | "args" | "env" | "url" | "httpUrl" | "headers">,
): string {
  return fingerprint({
    type: item.type ?? "",
    command: item.command,
    args: item.args ?? [],
    env: item.env ?? {},
    url: item.url ?? "",
    httpUrl: item.httpUrl ?? "",
    headers: item.headers ?? {},
  });
}

function skillFingerprint(item: SkillDef): string {
  const frontmatter = Object.fromEntries(
    Object.entries(item.frontmatter ?? {}).filter(
      ([key]) => key !== "plexus_enabled_agents" && key !== "plexus_id",
    ),
  );
  return fingerprint({
    name: item.name,
    description: item.description ?? "",
    body: item.body,
    frontmatter,
  });
}

async function skillBundleFingerprint(item: SkillDef, sourceDir?: string): Promise<string> {
  const resources = sourceDir ? await readSkillResourceFingerprints(sourceDir) : [];
  return fingerprint({
    skill: JSON.parse(skillFingerprint(item)) as unknown,
    resources,
  });
}

async function readSkillResourceFingerprints(sourceDir: string): Promise<
  Array<{
    path: string;
    content: string;
  }>
> {
  const files: Array<{ path: string; content: string }> = [];

  async function walk(dir: string, relPrefix = ""): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "SKILL.md" || entry.name === ".DS_Store") continue;
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.isFile()) {
        const content = await fs.readFile(full);
        files.push({ path: rel, content: content.toString("base64") });
      }
    }
  }

  await walk(sourceDir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function addVariant<T extends { id: string }>(
  groups: Map<string, NativeGroup<T>>,
  item: T,
  source: AgentId,
  itemFingerprint: string,
): void {
  const group = groups.get(item.id) ?? { id: item.id, variants: [] };
  const variant = group.variants.find((entry) => entry.fingerprint === itemFingerprint);
  if (variant) {
    if (!variant.sources.includes(source)) variant.sources.push(source);
  } else {
    group.variants.push({ item, sources: [source], fingerprint: itemFingerprint });
  }
  groups.set(item.id, group);
}

function bestAgentFromSources(sources: ShareSourceSummary[]): AgentId | undefined {
  const nativeSources = sources.filter(
    (source): source is ShareSourceSummary & { agent: AgentId } =>
      Boolean(source.agent) && source.total > 0,
  );
  return [...nativeSources].sort(
    (a, b) =>
      b.total - a.total ||
      AGENT_PRIORITY.indexOf(a.agent) - AGENT_PRIORITY.indexOf(b.agent) ||
      a.agent.localeCompare(b.agent),
  )[0]?.agent;
}

function variantPriority(variant: Variant<unknown>): number {
  return Math.min(...variant.sources.map((source) => AGENT_PRIORITY.indexOf(source)));
}

function chooseVariant<T>(variants: Variant<T>[], preferredAgent?: AgentId): Variant<T> {
  if (preferredAgent) {
    const preferred = variants.find((variant) => variant.sources.includes(preferredAgent));
    if (preferred) return preferred;
  }
  const selected = [...variants].sort(
    (a, b) =>
      b.sources.length - a.sources.length ||
      variantPriority(a) - variantPriority(b) ||
      a.fingerprint.localeCompare(b.fingerprint),
  )[0];
  if (!selected) throw new Error("Cannot choose from an empty native config group");
  return selected;
}

function preferredAgentForVariant<T>(variant: Variant<T>, preferredAgent?: AgentId): AgentId {
  if (preferredAgent && variant.sources.includes(preferredAgent)) return preferredAgent;
  const [agent] = sortedAgents(variant.sources);
  if (!agent) throw new Error("Cannot summarize a native config variant with no sources");
  return agent;
}

function preferredSourceForConflict<T>(
  variants: Variant<T>[] | undefined,
  hasStoreVariant: boolean,
  preferredAgent?: AgentId,
): ShareSourceId {
  if (hasStoreVariant) return "plexus";
  if (!variants || variants.length === 0) return "plexus";
  return preferredAgentForVariant(chooseVariant(variants, preferredAgent), preferredAgent);
}

async function readRulesSources(targets: AgentId[]): Promise<RulesSource[]> {
  const sources: RulesSource[] = [];
  for (const agent of targets) {
    const [instruction] = instructionsForAgent(agent);
    if (!instruction) continue;
    try {
      const content = await fs.readFile(instruction.abs, "utf8");
      if (content.trim().length === 0) continue;
      sources.push({ agent, content, fingerprint: fingerprint(content) });
    } catch {
      // Agent has no readable instruction file yet.
    }
  }
  return sources;
}

function chooseRulesSource(
  sources: RulesSource[],
  preferredAgent?: AgentId,
): RulesSource | undefined {
  if (preferredAgent) {
    const preferred = sources.find((source) => source.agent === preferredAgent);
    if (preferred) return preferred;
  }
  return [...sources].sort(
    (a, b) =>
      AGENT_PRIORITY.indexOf(a.agent) - AGENT_PRIORITY.indexOf(b.agent) ||
      a.agent.localeCompare(b.agent),
  )[0];
}

async function collectNativeShareState(targets: AgentId[]): Promise<NativeShareState> {
  const mcpGroups = new Map<string, NativeGroup<MCPServerDef>>();
  const skillGroups = new Map<string, NativeGroup<SkillDef>>();
  const rulesSources = await readRulesSources(targets);
  const sourceSummaries: ShareSourceSummary[] = [];

  for (const agent of targets) {
    const [nativeMcp, nativeSkills] = await Promise.all([
      readNativeMcpFromAgent(agent),
      readNativeSkillsFromAgent(agent),
    ]);

    for (const server of nativeMcp) {
      const item: MCPServerDef = {
        id: server.id,
        type: server.type,
        command: server.command,
        args: server.args,
        env: server.env,
        url: server.url,
        httpUrl: server.httpUrl,
        headers: server.headers,
        layer: "personal",
        enabledAgents: [agent],
      };
      addVariant(mcpGroups, item, agent, mcpFingerprint(item));
    }

    for (const skill of nativeSkills) {
      const item: SkillDef = { ...skill, layer: "personal", enabledAgents: [agent] };
      addVariant(
        skillGroups,
        item,
        agent,
        await skillBundleFingerprint(item, await resolveNativeSkillSourceDir(agent, item.id)),
      );
    }

    const hasRules = rulesSources.some((source) => source.agent === agent);
    sourceSummaries.push({
      source: agent,
      agent,
      mcp: nativeMcp.length,
      skills: nativeSkills.length,
      rules: hasRules,
      total: nativeMcp.length + nativeSkills.length + (hasRules ? 1 : 0),
    });
  }

  return { sourceSummaries, mcpGroups, skillGroups, rulesSources };
}

async function collectStoreShareState(): Promise<StoreShareState> {
  const [teamMcp, personalMcp, teamSkills, personalSkills, rules] = await Promise.all([
    readMCP("team"),
    readMCP("personal"),
    readSkills("team"),
    readSkills("personal"),
    readEffectiveRules(),
  ]);
  const mcp = mergeMCP(teamMcp, personalMcp);
  const skills = mergeSkills(teamSkills, personalSkills);
  const mcpFingerprints = new Map(mcp.map((item) => [item.id, mcpFingerprint(item)]));
  const skillFingerprints = new Map<string, string>();
  for (const item of skills) {
    skillFingerprints.set(
      item.id,
      await skillBundleFingerprint(item, resolveSkillSourceDir(item.layer, item.id)),
    );
  }

  return {
    sourceSummary: {
      source: "plexus",
      mcp: mcp.length,
      skills: skills.length,
      rules: Boolean(rules),
      total: mcp.length + skills.length + (rules ? 1 : 0),
    },
    mcpFingerprints,
    skillFingerprints,
    rulesSource: rules
      ? { content: rules.content, fingerprint: fingerprint(rules.content) }
      : undefined,
  };
}

function summarizeUnionConflicts<T extends { id: string }>(
  groups: Map<string, NativeGroup<T>>,
  storeFingerprints: Map<string, string>,
  preferredAgent?: AgentId,
): ShareConflictSummary[] {
  const conflicts: ShareConflictSummary[] = [];
  const ids = new Set([...storeFingerprints.keys(), ...groups.keys()]);
  for (const id of ids) {
    const group = groups.get(id);
    const fingerprints = new Set(group?.variants.map((variant) => variant.fingerprint) ?? []);
    const storeFingerprint = storeFingerprints.get(id);
    if (storeFingerprint) fingerprints.add(storeFingerprint);
    if (fingerprints.size <= 1) continue;
    const preferredSource = preferredSourceForConflict(
      group?.variants,
      Boolean(storeFingerprint),
      preferredAgent,
    );
    conflicts.push({
      id,
      sources: sortedSources([
        ...(storeFingerprint ? (["plexus"] as const) : []),
        ...(group?.variants.flatMap((variant) => variant.sources) ?? []),
      ]),
      preferredSource,
      preferredAgent: preferredSource === "plexus" ? undefined : preferredSource,
    });
  }
  return conflicts.sort((a, b) => a.id.localeCompare(b.id));
}

function countSafeUnionGroups<T extends { id: string }>(
  groups: Map<string, NativeGroup<T>>,
  storeFingerprints: Map<string, string>,
): number {
  const ids = new Set([...storeFingerprints.keys(), ...groups.keys()]);
  return [...ids].filter((id) => {
    const fingerprints = new Set(groups.get(id)?.variants.map((variant) => variant.fingerprint));
    const storeFingerprint = storeFingerprints.get(id);
    if (storeFingerprint) fingerprints.add(storeFingerprint);
    return fingerprints.size <= 1;
  }).length;
}

function buildSharePlan(
  targetAgents: AgentId[],
  state: NativeShareState,
  store: StoreShareState,
  selectedPrimaryAgent?: AgentId,
): SharePlan {
  const recommendedPrimaryAgent = bestAgentFromSources(state.sourceSummaries);
  const ruleFingerprints = new Set([
    ...state.rulesSources.map((source) => source.fingerprint),
    ...(store.rulesSource ? [store.rulesSource.fingerprint] : []),
  ]);
  const rulesSource = chooseRulesSource(state.rulesSources, selectedPrimaryAgent);
  const mcpConflicts = summarizeUnionConflicts(
    state.mcpGroups,
    store.mcpFingerprints,
    selectedPrimaryAgent,
  );
  const skillConflicts = summarizeUnionConflicts(
    state.skillGroups,
    store.skillFingerprints,
    selectedPrimaryAgent,
  );
  const rulesConflict = ruleFingerprints.size > 1;
  const recommendedPrimarySource =
    store.sourceSummary.total > 0 ? "plexus" : recommendedPrimaryAgent;
  const selectedPrimarySource = store.sourceSummary.total > 0 ? "plexus" : selectedPrimaryAgent;

  return {
    targetAgents,
    sources: [store.sourceSummary, ...state.sourceSummaries],
    recommendedPrimarySource,
    recommendedPrimaryAgent,
    selectedPrimarySource,
    selectedPrimaryAgent,
    conflictCount: mcpConflicts.length + skillConflicts.length + (rulesConflict ? 1 : 0),
    mcp: {
      safe: countSafeUnionGroups(state.mcpGroups, store.mcpFingerprints),
      conflicts: mcpConflicts,
    },
    skills: {
      safe: countSafeUnionGroups(state.skillGroups, store.skillFingerprints),
      conflicts: skillConflicts,
    },
    rules: {
      sources: sortedSources([
        ...(store.rulesSource ? (["plexus"] as const) : []),
        ...state.rulesSources.map((source) => source.agent),
      ]),
      conflict: rulesConflict,
      preferredSource: store.rulesSource ? "plexus" : rulesSource?.agent,
      preferredAgent: store.rulesSource ? undefined : rulesSource?.agent,
    },
  };
}

async function planShareAll(options?: ShareAllOptions): Promise<{
  targetAgents: AgentId[];
  state: NativeShareState;
  store: StoreShareState;
  plan: SharePlan;
  primaryAgent?: AgentId;
}> {
  const targetAgents = await getSyncTargets(options?.only);
  const [state, store] = await Promise.all([
    collectNativeShareState(targetAgents),
    collectStoreShareState(),
  ]);
  const initial = buildSharePlan(targetAgents, state, store, options?.preferredAgent);
  const primaryAgent = options?.preferredAgent ?? initial.recommendedPrimaryAgent;
  const plan = buildSharePlan(targetAgents, state, store, primaryAgent);
  return { targetAgents, state, store, plan, primaryAgent };
}

export async function previewShareAll(options?: ShareAllOptions): Promise<SharePlan> {
  return (await planShareAll(options)).plan;
}

function importStats(
  state: NativeShareState,
  existingMcpIds: Set<string>,
  existingSkillIds: Set<string>,
): ShareImportStats {
  const stats: ShareImportStats = {
    mcpWritten: 0,
    mcpExtended: 0,
    skillsWritten: 0,
    skillsExtended: 0,
  };
  for (const id of state.mcpGroups.keys()) {
    if (existingMcpIds.has(id)) stats.mcpExtended += 1;
    else stats.mcpWritten += 1;
  }
  for (const id of state.skillGroups.keys()) {
    if (existingSkillIds.has(id)) stats.skillsExtended += 1;
    else stats.skillsWritten += 1;
  }
  return stats;
}

async function applySmartMergeToStore(
  targets: AgentId[],
  state: NativeShareState,
  preferredAgent?: AgentId,
): Promise<{ imported: ShareImportStats; mcpShared: number; skillsShared: number }> {
  if (targets.length === 0) {
    return {
      imported: { mcpWritten: 0, mcpExtended: 0, skillsWritten: 0, skillsExtended: 0 },
      mcpShared: 0,
      skillsShared: 0,
    };
  }

  const [teamMcp, personalMcp, teamSkills, personalSkills] = await Promise.all([
    readMCP("team"),
    readMCP("personal"),
    readSkills("team"),
    readSkills("personal"),
  ]);
  const storeMcp = mergeMCP(teamMcp, personalMcp);
  const storeSkills = mergeSkills(teamSkills, personalSkills);
  const imported = importStats(
    state,
    new Set(storeMcp.map((item) => item.id)),
    new Set(storeSkills.map((item) => item.id)),
  );

  const nextMcpById = new Map<string, MCPServerDef>();
  for (const item of storeMcp) {
    nextMcpById.set(item.id, withTargets({ ...item, layer: "personal" }, targets));
  }
  for (const group of state.mcpGroups.values()) {
    if (nextMcpById.has(group.id)) continue;
    const selected = chooseVariant(group.variants, preferredAgent);
    nextMcpById.set(group.id, withTargets({ ...selected.item, layer: "personal" }, targets));
  }

  const nextSkillsById = new Map<string, SkillDef>();
  const nativeSkillSources = new Map<string, AgentId[]>();
  for (const item of storeSkills) {
    nextSkillsById.set(item.id, withTargets({ ...item, layer: "personal" }, targets));
  }
  for (const group of state.skillGroups.values()) {
    if (nextSkillsById.has(group.id)) continue;
    const selected = chooseVariant(group.variants, preferredAgent);
    nextSkillsById.set(group.id, withTargets({ ...selected.item, layer: "personal" }, targets));
    nativeSkillSources.set(group.id, sortedAgents(selected.sources));
  }

  const nextMcp = [...nextMcpById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const nextSkills = [...nextSkillsById.values()].sort((a, b) => a.id.localeCompare(b.id));
  await writeMCP("personal", nextMcp);
  for (const item of nextSkills) {
    const sourceAgents = nativeSkillSources.get(item.id);
    if (sourceAgents) {
      await writeSkillBundle(item, await firstNativeSkillSourceDir(item.id, sourceAgents));
    } else {
      await writeSkill(item);
    }
  }

  return { imported, mcpShared: nextMcp.length, skillsShared: nextSkills.length };
}

async function ensurePersonalRules(
  state: NativeShareState,
  preferredAgent?: AgentId,
): Promise<AgentId | undefined> {
  const personal = await readRules("personal");
  if (personal) return undefined;

  const effective = await readEffectiveRules();
  if (effective) {
    await writePersonalRules(effective.content);
    return undefined;
  }

  const source = chooseRulesSource(state.rulesSources, preferredAgent);
  if (!source) return undefined;
  await writePersonalRules(source.content);
  return source.agent;
}

/**
 * One-click sharing flow for the dashboard and CLI.
 *
 * This intentionally does more than the lower-level `runSync()`:
 * 1. Smart-merge native MCP/skills from every enabled installed agent.
 * 2. Preserve unique items from every source, resolving same-id conflicts
 *    with the selected Primary Agent.
 * 3. Enable every personal/team MCP and skill for every installed enabled agent.
 * 4. Ensure a personal rules baseline exists, then apply it to every target.
 * 5. Run the normal MCP/skills sync.
 */
export async function runShareAll(input?: AgentId[] | ShareAllOptions): Promise<ShareAllReport> {
  const options = normalizeShareOptions(input);
  const startedAt = new Date().toISOString();
  const { targetAgents, state, plan, primaryAgent } = await planShareAll(options);

  const [{ imported, mcpShared, skillsShared }, importedRulesFrom] = await Promise.all([
    applySmartMergeToStore(targetAgents, state, primaryAgent),
    ensurePersonalRules(state, primaryAgent),
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
    plan,
    preferredAgent: primaryAgent,
    conflictsResolved: plan.conflictCount,
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
