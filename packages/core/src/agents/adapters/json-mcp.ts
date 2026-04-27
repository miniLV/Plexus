import fs from "node:fs/promises";
import path from "node:path";
import { AGENT_PATHS } from "../../store/paths.js";
import type { AgentId, SyncResult } from "../../types.js";
import {
  ApplyContext,
  AgentAdapter,
  emptyResult,
  ensureDir,
  placeLinkOrCopy,
} from "./base.js";

/**
 * Generic JSON-MCP + skill-directory adapter.
 *
 * Used by Claude Code, Cursor, Factory Droid (and any future agent that
 * stores MCP as `{ "mcpServers": {...} }` JSON and skills as a directory).
 */
export function makeJsonMcpAdapter(agentId: AgentId): AgentAdapter {
  return {
    id: agentId,
    async apply(ctx: ApplyContext): Promise<SyncResult> {
      const result = emptyResult(agentId);
      const caps = AGENT_PATHS[agentId];

      // ── MCP ─────────────────────────────────────────────
      if (caps.mcp) {
        try {
          await ensureDir(path.dirname(caps.mcpPath));

          const enabledForAgent = ctx.mcp.filter((s) =>
            s.enabledAgents.includes(agentId),
          );
          const enabledIds = new Set(enabledForAgent.map((s) => s.id));
          // Plexus-managed ids that are disabled for this agent → remove from native config.
          const disabledManagedIds = new Set(
            ctx.mcp.filter((s) => !s.enabledAgents.includes(agentId)).map((s) => s.id),
          );

          const mcpServers: Record<string, unknown> = {};
          for (const s of enabledForAgent) {
            mcpServers[s.id] = {
              command: s.command,
              ...(s.args ? { args: s.args } : {}),
              ...(s.env ? { env: s.env } : {}),
            };
          }

          // Preserve any existing keys we didn't manage (e.g. user added by hand).
          let existing: Record<string, unknown> = {};
          try {
            const raw = await fs.readFile(caps.mcpPath, "utf8");
            existing = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            // first write, fine.
          }
          const existingMcpServers =
            (existing.mcpServers as Record<string, unknown> | undefined) ?? {};
          // Drop ids we now disown.
          const preserved: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(existingMcpServers)) {
            if (disabledManagedIds.has(k)) continue;
            if (enabledIds.has(k)) continue; // will be replaced below
            preserved[k] = v;
          }
          const merged = {
            ...existing,
            mcpServers: { ...preserved, ...mcpServers },
          };
          await fs.writeFile(caps.mcpPath, JSON.stringify(merged, null, 2), "utf8");
          result.applied.mcp = enabledForAgent.length;
        } catch (err) {
          result.errors.push(`MCP write failed: ${(err as Error).message}`);
        }
      }

      // ── Skills ──────────────────────────────────────────
      if (caps.skills) {
        try {
          await ensureDir(caps.skillsDir);
          const filtered = ctx.skills.filter((s) => s.enabledAgents.includes(agentId));
          const disabledManagedSkillIds = new Set(
            ctx.skills.filter((s) => !s.enabledAgents.includes(agentId)).map((s) => s.id),
          );

          // Remove Plexus-managed skill dirs that are now disabled for this agent.
          for (const id of disabledManagedSkillIds) {
            const dir = path.join(caps.skillsDir, id);
            try {
              await fs.rm(dir, { recursive: true, force: true });
            } catch {
              // ignore — best effort cleanup
            }
          }

          for (const skill of filtered) {
            const sourcePath = ctx.skillSourcePaths.get(skill.id);
            if (!sourcePath) {
              result.warnings.push(`No source path for skill: ${skill.id}`);
              continue;
            }
            const destDir = path.join(caps.skillsDir, skill.id);
            try {
              await placeLinkOrCopy(sourcePath, destDir, ctx.syncStrategy);
              result.applied.skills += 1;
            } catch (err) {
              result.errors.push(
                `Skill ${skill.id} sync failed: ${(err as Error).message}`,
              );
            }
          }
        } catch (err) {
          result.errors.push(`Skills sync failed: ${(err as Error).message}`);
        }
      }

      return result;
    },
  };
}
