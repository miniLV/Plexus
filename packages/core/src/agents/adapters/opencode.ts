import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { quarantineCollision } from "../../backup/index.js";
import { AGENT_PATHS, PLEXUS_PATHS } from "../../store/paths.js";
import type { MCPServerDef, SkillDef, SyncResult } from "../../types.js";
import {
  type AgentAdapter,
  type ApplyContext,
  cleanupManagedSkillLinks,
  emptyResult,
  ensureDir,
  isPlexusStoreSkillPath,
  placeFileSymlink,
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
 * Skills go under `~/.config/opencode/skills/`; Codex-style slash-command
 * skills (`disable-model-invocation: true`) are projected as commands under
 * `~/.config/opencode/commands/` instead.
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

      const commandSkills = filtered.filter(isCodexCommandSkill);
      const normalSkills = filtered.filter((s) => !isCodexCommandSkill(s));

      // Codex slash-command skills surface as OpenCode commands (/<id>), so any
      // previously synced skill link must not linger in the skills directory.
      for (const skill of commandSkills) {
        await removeManagedSkillLink(caps.skillsDir, skill.id);
      }

      for (const skill of normalSkills) {
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

      await applyCommandSkills(commandSkills, ctx, result);
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

/**
 * Codex-native skills opt out of model invocation with
 * `disable-model-invocation: true`; they are slash commands, not auto-invoked
 * skills. OpenCode has no such field, so we project them as commands.
 */
function isCodexCommandSkill(skill: SkillDef): boolean {
  const value = skill.frontmatter?.["disable-model-invocation"];
  return value === true || value === "true";
}

/** Remove a Plexus-managed skill symlink for a command-style skill. */
async function removeManagedSkillLink(skillsDir: string, id: string): Promise<void> {
  const linkPath = path.join(skillsDir, id);
  try {
    const lst = await fs.lstat(linkPath);
    if (!lst.isSymbolicLink()) return;
    const rawTarget = await fs.readlink(linkPath);
    const target = path.isAbsolute(rawTarget)
      ? rawTarget
      : path.resolve(path.dirname(linkPath), rawTarget);
    if (!isPlexusStoreSkillPath(target)) return;
    await fs.unlink(linkPath);
  } catch {
    // missing or unreadable — nothing to remove
  }
}

async function applyCommandSkills(
  commandSkills: SkillDef[],
  ctx: ApplyContext,
  result: SyncResult,
): Promise<void> {
  const commandsDir = AGENT_PATHS.opencode.commandsDir;
  if (!commandsDir) return;
  await ensureDir(commandsDir);

  const enabledIds = new Set(commandSkills.map((s) => s.id));
  await cleanupManagedCommandLinks(commandsDir, enabledIds);

  for (const skill of commandSkills) {
    try {
      const cachePath = await writeCommandFile(skill);
      const destPath = path.join(commandsDir, `${skill.id}.md`);
      await placeCommand(cachePath, destPath, ctx.syncStrategy);
      result.applied.skills += 1;
    } catch (err) {
      result.errors.push(`Command ${skill.id} sync failed: ${(err as Error).message}`);
    }
  }
}

async function writeCommandFile(skill: SkillDef): Promise<string> {
  await ensureDir(PLEXUS_PATHS.commandsCache);
  const filePath = path.join(PLEXUS_PATHS.commandsCache, `${skill.id}.md`);
  const description = skill.description?.trim() || skill.name;
  const frontmatter = YAML.stringify({ description }).trim();
  const content = `---\n${frontmatter}\n---\n${skill.body.trimStart()}`;
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

async function placeCommand(
  cachePath: string,
  destPath: string,
  strategy: "symlink" | "copy",
): Promise<void> {
  try {
    const lst = await fs.lstat(destPath);
    if (!lst.isSymbolicLink()) {
      await quarantineCollision({ agent: "opencode", sourcePath: destPath });
    }
  } catch {
    // missing — fine
  }
  await placeFileSymlink(cachePath, destPath, strategy);
}

async function cleanupManagedCommandLinks(
  commandsDir: string,
  enabledIds: Set<string>,
): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(commandsDir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const id = name.slice(0, -".md".length);
    if (enabledIds.has(id)) continue;
    const filePath = path.join(commandsDir, name);
    let target: string;
    try {
      const lst = await fs.lstat(filePath);
      if (!lst.isSymbolicLink()) continue;
      const rawTarget = await fs.readlink(filePath);
      target = path.isAbsolute(rawTarget)
        ? rawTarget
        : path.resolve(path.dirname(filePath), rawTarget);
    } catch {
      continue;
    }
    if (isPlexusCommandCachePath(target)) {
      await fs.unlink(filePath).catch(() => {});
    }
  }
}

function isPlexusCommandCachePath(target: string): boolean {
  const relative = path.relative(path.resolve(PLEXUS_PATHS.commandsCache), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
