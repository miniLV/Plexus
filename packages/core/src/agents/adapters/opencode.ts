import fs from "node:fs/promises";
import path from "node:path";
import { AGENT_PATHS } from "../../store/paths.js";
import type { MCPServerDef, SyncResult } from "../../types.js";
import {
  type AgentAdapter,
  type ApplyContext,
  cleanupManagedSkillLinks,
  emptyResult,
  ensureDir,
  placeLinkOrCopy,
} from "./base.js";

/**
 * OpenCode adapter.
 *
 * OpenCode keeps its global config at `~/.config/opencode/opencode.json`.
 * MCP servers live under the `mcp` key (not `mcpServers`), using a shape that
 * differs from the other JSON agents:
 *
 *   "mcp": {
 *     "name": { "type": "local",  "command": ["npx", "-y", "..."], "environment": {...} }
 *     "name": { "type": "remote", "url": "...", "headers": {...} }
 *   }
 *
 * The file also carries model/permission/provider/other keys, so we
 * partial-write only the `mcp` section and preserve everything else.
 * Skills go under `~/.config/opencode/skills/`.
 */
export const opencodeAdapter: AgentAdapter = {
  id: "opencode",
  async apply(ctx: ApplyContext): Promise<SyncResult> {
    const result = emptyResult("opencode");
    const caps = AGENT_PATHS.opencode;

    // ── MCP (Plexus → OpenCode `mcp` shape) ───────────────────────────
    try {
      await ensureDir(path.dirname(caps.mcpPath));

      const enabledForAgent = ctx.mcp.filter((s) => s.enabledAgents.includes("opencode"));
      const writableForAgent = enabledForAgent.filter((s) => hasMcpTransport(s));
      for (const s of enabledForAgent) {
        if (!hasMcpTransport(s))
          result.warnings.push(`Skipping MCP ${s.id}: missing command or url`);
      }
      const enabledIds = new Set(enabledForAgent.map((s) => s.id));
      const disabledManagedIds = new Set(
        ctx.mcp.filter((s) => !s.enabledAgents.includes("opencode")).map((s) => s.id),
      );

      let existing: Record<string, unknown> = {};
      try {
        const raw = await fs.readFile(caps.mcpPath, "utf8");
        existing = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        // first write
      }
      const existingMcp = (existing.mcp as Record<string, unknown> | undefined) ?? {};
      const preserved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(existingMcp)) {
        if (disabledManagedIds.has(k)) continue;
        if (enabledIds.has(k)) continue; // will be replaced below
        preserved[k] = v;
      }
      const nextMcp: Record<string, unknown> = { ...preserved };
      for (const s of writableForAgent) {
        nextMcp[s.id] = serializeOpenCodeMcp(s);
      }
      existing.mcp = nextMcp;
      await fs.writeFile(caps.mcpPath, JSON.stringify(existing, null, 2), "utf8");
      result.applied.mcp = writableForAgent.length;
    } catch (err) {
      result.errors.push(`OpenCode MCP write failed: ${(err as Error).message}`);
    }

    // ── Skills ────────────────────────────────────────────────────────
    try {
      await ensureDir(caps.skillsDir);
      const filtered = ctx.skills.filter((s) => s.enabledAgents.includes("opencode"));
      await cleanupManagedSkillLinks(ctx);

      for (const skill of filtered) {
        const sourcePath = ctx.skillSourcePaths.get(skill.id);
        if (!sourcePath) continue;
        const destDir = path.join(caps.skillsDir, skill.id);
        try {
          await placeLinkOrCopy(sourcePath, destDir, ctx.syncStrategy);
          result.applied.skills += 1;
        } catch (err) {
          result.errors.push(`Skill ${skill.id} sync failed: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      result.errors.push(`OpenCode skills sync failed: ${(err as Error).message}`);
    }

    return result;
  },
};

function hasMcpTransport(s: { command: string; url?: string; httpUrl?: string }): boolean {
  return Boolean(s.command.trim() || s.url?.trim() || s.httpUrl?.trim());
}

function hasEntries(value: Record<string, string> | undefined): value is Record<string, string> {
  return Boolean(value && Object.keys(value).length > 0);
}

function serializeOpenCodeMcp(s: MCPServerDef): Record<string, unknown> {
  const url = s.url?.trim() || s.httpUrl?.trim();
  if (url) {
    return {
      type: "remote",
      url,
      ...(hasEntries(s.headers) ? { headers: s.headers } : {}),
    };
  }
  return {
    type: "local",
    command: [s.command.trim(), ...(s.args ?? [])],
    ...(hasEntries(s.env) ? { environment: s.env } : {}),
  };
}
