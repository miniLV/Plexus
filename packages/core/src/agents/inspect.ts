import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../store/fs-utils.js";
import { AGENT_DISPLAY_NAMES, AGENT_PATHS, AGENT_ROOTS } from "../store/paths.js";
import type { AgentId } from "../types.js";
import { isAgentInstalled } from "./detect.js";

/**
 * "Agent inspector": everything the dashboard needs to render the
 * /agents/<id> detail page in one read.
 *
 * Returns enough context for the UI to:
 *  - Show whether the MCP file is a Plexus symlink, a regular file, or
 *    missing entirely. If a symlink, where it points.
 *  - List the skill folders the agent currently exposes, with whether
 *    each one is symlinked or a real directory (i.e. "still owned by the
 *    agent" vs "managed by Plexus").
 *  - Surface "instruction" files Plexus does NOT yet manage but which
 *    users commonly hand-edit:
 *       Claude Code → ~/.claude/CLAUDE.md
 *       Cursor       → ~/.cursor/AGENTS.md (and per-project .cursorrules)
 *       Codex        → ~/.codex/AGENTS.md
 *       Gemini CLI  → ~/.gemini/GEMINI.md
 *       Qwen Code   → ~/.qwen/QWEN.md
 *       Factory Droid → ~/.factory/AGENTS.md (if user keeps one)
 *    These are simple read/write so the dashboard can offer a textarea.
 */

export interface FileStatus {
  path: string;
  exists: boolean;
  isSymlink: boolean;
  /** If symlink, the resolved target path. */
  linkTarget?: string;
  /** Size in bytes (resolved through any symlink). */
  size?: number;
  /** Last modification time. */
  mtime?: string;
}

export interface SkillEntry {
  id: string;
  /** Path in the agent's skills directory. */
  path: string;
  isSymlink: boolean;
  linkTarget?: string;
  /** Whether SKILL.md exists inside. */
  hasSkillMd: boolean;
}

export interface InstructionFile {
  /** Display label shown in the UI. */
  label: string;
  /** Convention (e.g. "CLAUDE.md", "AGENTS.md"). */
  filename: string;
  status: FileStatus;
}

export interface AgentInspection {
  id: AgentId;
  displayName: string;
  rootDir: string;
  installed: boolean;
  mcpFile: FileStatus;
  /** "exclusive" → Plexus owns the whole file; "shared" → partial-write. */
  mcpFileMode: "exclusive" | "shared";
  /** Agent skill directory (if any). */
  skillsDir: FileStatus;
  /** Per-skill folder entries. */
  skills: SkillEntry[];
  /** Instruction files the user might want to edit. */
  instructionFiles: InstructionFile[];
}

async function statFile(p: string): Promise<FileStatus> {
  const status: FileStatus = { path: p, exists: false, isSymlink: false };
  try {
    const lst = await fs.lstat(p);
    status.exists = true;
    status.isSymlink = lst.isSymbolicLink();
    if (status.isSymlink) {
      try {
        const t = await fs.readlink(p);
        status.linkTarget = path.isAbsolute(t) ? t : path.resolve(path.dirname(p), t);
      } catch {
        // ignore
      }
    }
    try {
      const s = await fs.stat(p); // follows symlink
      status.size = s.size;
      status.mtime = s.mtime.toISOString();
    } catch {
      // dangling symlink
    }
  } catch {
    // not present
  }
  return status;
}

async function listSkills(skillsDir: string): Promise<SkillEntry[]> {
  if (!(await pathExists(skillsDir))) return [];
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const out: SkillEntry[] = [];
    for (const entry of entries) {
      // Skip OS noise and Plexus's own internal backup folders.
      if (entry.name.startsWith(".")) continue;
      if (entry.name.includes(".plexus-backup-")) continue;
      const full = path.join(skillsDir, entry.name);
      let isSymlink = false;
      let linkTarget: string | undefined;
      try {
        const lst = await fs.lstat(full);
        isSymlink = lst.isSymbolicLink();
        if (isSymlink) {
          const t = await fs.readlink(full);
          linkTarget = path.isAbsolute(t) ? t : path.resolve(path.dirname(full), t);
        }
      } catch {
        continue;
      }
      // Treat as skill if dir or symlink-to-dir.
      const skillMd = path.join(full, "SKILL.md");
      const hasSkillMd = await pathExists(skillMd);
      out.push({
        id: entry.name,
        path: full,
        isSymlink,
        linkTarget,
        hasSkillMd,
      });
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

export function instructionsForAgent(
  agentId: AgentId,
): Array<{ label: string; filename: string; abs: string }> {
  const root = AGENT_ROOTS[agentId];
  switch (agentId) {
    case "claude-code":
      return [
        {
          label: "CLAUDE.md (user-level memory)",
          filename: "CLAUDE.md",
          abs: path.join(root, "CLAUDE.md"),
        },
      ];
    case "cursor":
      return [
        {
          label: "AGENTS.md (user-level)",
          filename: "AGENTS.md",
          abs: path.join(root, "AGENTS.md"),
        },
      ];
    case "codex":
      return [
        {
          label: "AGENTS.md (user-level)",
          filename: "AGENTS.md",
          abs: path.join(root, "AGENTS.md"),
        },
      ];
    case "gemini-cli":
      return [
        {
          label: "GEMINI.md (user-level)",
          filename: "GEMINI.md",
          abs: path.join(root, "GEMINI.md"),
        },
      ];
    case "qwen-code":
      return [
        {
          label: "QWEN.md (user-level)",
          filename: "QWEN.md",
          abs: path.join(root, "QWEN.md"),
        },
      ];
    case "factory-droid":
      return [
        {
          label: "AGENTS.md (user-level)",
          filename: "AGENTS.md",
          abs: path.join(root, "AGENTS.md"),
        },
      ];
  }
}

export async function inspectAgent(agentId: AgentId): Promise<AgentInspection> {
  const caps = AGENT_PATHS[agentId];
  const root = AGENT_ROOTS[agentId];
  const installed = isAgentInstalled(agentId);

  const [mcpFile, skillsDir] = await Promise.all([
    statFile(caps.mcpPath),
    statFile(caps.skillsDir),
  ]);
  const skills = caps.skills ? await listSkills(caps.skillsDir) : [];

  const instructionFiles: InstructionFile[] = [];
  for (const ins of instructionsForAgent(agentId)) {
    instructionFiles.push({
      label: ins.label,
      filename: ins.filename,
      status: await statFile(ins.abs),
    });
  }

  return {
    id: agentId,
    displayName: AGENT_DISPLAY_NAMES[agentId],
    rootDir: root,
    installed,
    mcpFile,
    mcpFileMode: caps.mcpFileMode ?? "shared",
    skillsDir,
    skills,
    instructionFiles,
  };
}

/** Read a file (small text; the UI only enables editing for instruction files & SKILL.md). */
export async function readTextFile(absPath: string): Promise<string> {
  return fs.readFile(absPath, "utf8");
}

/** Write a file, creating parent dir as needed. (Caller is responsible for backup if it cares.) */
export async function writeTextFile(absPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, "utf8");
}
