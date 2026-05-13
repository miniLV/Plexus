import fs from "node:fs/promises";
import path from "node:path";
import TOML from "@iarna/toml";
import { pathExists } from "../store/fs-utils.js";
import { AGENT_PATHS, ALL_AGENTS } from "../store/paths.js";
import { parseSkillMarkdown } from "../store/skills.js";
import type { AgentId, MCPServerDef, SkillDef } from "../types.js";

/**
 * Import existing on-disk configuration from each installed AI agent into
 * the Plexus personal layer.
 *
 * Three outcomes per item id:
 *  - `new`     id is not in the Plexus store at all → write a new entry
 *              (enabledAgents = union of source agents that already have it).
 *  - `extend`  id is already in the store, but at least one source agent that
 *              currently has it natively is missing from `enabledAgents` →
 *              add those agents to `enabledAgents` of the existing entry.
 *  - `managed` id is in the store and every source agent already appears in
 *              `enabledAgents` → nothing to do (silently skipped).
 *
 * Importing never mutates the agents' native files. Only the Plexus personal
 * layer is touched, and only by `applyImport`.
 */

export interface NewItem<T> {
  kind: "new";
  item: T;
  sourceAgents: AgentId[];
}

export interface ExtendItem<T> {
  kind: "extend";
  /** The id of the existing store entry. */
  id: string;
  displayName: string;
  /** Agents to add to the existing entry's enabledAgents. */
  agentsToAdd: AgentId[];
  /** Existing enabledAgents (for display). */
  currentAgents: AgentId[];
}

export type MCPCandidate = NewItem<MCPServerDef> | ExtendItem<MCPServerDef>;
export type SkillCandidate = NewItem<SkillDef> | ExtendItem<SkillDef>;

export interface ImportPreview {
  mcp: MCPCandidate[];
  skills: SkillCandidate[];
  /** Per-agent counts of items found in the agent's native config. */
  perAgent: Record<AgentId, { mcp: number; skills: number }>;
}

export async function readNativeMcpFromAgent(agentId: AgentId): Promise<
  Array<{
    id: string;
    type?: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    httpUrl?: string;
    headers?: Record<string, string>;
  }>
> {
  const caps = AGENT_PATHS[agentId];
  if (!(await pathExists(caps.mcpPath))) return [];

  try {
    const raw = await fs.readFile(caps.mcpPath, "utf8");
    if (caps.mcpFormat === "json") {
      const data = JSON.parse(raw) as { mcpServers?: Record<string, any> };
      const m = data.mcpServers ?? {};
      return Object.entries(m).map(([id, cfg]) => readJsonMcpEntry(id, cfg));
    }
    const data = TOML.parse(raw) as { mcp_servers?: Record<string, any> };
    const m = data.mcp_servers ?? {};
    return Object.entries(m).map(([id, cfg]) => ({
      id,
      type: typeof cfg?.type === "string" ? cfg.type : undefined,
      command: String(cfg?.command ?? ""),
      args: Array.isArray(cfg?.args) ? cfg.args.map(String) : undefined,
      env:
        cfg?.env && typeof cfg.env === "object" ? (cfg.env as Record<string, string>) : undefined,
      url: typeof cfg?.url === "string" ? cfg.url : undefined,
      httpUrl: typeof cfg?.httpUrl === "string" ? cfg.httpUrl : undefined,
      headers: readJsonRecord(cfg?.http_headers ?? cfg?.headers),
    }));
  } catch {
    return [];
  }
}

function readJsonRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, String(child)]));
}

function readJsonMcpEntry(
  id: string,
  cfg: any,
): {
  id: string;
  type?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  httpUrl?: string;
  headers?: Record<string, string>;
} {
  return {
    id,
    type: typeof cfg?.type === "string" ? cfg.type : undefined,
    command: String(cfg?.command ?? ""),
    args: Array.isArray(cfg?.args) ? cfg.args.map(String) : undefined,
    env: readJsonRecord(cfg?.env),
    url: typeof cfg?.url === "string" ? cfg.url : undefined,
    httpUrl: typeof cfg?.httpUrl === "string" ? cfg.httpUrl : undefined,
    headers: readJsonRecord(cfg?.headers),
  };
}

