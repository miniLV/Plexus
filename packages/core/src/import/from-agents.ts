import fs from "node:fs/promises";
import path from "node:path";
import TOML from "@iarna/toml";
import {
  AGENT_PATHS,
  ALL_AGENTS,
} from "../store/paths.js";
import { pathExists } from "../store/fs-utils.js";
import { parseSkillMarkdown } from "../store/skills.js";
import type {
  AgentId,
  MCPServerDef,
  SkillDef,
} from "../types.js";

/**
 * Import existing on-disk configuration from each installed AI agent into a
 * single Plexus "personal" layer payload.
 *
 * - MCP servers from each agent are deduplicated by `id`. When the same id
 *   appears in multiple agents, the first occurrence wins for the
 *   `command/args/env` fields, and the union of source agents is recorded
 *   under `enabledAgents` (so the merged record reflects "this server is
 *   already published to Cursor and Codex" etc.).
 * - Skills are deduplicated by directory name (`<id>`). When the same id
 *   appears in multiple agents, the first one wins for body/frontmatter
 *   and the union of source agents is recorded under `enabledAgents`.
 *
 * Importing does NOT mutate the original files — it only reads them.
 * The caller decides whether to write the result into the personal layer.
 */

export interface ImportedItem<T> {
  item: T;
  sourceAgents: AgentId[];
}

export interface ImportPreview {
  mcp: ImportedItem<MCPServerDef>[];
  skills: ImportedItem<SkillDef>[];
  /** Items skipped because the same id already exists in personal layer. */
  skipped: {
    mcp: string[];
    skills: string[];
  };
  /** Per-agent counts found before dedup. */
  perAgent: Record<AgentId, { mcp: number; skills: number }>;
}

async function readMcpFromAgent(agentId: AgentId): Promise<Array<{ id: string; command: string; args?: string[]; env?: Record<string, string> }>> {
  const caps = AGENT_PATHS[agentId];
  if (!(await pathExists(caps.mcpPath))) return [];

  try {
    const raw = await fs.readFile(caps.mcpPath, "utf8");
    if (caps.mcpFormat === "json") {
      const data = JSON.parse(raw) as { mcpServers?: Record<string, any> };
      const m = data.mcpServers ?? {};
      return Object.entries(m).map(([id, cfg]) => ({
        id,
        command: String(cfg?.command ?? ""),
        args: Array.isArray(cfg?.args) ? cfg.args.map(String) : undefined,
        env: cfg?.env && typeof cfg.env === "object" ? cfg.env : undefined,
      }));
    } else {
      const data = TOML.parse(raw) as { mcp_servers?: Record<string, any> };
      const m = data.mcp_servers ?? {};
      return Object.entries(m).map(([id, cfg]) => ({
        id,
        command: String(cfg?.command ?? ""),
        args: Array.isArray(cfg?.args) ? cfg.args.map(String) : undefined,
        env: cfg?.env && typeof cfg.env === "object" ? cfg.env : undefined,
      }));
    }
  } catch {
    return [];
  }
}

async function readSkillsFromAgent(agentId: AgentId): Promise<SkillDef[]> {
  const caps = AGENT_PATHS[agentId];
  if (!(await pathExists(caps.skillsDir))) return [];

  try {
    const entries = await fs.readdir(caps.skillsDir, { withFileTypes: true });
    const out: SkillDef[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(caps.skillsDir, entry.name, "SKILL.md");
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

export async function buildImportPreview(opts: {
  existingPersonalMcpIds: string[];
  existingPersonalSkillIds: string[];
}): Promise<ImportPreview> {
  const perAgent: Record<AgentId, { mcp: number; skills: number }> = {
    "claude-code": { mcp: 0, skills: 0 },
    cursor: { mcp: 0, skills: 0 },
    codex: { mcp: 0, skills: 0 },
    "factory-droid": { mcp: 0, skills: 0 },
  };

  const mcpById = new Map<string, ImportedItem<MCPServerDef>>();
  const skillsById = new Map<string, ImportedItem<SkillDef>>();
  const skipped = { mcp: [] as string[], skills: [] as string[] };

  for (const agentId of ALL_AGENTS) {
    const mcps = await readMcpFromAgent(agentId);
    perAgent[agentId].mcp = mcps.length;
    for (const m of mcps) {
      if (opts.existingPersonalMcpIds.includes(m.id)) {
        if (!skipped.mcp.includes(m.id)) skipped.mcp.push(m.id);
        continue;
      }
      const existing = mcpById.get(m.id);
      if (existing) {
        if (!existing.sourceAgents.includes(agentId)) existing.sourceAgents.push(agentId);
        existing.item.enabledAgents = [...existing.sourceAgents];
      } else {
        mcpById.set(m.id, {
          item: {
            id: m.id,
            command: m.command,
            args: m.args,
            env: m.env,
            layer: "personal",
            enabledAgents: [agentId],
          },
          sourceAgents: [agentId],
        });
      }
    }

    const skills = await readSkillsFromAgent(agentId);
    perAgent[agentId].skills = skills.length;
    for (const s of skills) {
      if (opts.existingPersonalSkillIds.includes(s.id)) {
        if (!skipped.skills.includes(s.id)) skipped.skills.push(s.id);
        continue;
      }
      const existing = skillsById.get(s.id);
      if (existing) {
        if (!existing.sourceAgents.includes(agentId)) existing.sourceAgents.push(agentId);
        existing.item.enabledAgents = [...existing.sourceAgents];
      } else {
        skillsById.set(s.id, {
          item: { ...s, enabledAgents: [agentId] },
          sourceAgents: [agentId],
        });
      }
    }
  }

  return {
    mcp: Array.from(mcpById.values()),
    skills: Array.from(skillsById.values()),
    skipped,
    perAgent,
  };
}
