import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isAgentInstalled } from "../agents/detect.js";
import { instructionsForAgent } from "../agents/inspect.js";
import { listBackups } from "../backup/index.js";
import { pathExists } from "../store/fs-utils.js";
import {
  AGENT_DISPLAY_NAMES,
  AGENT_PATHS,
  AGENT_ROOTS,
  ALL_AGENTS,
  PLEXUS_PATHS,
} from "../store/paths.js";
import type { AgentId } from "../types.js";

/**
 * "Debug snapshot" — a one-shot dump of every path Plexus cares about.
 *
 * Designed to be copy/pasted into a chat with a maintainer when something
 * goes wrong (sync didn't take effect, symlink looks weird, file size is 0,
 * etc.). It deliberately avoids reading file *contents* — only metadata —
 * so secrets in `~/.claude.json` etc. never leak.
 */

export interface PathStat {
  /** Absolute path. */
  path: string;
  /** Path with `$HOME` collapsed to `~`, for readable output. */
  display: string;
  exists: boolean;
  /** "file" | "dir" | "symlink" | "missing" */
  kind: "file" | "dir" | "symlink" | "missing";
  /** If symlink: the absolute target. */
  linkTarget?: string;
  /** If symlink: whether the target currently exists. */
  linkTargetExists?: boolean;
  /** Size in bytes (resolved through symlink). */
  size?: number;
  /** ISO mtime (resolved through symlink). */
  mtime?: string;
  /** For directories: number of entries (skipping dotfiles & .plexus-backup-*). */
  entryCount?: number;
}

export interface DirectoryListing {
  dir: PathStat;
  entries: PathStat[];
}

export interface AgentDebugBlock {
  id: AgentId;
  displayName: string;
  installed: boolean;
  mcpFileMode: "exclusive" | "shared";
  root: PathStat;
  mcpFile: PathStat;
  instructionFile: PathStat | null;
  skillsDir: PathStat;
  skillEntries: PathStat[];
}

export interface PlexusStoreBlock {
  root: PathStat;
  config: PathStat;
  team: PathStat;
  personal: PathStat;
  cacheMcp: PathStat;
  backups: PathStat;
  teamMcpServers: PathStat;
  personalMcpServers: PathStat;
  teamSkillEntries: PathStat[];
  personalSkillEntries: PathStat[];
  cacheMcpEntries: PathStat[];
  backupCount: number;
}

export interface DebugSnapshot {
  generatedAt: string;
  host: { platform: string; release: string; node: string; home: string };
  plexus: PlexusStoreBlock;
  agents: AgentDebugBlock[];
}

const HOME = os.homedir();

function tilde(p: string): string {
  if (p === HOME) return "~";
  if (p.startsWith(`${HOME}/`)) return `~/${p.slice(HOME.length + 1)}`;
  return p;
}

async function statPath(p: string): Promise<PathStat> {
  const out: PathStat = {
    path: p,
    display: tilde(p),
    exists: false,
    kind: "missing",
  };
  let lst: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    lst = await fs.lstat(p);
  } catch {
    return out;
  }
  out.exists = true;
  if (lst.isSymbolicLink()) {
    out.kind = "symlink";
    try {
      const t = await fs.readlink(p);
      out.linkTarget = path.isAbsolute(t) ? t : path.resolve(path.dirname(p), t);
      out.linkTargetExists = await pathExists(out.linkTarget);
    } catch {
      // ignore
    }
    try {
      const s = await fs.stat(p); // follows the symlink
      out.size = s.size;
      out.mtime = s.mtime.toISOString();
    } catch {
      // dangling
    }
  } else if (lst.isDirectory()) {
    out.kind = "dir";
    out.mtime = lst.mtime.toISOString();
    try {
      const ents = await fs.readdir(p);
      out.entryCount = ents.filter(
        (n) => !n.startsWith(".") && !n.includes(".plexus-backup-"),
      ).length;
    } catch {
      // ignore
    }
  } else {
    out.kind = "file";
    out.size = lst.size;
    out.mtime = lst.mtime.toISOString();
  }
  return out;
}

async function listDir(dir: string): Promise<PathStat[]> {
  if (!(await pathExists(dir))) return [];
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const filtered = names.filter((n) => !n.startsWith(".") && !n.includes(".plexus-backup-")).sort();
  const out: PathStat[] = [];
  for (const n of filtered) {
    out.push(await statPath(path.join(dir, n)));
  }
  return out;
}

async function collectAgent(agentId: AgentId): Promise<AgentDebugBlock> {
  const caps = AGENT_PATHS[agentId];
  const root = await statPath(AGENT_ROOTS[agentId]);

  const instructionPath = instructionsForAgent(agentId)[0]?.abs ?? null;

  const [mcpFile, instructionFile, skillsDir] = await Promise.all([
    statPath(caps.mcpPath),
    instructionPath ? statPath(instructionPath) : Promise.resolve(null),
    statPath(caps.skillsDir),
  ]);

  const skillEntries = caps.skills ? await listDir(caps.skillsDir) : [];

  return {
    id: agentId,
    displayName: AGENT_DISPLAY_NAMES[agentId],
    installed: isAgentInstalled(agentId),
    mcpFileMode: caps.mcpFileMode ?? "shared",
    root,
    mcpFile,
    instructionFile,
    skillsDir,
    skillEntries,
  };
}