export async function readNativeSkillsFromAgent(agentId: AgentId): Promise<SkillDef[]> {
  const caps = AGENT_PATHS[agentId];
  if (!(await pathExists(caps.skillsDir))) return [];

  try {
    const entries = await fs.readdir(caps.skillsDir, { withFileTypes: true });
    const out: SkillDef[] = [];
    for (const entry of entries) {
      const fullPath = path.join(caps.skillsDir, entry.name);

      // Decide whether this entry is a usable skill directory.
      //
      // - Real directory  → native skill (existing behavior).
      // - Symlink to directory → native skill. Cursor and other agents follow
      //   symlinked skill dirs, so the import preview must count them too.
      // - Broken / file symlink → skip.
      if (entry.isSymbolicLink()) {
        try {
          const st = await fs.stat(fullPath);
          if (!st.isDirectory()) continue;
        } catch {
          continue;
        }
      } else if (!entry.isDirectory()) {
        continue;
      }

      const skillFile = path.join(fullPath, "SKILL.md");
      if (!(await pathExists(skillFile))) continue;
      const raw = await fs.readFile(skillFile, "utf8");
      const { frontmatter, body } = parseSkillMarkdown(raw);
      out.push({
        id: entry.name,
        name: (frontmatter.name as string) ?? entry.name,
        description: (frontmatter.description as string) ?? undefined,
        body,
        frontmatter,
        layer: "personal",
        enabledAgents: [agentId],
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function resolveNativeSkillSourceDir(
  agentId: AgentId,
  skillId: string,
): Promise<string | undefined> {
  const dir = path.join(AGENT_PATHS[agentId].skillsDir, skillId);
  try {
    const st = await fs.stat(dir);
    return st.isDirectory() ? dir : undefined;
  } catch {
    return undefined;
  }
}

export async function firstNativeSkillSourceDir(
  skillId: string,
  sourceAgents: AgentId[],
): Promise<string | undefined> {
  for (const agent of sourceAgents) {
    const dir = await resolveNativeSkillSourceDir(agent, skillId);
    if (dir) return dir;
  }
  return undefined;
}

export interface BuildImportPreviewArgs {
  storeMcp: MCPServerDef[];
  storeSkills: SkillDef[];
}

export async function buildImportPreview(args: BuildImportPreviewArgs): Promise<ImportPreview> {
  const perAgent = Object.fromEntries(
    ALL_AGENTS.map((agent) => [agent, { mcp: 0, skills: 0 }]),
  ) as Record<AgentId, { mcp: number; skills: number }>;

  // Aggregate native items across all agents, keyed by id.
  const nativeMcp = new Map<
    string,
    {
      first: {
        type?: string;
        command: string;
        args?: string[];
        env?: Record<string, string>;
        url?: string;
        httpUrl?: string;
        headers?: Record<string, string>;
      };
      sources: AgentId[];
    }
  >();
  const nativeSkills = new Map<string, { first: SkillDef; sources: AgentId[] }>();

  for (const agentId of ALL_AGENTS) {
    const mcps = await readNativeMcpFromAgent(agentId);
    perAgent[agentId].mcp = mcps.length;
    for (const m of mcps) {
      const entry = nativeMcp.get(m.id);
      if (entry) {
        if (!entry.sources.includes(agentId)) entry.sources.push(agentId);
      } else {
        nativeMcp.set(m.id, {
          first: {
            type: m.type,
            command: m.command,
            args: m.args,
            env: m.env,
            url: m.url,
            httpUrl: m.httpUrl,
            headers: m.headers,
          },
          sources: [agentId],
        });
      }
    }

    const skills = await readNativeSkillsFromAgent(agentId);
    perAgent[agentId].skills = skills.length;
    for (const s of skills) {
      const entry = nativeSkills.get(s.id);
      if (entry) {
        if (!entry.sources.includes(agentId)) entry.sources.push(agentId);
      } else {
        nativeSkills.set(s.id, { first: s, sources: [agentId] });
      }
    }
  }

  const storeMcpById = new Map(args.storeMcp.map((m) => [m.id, m]));
  const storeSkillsById = new Map(args.storeSkills.map((s) => [s.id, s]));

  const mcp: MCPCandidate[] = [];
  for (const [id, native] of nativeMcp) {
    const inStore = storeMcpById.get(id);
    if (inStore) {
      const missing = native.sources.filter((a) => !inStore.enabledAgents.includes(a));
      if (missing.length === 0) continue;
      mcp.push({
        kind: "extend",
        id,
        displayName: id,
        agentsToAdd: missing,
        currentAgents: inStore.enabledAgents,
      });
    } else {
      mcp.push({
        kind: "new",
        item: {
          id,
          type: native.first.type,
          command: native.first.command,
          args: native.first.args,
          env: native.first.env,
          url: native.first.url,
          httpUrl: native.first.httpUrl,
          headers: native.first.headers,
          layer: "personal",
          enabledAgents: [...native.sources],
        },
        sourceAgents: native.sources,
      });
    }
  }

  const skills: SkillCandidate[] = [];
  for (const [id, native] of nativeSkills) {
    const inStore = storeSkillsById.get(id);
    if (inStore) {
      const missing = native.sources.filter((a) => !inStore.enabledAgents.includes(a));
      if (missing.length === 0) continue;
      skills.push({
        kind: "extend",
        id,
        displayName: native.first.name,
        agentsToAdd: missing,
        currentAgents: inStore.enabledAgents,
      });
    } else {
      skills.push({
        kind: "new",
        item: { ...native.first, enabledAgents: [...native.sources] },
        sourceAgents: native.sources,
      });
    }
  }

  return { mcp, skills, perAgent };
}
