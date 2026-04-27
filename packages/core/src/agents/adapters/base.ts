import fs from "node:fs/promises";
import path from "node:path";
import type {
  AgentId,
  MCPServerDef,
  SkillDef,
  SyncResult,
} from "../../types.js";

export interface ApplyContext {
  agentId: AgentId;
  mcp: MCPServerDef[];
  skills: SkillDef[];
  /** Where merged skills live on disk; adapters can symlink to these. */
  skillSourcePaths: Map<string, string>;
  syncStrategy: "symlink" | "copy";
}

export interface AgentAdapter {
  id: AgentId;
  apply(ctx: ApplyContext): Promise<SyncResult>;
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function isSymlink(p: string): Promise<boolean> {
  try {
    const s = await fs.lstat(p);
    return s.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Place `target` at `linkPath` either as a symlink (preferred) or copy fallback.
 *
 * If the destination is an existing real file/dir we evict it into the
 * central Plexus backups area (~/.config/plexus/backups/_collisions/<ts>/...)
 * BEFORE placing the new symlink. Older inline `.plexus-backup-<ts>` residue
 * in agent directories is no longer created by this function.
 */
export async function placeLinkOrCopy(
  target: string,
  linkPath: string,
  strategy: "symlink" | "copy",
): Promise<{ via: "symlink" | "copy"; backedUp?: string }> {
  await ensureDir(path.dirname(linkPath));

  let backedUp: string | undefined;

  if (await pathExists(linkPath)) {
    if (await isSymlink(linkPath)) {
      await fs.unlink(linkPath);
    } else {
      const { quarantineCollision } = await import("../../backup/index.js");
      const dest = await quarantineCollision({ agent: "unknown", sourcePath: linkPath });
      if (dest) backedUp = dest;
      // After quarantineCollision the original path is gone; fall through to placement.
    }
  }

  if (strategy === "symlink") {
    try {
      const stat = await fs.lstat(target);
      const type = stat.isDirectory() ? "dir" : "file";
      await fs.symlink(target, linkPath, type);
      return { via: "symlink", backedUp };
    } catch {
      // Fallback to copy if symlink not supported (e.g. Windows without privilege).
    }
  }

  // copy fallback
  const stat = await fs.lstat(target);
  if (stat.isDirectory()) {
    await fs.cp(target, linkPath, { recursive: true });
  } else {
    await fs.copyFile(target, linkPath);
  }
  return { via: "copy", backedUp };
}

export function emptyResult(agentId: AgentId): SyncResult {
  return {
    agent: agentId,
    applied: { mcp: 0, skills: 0 },
    warnings: [],
    errors: [],
  };
}

/**
 * Replace a regular file at `linkPath` with a symlink pointing at `target`.
 * If symlink isn't supported (Windows without privilege), falls back to a copy.
 *
 * Caller is responsible for invoking the backup module BEFORE calling this —
 * we do not silently overwrite without a snapshot existing somewhere.
 */
export async function placeFileSymlink(
  target: string,
  linkPath: string,
  strategy: "symlink" | "copy",
): Promise<"symlink" | "copy"> {
  await ensureDir(path.dirname(linkPath));

  let lst: Awaited<ReturnType<typeof fs.lstat>> | null = null;
  try {
    lst = await fs.lstat(linkPath);
  } catch {
    // not present yet — fine
  }

  if (lst) {
    if (lst.isSymbolicLink()) {
      try {
        const current = await fs.readlink(linkPath);
        const resolved = path.isAbsolute(current)
          ? current
          : path.resolve(path.dirname(linkPath), current);
        if (resolved === path.resolve(target)) {
          return "symlink"; // already correct
        }
      } catch {
        // fall through
      }
      await fs.unlink(linkPath);
    } else {
      // Regular file — remove (caller already snapshotted).
      await fs.unlink(linkPath);
    }
  }

  if (strategy === "symlink") {
    try {
      await fs.symlink(target, linkPath, "file");
      return "symlink";
    } catch {
      // fall through to copy
    }
  }
  await fs.copyFile(target, linkPath);
  return "copy";
}
