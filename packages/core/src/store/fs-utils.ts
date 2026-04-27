import fs from "node:fs/promises";

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

/**
 * Symlink-safe removal (ADR-003).
 *
 * `fs.rm(p, { recursive: true })` will follow a symlink and recursively delete
 * its target — for Plexus that target is the canonical store under
 * `~/.config/plexus/`, which is catastrophic data loss.
 *
 * This helper always `lstat`s first: if the entry is a symlink, only the
 * link itself is removed; otherwise we recursively delete the real entry.
 *
 * Returns `false` when the path didn't exist (no-op).
 */
export async function safeRemove(p: string): Promise<boolean> {
  let lst: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    lst = await fs.lstat(p);
  } catch {
    return false;
  }
  if (lst.isSymbolicLink()) {
    await fs.unlink(p);
  } else if (lst.isDirectory()) {
    await fs.rm(p, { recursive: true, force: true });
  } else {
    await fs.unlink(p);
  }
  return true;
}
