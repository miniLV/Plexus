import fs from "node:fs/promises";
import path from "node:path";
import { AGENT_PATHS, ALL_AGENTS, PLEXUS_PATHS } from "../store/paths.js";
import { ensureDir, pathExists } from "../store/fs-utils.js";
import type { AgentId } from "../types.js";

/**
 * Plexus snapshots every agent's native MCP config file before any sync write.
 *
 * Snapshots live under `~/.config/plexus/backups/<ISO-timestamp>/` so a user
 * can always restore the previous state with `cp` if Plexus made a wrong
 * decision. We deliberately do NOT back up skill directories: skills are
 * already symlinks to the Plexus store, and doubling the disk usage on every
 * toggle would be expensive and rarely useful.
 */

export interface BackupEntry {
  agent: AgentId;
  /** Path of the snapshotted file inside the backup directory. */
  backupPath: string;
  /** Original path of the file we copied. */
  originalPath: string;
  /** Was the original a symlink? Lets restore reproduce the link. */
  wasSymlink: boolean;
  /** If symlink, the link target at snapshot time. */
  linkTarget?: string;
}

export interface BackupSnapshot {
  /** Backup directory (one per snapshot). */
  dir: string;
  /** ISO timestamp identifier. */
  id: string;
  entries: BackupEntry[];
}

const KEEP = 20;

export async function snapshotAgentConfigs(opts?: {
  reason?: string;
}): Promise<BackupSnapshot> {
  const id = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(PLEXUS_PATHS.backups, id);
  await ensureDir(dir);

  if (opts?.reason) {
    await fs.writeFile(path.join(dir, "_reason.txt"), opts.reason, "utf8").catch(() => {});
  }

  const entries: BackupEntry[] = [];
  for (const agentId of ALL_AGENTS) {
    const caps = AGENT_PATHS[agentId];
    if (!caps.mcp) continue;
    if (!(await pathExists(caps.mcpPath))) continue;

    let wasSymlink = false;
    let linkTarget: string | undefined;
    try {
      const lst = await fs.lstat(caps.mcpPath);
      wasSymlink = lst.isSymbolicLink();
      if (wasSymlink) linkTarget = await fs.readlink(caps.mcpPath);
    } catch {
      continue;
    }

    const ext = path.extname(caps.mcpPath) || ".bak";
    const fname = `${agentId}-mcp${ext}`;
    const backupPath = path.join(dir, fname);
    try {
      // Always copy the resolved file content (so the backup is self-contained).
      const content = await fs.readFile(caps.mcpPath);
      await fs.writeFile(backupPath, content);
      entries.push({
        agent: agentId,
        backupPath,
        originalPath: caps.mcpPath,
        wasSymlink,
        linkTarget,
      });
    } catch {
      // best-effort; skip agents we can't read
    }
  }

  // Write a manifest so a human can interpret a backup dir without grepping.
  await fs.writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify({ id, createdAt: new Date().toISOString(), entries }, null, 2),
    "utf8",
  );

  await pruneOldBackups(KEEP);
  return { dir, id, entries };
}

async function pruneOldBackups(keep: number): Promise<void> {
  try {
    const ents = await fs.readdir(PLEXUS_PATHS.backups, { withFileTypes: true });
    const dirs = ents
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .reverse();
    for (const old of dirs.slice(keep)) {
      await fs.rm(path.join(PLEXUS_PATHS.backups, old), {
        recursive: true,
        force: true,
      });
    }
  } catch {
    // ignore — pruning is best-effort
  }
}

export async function listBackups(): Promise<BackupSnapshot[]> {
  try {
    const ents = await fs.readdir(PLEXUS_PATHS.backups, { withFileTypes: true });
    const dirs = ents
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .reverse();
    const out: BackupSnapshot[] = [];
    for (const d of dirs) {
      const dir = path.join(PLEXUS_PATHS.backups, d);
      try {
        const raw = await fs.readFile(path.join(dir, "manifest.json"), "utf8");
        const m = JSON.parse(raw) as { id: string; entries: BackupEntry[] };
        out.push({ dir, id: m.id, entries: m.entries });
      } catch {
        out.push({ dir, id: d, entries: [] });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Restore one snapshot by copying every backed-up file back over the original. */
export async function restoreSnapshot(id: string): Promise<{
  restored: number;
  errors: string[];
}> {
  const snapshots = await listBackups();
  const snap = snapshots.find((s) => s.id === id);
  if (!snap) return { restored: 0, errors: [`No snapshot with id ${id}`] };

  const errors: string[] = [];
  let restored = 0;
  for (const entry of snap.entries) {
    try {
      // Remove existing file/symlink first to avoid writing through links.
      try {
        await fs.unlink(entry.originalPath);
      } catch {
        // ignore
      }
      const content = await fs.readFile(entry.backupPath);
      await ensureDir(path.dirname(entry.originalPath));
      await fs.writeFile(entry.originalPath, content);
      restored += 1;
    } catch (err) {
      errors.push(`${entry.agent}: ${(err as Error).message}`);
    }
  }
  return { restored, errors };
}
