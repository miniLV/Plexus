import fs from "node:fs/promises";
import path from "node:path";
import { detectAgents } from "../agents/detect.js";
import { instructionsForAgent } from "../agents/inspect.js";
import { quarantineCollision, snapshotSingleFile } from "../backup/index.js";
import { readConfig } from "../store/config.js";
import { ensureDir } from "../store/fs-utils.js";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS } from "../store/paths.js";
import { readEffectiveRules, readRules, rulesFile, writePersonalRules } from "../store/rules.js";
import type {
  AgentId,
  RulesApplyResult,
  RulesDetachResult,
  RulesStatus,
  RulesTargetStatus,
} from "../types.js";

function instructionTarget(agentId: AgentId): string {
  const [target] = instructionsForAgent(agentId);
  if (!target) {
    throw new Error(`No instruction file target is configured for agent ${agentId}`);
  }
  return target.abs;
}

async function readLinkTarget(filePath: string): Promise<string | undefined> {
  try {
    const target = await fs.readlink(filePath);
    return path.isAbsolute(target) ? target : path.resolve(path.dirname(filePath), target);
  } catch {
    return undefined;
  }
}

async function targetStatus(
  agent: AgentId,
  canonicalPath: string | null,
  canonicalContent: string | null,
  installed: boolean,
  enabled: boolean,
): Promise<RulesTargetStatus> {
  const targetPath = instructionTarget(agent);
  const status: RulesTargetStatus = {
    agent,
    displayName: AGENT_DISPLAY_NAMES[agent],
    targetPath,
    installed,
    enabled,
    exists: false,
    isSymlink: false,
    inSync: false,
  };

  try {
    const lst = await fs.lstat(targetPath);
    status.exists = true;
    status.isSymlink = lst.isSymbolicLink();
    if (status.isSymlink) {
      status.linkTarget = await readLinkTarget(targetPath);
    }
  } catch {
    return status;
  }

  if (!canonicalPath || canonicalContent === null) return status;

  if (status.isSymlink) {
    status.inSync = Boolean(
      status.linkTarget && path.resolve(status.linkTarget) === path.resolve(canonicalPath),
    );
    return status;
  }

  try {
    status.inSync = (await fs.readFile(targetPath, "utf8")) === canonicalContent;
  } catch {
    status.inSync = false;
  }
  return status;
}

async function placeRulesFile(opts: {
  agent: AgentId;
  sourcePath: string;
  targetPath: string;
  strategy: "symlink" | "copy";
}): Promise<{ via: "symlink" | "copy"; backedUp?: string }> {
  await ensureDir(path.dirname(opts.targetPath));

  let backedUp: string | undefined;
  try {
    const lst = await fs.lstat(opts.targetPath);
    if (lst.isSymbolicLink()) {
      await fs.unlink(opts.targetPath);
    } else {
      const dest = await quarantineCollision({
        agent: opts.agent,
        sourcePath: opts.targetPath,
      });
      if (dest) backedUp = dest;
    }
  } catch {
    // Target does not exist yet.
  }

  if (opts.strategy === "symlink") {
    try {
      await fs.symlink(opts.sourcePath, opts.targetPath, "file");
      return { via: "symlink", backedUp };
    } catch {
      // Fall back to copy when symlinks are unavailable.
    }
  }

  await fs.copyFile(opts.sourcePath, opts.targetPath);
  return { via: "copy", backedUp };
}

export async function getRulesStatus(): Promise<RulesStatus> {
  const effective = await readEffectiveRules();
  const config = await readConfig();
  const detected = detectAgents();
  const installedByAgent = new Map(detected.map((agent) => [agent.id, agent.installed]));
  const canonical = effective
    ? {
        exists: true,
        layer: effective.layer,
        path: effective.path,
        content: effective.content,
        updatedAt: effective.updatedAt,
      }
    : {
        exists: false,
        layer: null,
        path: null,
        content: null,
      };

  return {
    canonical,
    agents: await Promise.all(
      ALL_AGENTS.map((agent) =>
        targetStatus(
          agent,
          canonical.path,
          canonical.content,
          installedByAgent.get(agent) ?? false,
          config.agents[agent] !== false,
        ),
      ),
    ),
  };
}

