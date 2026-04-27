import fs from "node:fs/promises";
import path from "node:path";
import { AGENT_PATHS, PLEXUS_PATHS } from "../../store/paths.js";
import type { AgentId, MCPServerDef, SyncResult } from "../../types.js";
import {
  type AgentAdapter,
  type ApplyContext,
  emptyResult,
  ensureDir,
  placeFileSymlink,
  placeLinkOrCopy,
} from "./base.js";

/**
 * Generic JSON-MCP + skill-directory adapter.
 *
 * Used by Claude Code, Cursor, Factory Droid (and any future agent that
 * stores MCP as `{ "mcpServers": {...} }` JSON and skills as a directory).
 *
 * Two MCP write modes (chosen by AGENT_PATHS[agent].mcpFileMode):
 *
 *  - "exclusive": Plexus owns the agent's MCP file. We render a canonical
 *    JSON to ~/.config/plexus/.cache/mcp/<agent>.json and symlink the
 *    agent's path to that cache. Editing the agent's path is editing the
 *    same Plexus-owned file. This is appropriate for agents whose MCP
 *    file holds nothing else (Cursor, Factory Droid).
 *
 *  - "shared" (default): the agent's file holds many other unrelated keys
 *    (Claude Code's ~/.claude.json carries auth/history/settings). We
 *    partial-write only the `mcpServers` section in place and never replace
 *    the whole file.
 *
 * Skills are always symlink-first via placeLinkOrCopy.
 */
export function makeJsonMcpAdapter(agentId: AgentId): AgentAdapter {
  return {
    id: agentId,
    async apply(ctx: ApplyContext): Promise<SyncResult> {
      const result = emptyResult(agentId);
      const caps = AGENT_PATHS[agentId];

      // ── MCP ─────────────────────────────────────────────
      if (caps.mcp) {
        const mode = caps.mcpFileMode ?? "shared";
        try {
          await ensureDir(path.dirname(caps.mcpPath));

          const enabledForAgent = ctx.mcp.filter((s) => s.enabledAgents.includes(agentId));
          if (mode === "exclusive") {
            await writeExclusive(agentId, ctx.mcp, enabledForAgent, ctx.syncStrategy);
          } else {
            await writeShared(caps.mcpPath, ctx.mcp, enabledForAgent);
          }
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
            await safeRemoveDir(dir);
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
              result.errors.push(`Skill ${skill.id} sync failed: ${(err as Error).message}`);
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

/**
 * Symlink-safe directory removal. fs.rm(recursive) on a symlink behaves
 * inconsistently across OS versions — explicitly handle the symlink case
 * by unlinking the link itself, never the target.
 */
async function safeRemoveDir(p: string): Promise<void> {
  try {
    const lst = await fs.lstat(p);
    if (lst.isSymbolicLink()) {
      await fs.unlink(p);
    } else {
      await fs.rm(p, { recursive: true, force: true });
    }
  } catch {
    // best-effort
  }
}

/** Partial-write: rewrite mcpServers section only, preserve everything else. */
async function writeShared(
  filePath: string,
  managed: MCPServerDef[],
  enabledForAgent: MCPServerDef[],
): Promise<void> {
  const enabledIds = new Set(enabledForAgent.map((s) => s.id));
  const allManagedIds = new Set(managed.map((s) => s.id));

  let existing: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(filePath, "utf8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // first write
  }

  const existingMcp = (existing.mcpServers as Record<string, unknown> | undefined) ?? {};

  // Preserve user-added (ids Plexus does not manage) and drop ones we now disown.
  const preserved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(existingMcp)) {
    if (allManagedIds.has(k)) continue; // either re-written below or removed
    preserved[k] = v;
  }

  const written: Record<string, unknown> = { ...preserved };
  for (const s of enabledForAgent) {
    written[s.id] = serializeMcp(s);
  }
  void enabledIds;

  const merged = { ...existing, mcpServers: written };
  await fs.writeFile(filePath, JSON.stringify(merged, null, 2), "utf8");
}

/**
 * Exclusive: Plexus owns the file. Render canonical to .cache/mcp/<agent>.json,
 * symlink agent path to it. We still preserve user-added entries by reading
 * the agent's current file first (resolving through the symlink).
 */
async function writeExclusive(
  agentId: AgentId,
  managed: MCPServerDef[],
  enabledForAgent: MCPServerDef[],
  syncStrategy: "symlink" | "copy",
): Promise<void> {
  const caps = AGENT_PATHS[agentId];
  await ensureDir(PLEXUS_PATHS.mcpCache);
  const cacheFile = path.join(PLEXUS_PATHS.mcpCache, `${agentId}.json`);

  const allManagedIds = new Set(managed.map((s) => s.id));

  // Read current content (could be the agent's old regular file, or our
  // existing cache via the symlink — either way, fs.readFile follows links).
  let existing: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(caps.mcpPath, "utf8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // first sync — fine
  }
  const existingMcp = (existing.mcpServers as Record<string, unknown> | undefined) ?? {};

  const preserved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(existingMcp)) {
    if (allManagedIds.has(k)) continue;
    preserved[k] = v;
  }

  const written: Record<string, unknown> = { ...preserved };
  for (const s of enabledForAgent) {
    written[s.id] = serializeMcp(s);
  }

  // For exclusive files we deliberately drop any non-mcpServers keys —
  // by definition the file is dedicated to MCP config.
  const canonical = { mcpServers: written };
  await fs.writeFile(cacheFile, JSON.stringify(canonical, null, 2), "utf8");

  // Now symlink the agent's path to the cache file. If the agent's file
  // already points here, this is a no-op. Otherwise it's removed and
  // replaced (caller has already snapshotted via the backup module).
  await placeFileSymlink(cacheFile, caps.mcpPath, syncStrategy);
}

function serializeMcp(s: MCPServerDef): Record<string, unknown> {
  return {
    command: s.command,
    ...(s.args ? { args: s.args } : {}),
    ...(s.env ? { env: s.env } : {}),
  };
}
