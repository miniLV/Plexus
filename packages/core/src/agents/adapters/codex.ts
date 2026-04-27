import fs from "node:fs/promises";
import path from "node:path";
import TOML from "@iarna/toml";
import { AGENT_PATHS } from "../../store/paths.js";
import type { SyncResult } from "../../types.js";
import {
  ApplyContext,
  AgentAdapter,
  emptyResult,
  ensureDir,
  placeLinkOrCopy,
} from "./base.js";

/**
 * Codex adapter.
 *
 * Codex stores MCP servers in TOML at ~/.codex/config.toml under
 * `[mcp_servers.<id>]` tables. Skills go under ~/.codex/prompts.
 */
export const codexAdapter: AgentAdapter = {
  id: "codex",
  async apply(ctx: ApplyContext): Promise<SyncResult> {
    const result = emptyResult("codex");
    const caps = AGENT_PATHS.codex;

    // ── MCP (JSON → TOML) ─────────────────────────────────
    try {
      await ensureDir(path.dirname(caps.mcpPath));

      const filtered = ctx.mcp.filter((s) => s.enabledAgents.includes("codex"));
      let existing: any = {};
      try {
        const raw = await fs.readFile(caps.mcpPath, "utf8");
        existing = TOML.parse(raw);
      } catch {
        // first write
      }
      existing.mcp_servers = existing.mcp_servers ?? {};
      for (const s of filtered) {
        existing.mcp_servers[s.id] = {
          command: s.command,
          ...(s.args ? { args: s.args } : {}),
          ...(s.env ? { env: s.env } : {}),
        };
      }
      await fs.writeFile(caps.mcpPath, TOML.stringify(existing), "utf8");
      result.applied.mcp = filtered.length;
    } catch (err) {
      result.errors.push(`Codex MCP write failed: ${(err as Error).message}`);
    }

    // ── Skills (prompts directory) ────────────────────────
    try {
      await ensureDir(caps.skillsDir);
      const filtered = ctx.skills.filter((s) => s.enabledAgents.includes("codex"));
      for (const skill of filtered) {
        const sourcePath = ctx.skillSourcePaths.get(skill.id);
        if (!sourcePath) continue;
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
      result.errors.push(`Codex skills sync failed: ${(err as Error).message}`);
    }

    return result;
  },
};
