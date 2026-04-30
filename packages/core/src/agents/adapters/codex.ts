import fs from "node:fs/promises";
import path from "node:path";
import TOML from "@iarna/toml";
import { AGENT_PATHS } from "../../store/paths.js";
import type { SyncResult } from "../../types.js";
import {
  type AgentAdapter,
  type ApplyContext,
  emptyResult,
  ensureDir,
  placeLinkOrCopy,
} from "./base.js";

/**
 * Codex adapter.
 *
 * Codex stores MCP servers in TOML at ~/.codex/config.toml under
 * `[mcp_servers.<id>]` tables. Skills go under ~/.codex/skills.
 */
export const codexAdapter: AgentAdapter = {
  id: "codex",
  async apply(ctx: ApplyContext): Promise<SyncResult> {
    const result = emptyResult("codex");
    const caps = AGENT_PATHS.codex;

    // ── MCP (JSON → TOML) ─────────────────────────────────
    try {
      await ensureDir(path.dirname(caps.mcpPath));

      const enabledForAgent = ctx.mcp.filter((s) => s.enabledAgents.includes("codex"));
      const enabledIds = new Set(enabledForAgent.map((s) => s.id));
      const disabledManagedIds = new Set(
        ctx.mcp.filter((s) => !s.enabledAgents.includes("codex")).map((s) => s.id),
      );

      let existing: any = {};
      try {
        const raw = await fs.readFile(caps.mcpPath, "utf8");
        existing = TOML.parse(raw);
      } catch {
        // first write
      }
      const existingServers = (existing.mcp_servers ?? {}) as Record<string, any>;
      const preserved: Record<string, any> = {};
      for (const [k, v] of Object.entries(existingServers)) {
        if (disabledManagedIds.has(k)) continue;
        if (enabledIds.has(k)) continue; // will be replaced below
        preserved[k] = v;
      }
      const nextServers: Record<string, any> = { ...preserved };
      for (const s of enabledForAgent) {
        nextServers[s.id] = {
          command: s.command,
          ...(s.args ? { args: s.args } : {}),
          ...(s.env ? { env: s.env } : {}),
        };
      }
      existing.mcp_servers = nextServers;
      await fs.writeFile(caps.mcpPath, TOML.stringify(existing), "utf8");
      result.applied.mcp = enabledForAgent.length;
    } catch (err) {
      result.errors.push(`Codex MCP write failed: ${(err as Error).message}`);
    }

    // ── Skills ────────────────────────────────────────────
    try {
      await ensureDir(caps.skillsDir);
      const filtered = ctx.skills.filter((s) => s.enabledAgents.includes("codex"));
      const disabledManagedSkillIds = new Set(
        ctx.skills.filter((s) => !s.enabledAgents.includes("codex")).map((s) => s.id),
      );
      for (const id of disabledManagedSkillIds) {
        const dir = path.join(caps.skillsDir, id);
        try {
          // Symlink-safe removal: lstat first, unlink for symlinks, rm for real dirs.
          const lst = await fs.lstat(dir);
          if (lst.isSymbolicLink()) {
            await fs.unlink(dir);
          } else {
            await fs.rm(dir, { recursive: true, force: true });
          }
        } catch {
          // best effort cleanup
        }
      }

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
      result.errors.push(`Codex skills sync failed: ${(err as Error).message}`);
    }

    return result;
  },
};