export async function applyRulesToAgents(
  agentIds: AgentId[] = ALL_AGENTS,
): Promise<RulesApplyResult[]> {
  let personal = await readRules("personal");
  if (!personal) {
    const effective = await readEffectiveRules();
    if (effective) {
      await writePersonalRules(effective.content);
      personal = await readRules("personal");
    }
  }
  if (!personal) {
    throw new Error(
      `Cannot apply rules: personal canonical rules file does not exist at ${rulesFile("personal")}`,
    );
  }

  const config = await readConfig();
  const detected = detectAgents();
  const installedByAgent = new Map(detected.map((agent) => [agent.id, agent.installed]));
  const results: RulesApplyResult[] = [];

  for (const agent of agentIds) {
    const targetPath = instructionTarget(agent);
    if (!installedByAgent.get(agent)) {
      results.push({
        agent,
        targetPath,
        applied: false,
        skipped: true,
        reason: `${AGENT_DISPLAY_NAMES[agent]} is not installed.`,
      });
      continue;
    }
    if (config.agents[agent] === false) {
      results.push({
        agent,
        targetPath,
        applied: false,
        skipped: true,
        reason: `${AGENT_DISPLAY_NAMES[agent]} is disabled in Plexus settings.`,
      });
      continue;
    }
    try {
      let snapshotDir: string | null = null;
      try {
        await fs.lstat(targetPath);
        snapshotDir = await snapshotSingleFile(targetPath, `Apply Plexus rules to ${agent}`);
      } catch {
        // No existing target to snapshot.
      }

      const placed = await placeRulesFile({
        agent,
        sourcePath: personal.path,
        targetPath,
        strategy: config.syncStrategy,
      });

      results.push({
        agent,
        targetPath,
        applied: true,
        via: placed.via,
        backedUp: placed.backedUp,
        snapshotDir,
      });
    } catch (err) {
      results.push({
        agent,
        targetPath,
        applied: false,
        error: (err as Error).message,
      });
    }
  }

  return results;
}

export async function importRulesFromAgent(agentId: AgentId): Promise<void> {
  const targetPath = instructionTarget(agentId);
  let content: string;
  try {
    content = await fs.readFile(targetPath, "utf8");
  } catch (err) {
    throw new Error(
      `Cannot import rules from ${agentId}: failed to read ${targetPath}: ${(err as Error).message}`,
    );
  }
  await writePersonalRules(content);
}

export async function detachRulesFromAgent(agent: AgentId): Promise<RulesDetachResult> {
  const targetPath = instructionTarget(agent);
  const config = await readConfig();
  const detected = detectAgents();
  const installed = detected.find((candidate) => candidate.id === agent)?.installed ?? false;

  if (!installed) {
    return {
      agent,
      targetPath,
      detached: false,
      skipped: true,
      reason: `${AGENT_DISPLAY_NAMES[agent]} is not installed.`,
    };
  }
  if (config.agents[agent] === false) {
    return {
      agent,
      targetPath,
      detached: false,
      skipped: true,
      reason: `${AGENT_DISPLAY_NAMES[agent]} is disabled in Plexus settings.`,
    };
  }

  try {
    const lst = await fs.lstat(targetPath);
    if (!lst.isSymbolicLink()) {
      return {
        agent,
        targetPath,
        detached: false,
        skipped: true,
        reason: `${AGENT_DISPLAY_NAMES[agent]} already has a local instruction file.`,
      };
    }
    const personal = await readRules("personal");
    if (!personal) {
      return {
        agent,
        targetPath,
        detached: false,
        skipped: true,
        reason: "No personal rules baseline exists for Plexus to detach from.",
      };
    }
    const linkTarget = await readLinkTarget(targetPath);
    if (!linkTarget || path.resolve(linkTarget) !== path.resolve(personal.path)) {
      return {
        agent,
        targetPath,
        detached: false,
        skipped: true,
        reason: `${AGENT_DISPLAY_NAMES[agent]}'s instruction file is a symlink, but Plexus does not own that link.`,
      };
    }

    let content: string;
    try {
      content = await fs.readFile(targetPath, "utf8");
    } catch {
      content = personal.content;
    }

    const snapshotDir = await snapshotSingleFile(targetPath, `Detach Plexus rules from ${agent}`);
    await fs.unlink(targetPath);
    await fs.writeFile(targetPath, content, "utf8");

    return {
      agent,
      targetPath,
      detached: true,
      snapshotDir,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        agent,
        targetPath,
        detached: false,
        skipped: true,
        reason: `${AGENT_DISPLAY_NAMES[agent]} has no instruction file to detach.`,
      };
    }
    return {
      agent,
      targetPath,
      detached: false,
      error: (err as Error).message,
    };
  }
}