async function collectPlexusStore(): Promise<PlexusStoreBlock> {
  const teamMcp = path.join(PLEXUS_PATHS.team, PLEXUS_PATHS.mcpDirRel, "servers.yaml");
  const personalMcp = path.join(PLEXUS_PATHS.personal, PLEXUS_PATHS.mcpDirRel, "servers.yaml");
  const teamSkillsDir = path.join(PLEXUS_PATHS.team, PLEXUS_PATHS.skillsDirRel);
  const personalSkillsDir = path.join(PLEXUS_PATHS.personal, PLEXUS_PATHS.skillsDirRel);

  const [
    root,
    config,
    team,
    personal,
    cacheMcp,
    backups,
    teamMcpServers,
    personalMcpServers,
    teamSkillEntries,
    personalSkillEntries,
    cacheMcpEntries,
  ] = await Promise.all([
    statPath(PLEXUS_PATHS.root),
    statPath(PLEXUS_PATHS.config),
    statPath(PLEXUS_PATHS.team),
    statPath(PLEXUS_PATHS.personal),
    statPath(PLEXUS_PATHS.mcpCache),
    statPath(PLEXUS_PATHS.backups),
    statPath(teamMcp),
    statPath(personalMcp),
    listDir(teamSkillsDir),
    listDir(personalSkillsDir),
    listDir(PLEXUS_PATHS.mcpCache),
  ]);

  let backupCount = 0;
  try {
    const all = await listBackups();
    backupCount = all.length;
  } catch {
    // ignore
  }

  return {
    root,
    config,
    team,
    personal,
    cacheMcp,
    backups,
    teamMcpServers,
    personalMcpServers,
    teamSkillEntries,
    personalSkillEntries,
    cacheMcpEntries,
    backupCount,
  };
}

export async function collectDebugSnapshot(): Promise<DebugSnapshot> {
  const plexus = await collectPlexusStore();
  const agents = await Promise.all(ALL_AGENTS.map(collectAgent));
  return {
    generatedAt: new Date().toISOString(),
    host: {
      platform: process.platform,
      release: os.release(),
      node: process.version,
      home: HOME,
    },
    plexus,
    agents,
  };
}

// ---------- text formatting ----------

function fmtSize(bytes?: number): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function pad(s: string, width: number): string {
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

function fmtRow(p: PathStat, indent = 0): string {
  const prefix = " ".repeat(indent);
  const left = pad(`${prefix}${p.display}`, 56);

  if (!p.exists) {
    return `${left}  MISSING`;
  }

  switch (p.kind) {
    case "symlink": {
      const tgt = p.linkTarget ? tilde(p.linkTarget) : "?";
      const dangling = p.linkTargetExists === false ? "  [DANGLING]" : "";
      const meta = p.size != null ? `  ${fmtSize(p.size)}  ${p.mtime ?? ""}` : "";
      return `${left}  LINK -> ${tgt}${dangling}${meta}`.trimEnd();
    }
    case "dir": {
      const count = p.entryCount != null ? `  (${p.entryCount} entries)` : "";
      return `${left}  DIR${count}`;
    }
    case "file": {
      const size = fmtSize(p.size);
      const mtime = p.mtime ?? "";
      return `${left}  FILE  ${pad(size, 9)}  ${mtime}`.trimEnd();
    }
    default:
      return `${left}  MISSING`;
  }
}

function fmtAgentBlock(a: AgentDebugBlock): string {
  const header = `[Agent: ${a.displayName} (${a.id}) | mode=${a.mcpFileMode} | installed=${a.installed}]`;
  const lines: string[] = [header];
  lines.push(fmtRow(a.root));
  lines.push(fmtRow(a.mcpFile));
  if (a.instructionFile) lines.push(fmtRow(a.instructionFile));
  lines.push(fmtRow(a.skillsDir));
  if (a.skillEntries.length === 0) {
    lines.push("  (no skill entries)");
  } else {
    for (const e of a.skillEntries) {
      lines.push(fmtRow(e, 2));
    }
  }
  return lines.join("\n");
}

function fmtPlexusBlock(p: PlexusStoreBlock): string {
  const lines: string[] = [];
  lines.push("[Plexus Store]");
  lines.push(fmtRow(p.root));
  lines.push(fmtRow(p.config));
  lines.push(fmtRow(p.team));
  lines.push(fmtRow(p.teamMcpServers));
  lines.push("  team skills:");
  if (p.teamSkillEntries.length === 0) lines.push("    (empty)");
  for (const e of p.teamSkillEntries) lines.push(fmtRow(e, 4));
  lines.push(fmtRow(p.personal));
  lines.push(fmtRow(p.personalMcpServers));
  lines.push("  personal skills:");
  if (p.personalSkillEntries.length === 0) lines.push("    (empty)");
  for (const e of p.personalSkillEntries) lines.push(fmtRow(e, 4));
  lines.push(fmtRow(p.cacheMcp));
  for (const e of p.cacheMcpEntries) lines.push(fmtRow(e, 2));
  lines.push(fmtRow(p.backups));
  lines.push(`  snapshots: ${p.backupCount} (ring buffer keeps 20)`);
  return lines.join("\n");
}

export function formatDebugSnapshot(s: DebugSnapshot, version?: string): string {
  const lines: string[] = [];
  lines.push(`=== Plexus${version ? ` v${version}` : ""} — Debug Snapshot ===`);
  lines.push(`generated: ${s.generatedAt}`);
  lines.push(
    `host: ${s.host.platform} ${s.host.release}  node: ${s.host.node}  home: ${s.host.home}`,
  );
  lines.push("");
  lines.push(fmtPlexusBlock(s.plexus));
  for (const a of s.agents) {
    lines.push("");
    lines.push(fmtAgentBlock(a));
  }
  lines.push("");
  return lines.join("\n");
}
