import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists } from "../store/fs-utils.js";
import { AGENT_PATHS, ALL_AGENTS, PLEXUS_PATHS } from "../store/paths.js";
import type { AgentId } from "../types.js";

/** Where collision backups (from placeLinkOrCopy) end up. */
export const COLLISION_BACKUP_ROOT = path.join(PLEXUS_PATHS.backups, "_collisions");
/** Where one-time-quarantined `.plexus-backup-*` residue ends up. */
export const LEGACY_RESIDUE_ROOT = path.join(PLEXUS_PATHS.backups, "_legacy-residue");

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
const SNAPSHOT_ID_RE = /^\d{4}-\d{2}-\d{2}T/;

async function createSnapshotDir(): Promise<{ id: string; dir: string }> {
  await ensureDir(PLEXUS_PATHS.backups);
  const base = new Date().toISOString().replace(/[:.]/g, "-");
  for (let i = 0; i < 1000; i += 1) {
    const id = i === 0 ? base : `${base}-${String(i).padStart(3, "0")}`;
    const dir = path.join(PLEXUS_PATHS.backups, id);
    try {
      await fs.mkdir(dir, { recursive: false });
      return { id, dir };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }
  throw new Error(`Could not allocate a unique backup directory for ${base}`);
}

function backupFileName(filePath: string): string {
  const parsed = path.parse(filePath);
  const hash = crypto.createHash("sha256").update(path.resolve(filePath)).digest("hex").slice(0, 8);
  return `${parsed.name}.${hash}${parsed.ext || ".bak"}`;
}

export async function snapshotAgentConfigs(opts?: {
  reason?: string;
}): Promise<BackupSnapshot> {
  const { id, dir } = await createSnapshotDir();

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
      .filter((e) => e.isDirectory() && SNAPSHOT_ID_RE.test(e.name))
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

/**
 * Snapshot a single file (e.g. CLAUDE.md) before edit. Stored alongside the
 * regular sync snapshots so the user has one consistent recovery surface.
 */
export async function snapshotSingleFile(
  filePath: string,
  reason?: string,
): Promise<string | null> {
  if (!(await pathExists(filePath))) return null;
  const { id, dir } = await createSnapshotDir();
  if (reason) {
    await fs.writeFile(path.join(dir, "_reason.txt"), reason, "utf8").catch(() => {});
  }
  const fname = backupFileName(filePath);
  const backupPath = path.join(dir, fname);
  try {
    const content = await fs.readFile(filePath);
    await fs.writeFile(backupPath, content);
    await fs.writeFile(
      path.join(dir, "manifest.json"),
      JSON.stringify(
        {
          id,
          createdAt: new Date().toISOString(),
          entries: [{ agent: null, backupPath, originalPath: filePath, wasSymlink: false }],
        },
        null,
        2,
      ),
      "utf8",
    );
    await pruneOldBackups(KEEP);
    return dir;
  } catch {
    return null;
  }
}

/**
 * Move a colliding file/dir into the central backups area instead of leaving
 * `<name>.plexus-backup-<ts>` debris in the agent's own directory.
 *
 * Called by adapter `placeLinkOrCopy` whenever it needs to evict a real
 * file/dir before placing a symlink.
 */
export async function quarantineCollision(opts: {
  agent: AgentId | "unknown";
  sourcePath: string;
}): Promise<string | null> {
  if (!(await pathExists(opts.sourcePath))) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const destDir = path.join(COLLISION_BACKUP_ROOT, ts, opts.agent);
  await ensureDir(destDir);
  const destPath = path.join(destDir, path.basename(opts.sourcePath));
  try {
    await fs.rename(opts.sourcePath, destPath);
    return destPath;
  } catch {
    // Cross-device or permission — fall back to copy + delete.
    try {
      const lst = await fs.lstat(opts.sourcePath);
      if (lst.isDirectory()) {
        await fs.cp(opts.sourcePath, destPath, { recursive: true });
        await fs.rm(opts.sourcePath, { recursive: true, force: true });
      } else {
        await fs.copyFile(opts.sourcePath, destPath);
        await fs.unlink(opts.sourcePath);
      }
      return destPath;
    } catch {
      return null;
    }
  }
}

/**
 * One-shot cleanup: scan every agent's skills dir for `.plexus-backup-*`
 * residue (left by old versions of placeLinkOrCopy) and quarantine them
 * into the central backups area. Idempotent.
 */
export async function cleanupLegacyResidue(): Promise<{
  moved: Array<{ agent: AgentId; from: string; to: string }>;
}> {
  const moved: Array<{ agent: AgentId; from: string; to: string }> = [];
  for (const agentId of ALL_AGENTS) {
    const caps = AGENT_PATHS[agentId];
    if (!caps.skills) continue;
    if (!(await pathExists(caps.skillsDir))) continue;
    let entries: string[];
    try {
      entries = await fs.readdir(caps.skillsDir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.includes(".plexus-backup-")) continue;
      const src = path.join(caps.skillsDir, name);
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const destDir = path.join(LEGACY_RESIDUE_ROOT, ts, agentId);
      await ensureDir(destDir);
      const dest = path.join(destDir, name);
      try {
        await fs.rename(src, dest);
        moved.push({ agent: agentId, from: src, to: dest });
      } catch {
        // best effort
      }
    }
  }
  return { moved };
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
