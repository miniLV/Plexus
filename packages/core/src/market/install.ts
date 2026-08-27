import { execFile } from "node:child_process";
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ensureDir } from "../store/fs-utils.js";
import { ALL_AGENTS } from "../store/paths.js";
import { parseSkillMarkdown, writeSkillBundle } from "../store/skills.js";
import { runSync } from "../sync/index.js";
import type { SkillDef } from "../types.js";
import { githubGet, githubToken } from "./github.js";

const exec = promisify(execFile);

export interface InstallMarketResult {
  ok: boolean;
  /** The full repo reference ("owner/repo"). */
  repo?: string;
  /** Skill id written into the personal store. */
  id?: string;
  /** Display name resolved from SKILL.md frontmatter (falls back to repo). */
  name?: string;
  /** Set when the same skill id already existed and was overwritten. */
  updated?: boolean;
  /** Set when the download/install failed. */
  error?: string;
  /** Backup snapshot dir produced by the post-install sync, if any. */
  backup?: string;
}

/** A repo reference must be "owner/repo" (one or two segments). */
function parseRepo(ref: string): { owner: string; repo: string } | null {
  const cleaned = ref.trim().replace(/^https?:\/\/github\.com\//, "");
  const segments = cleaned.split("/").filter(Boolean);
  if (segments.length !== 2) return null;
  const [owner, repo] = segments;
  if (!owner || !repo) return null;
  return { owner, repo };
}

/** Turn a GitHub repo name into a folder-safe skill id. */
export function repoToSkillId(repo: string): string {
  return (
    repo
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || repo.toLowerCase()
  );
}

interface RepoMeta {
  full_name: string;
  name: string;
  description: string | null;
  default_branch: string;
}

async function fetchRepoMeta(owner: string, repo: string): Promise<RepoMeta> {
  return githubGet<RepoMeta>(`/repos/${owner}/${repo}`);
}

async function downloadTarball(owner: string, repo: string, branch: string, dest: string) {
  const url = `https://codeload.github.com/${owner}/${repo}/tar.gz/${encodeURIComponent(branch)}`;
  const token = await githubToken();
  const headers: Record<string, string> = { "user-agent": "plexus-agent-config" };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to download ${owner}/${repo} tarball (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

/** Recursively locate SKILL.md files under `dir` (shallowest first). */
async function findSkillFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(current: string, depth: number) {
    if (depth > 6) return;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".git") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.name === "SKILL.md") {
        found.push(full);
      }
    }
  }
  await walk(dir, 0);
  return found;
}

function firstLine(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Download a skill repo from GitHub and install it into the Plexus personal
 * store as a single skill, then sync it to enabled agents.
 *
 * A skill repo is expected to carry one `SKILL.md` — either at the repo root,
 * or as the only `SKILL.md` in the tree. Bundled resources (scripts/,
 * references/, assets/, …) sitting next to that `SKILL.md` are copied along.
 */
export async function installMarketSkill(ref: string): Promise<InstallMarketResult> {
  const parsed = parseRepo(ref);
  if (!parsed) {
    return { ok: false, error: `Invalid repo reference "${ref}". Use "owner/repo".` };
  }
  const { owner, repo } = parsed;

  let meta: RepoMeta;
  try {
    meta = await fetchRepoMeta(owner, repo);
  } catch (err) {
    return { ok: false, repo: `${owner}/${repo}`, error: (err as Error).message };
  }

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "plexus-market-"));
  const extractDir = path.join(tmpRoot, "repo");
  const tarball = path.join(tmpRoot, "repo.tar.gz");

  try {
    await ensureDir(extractDir);
    await downloadTarball(owner, repo, meta.default_branch, tarball);
    await exec("tar", ["-xzf", tarball, "-C", extractDir, "--strip-components=1"]);

    const skillFiles = await findSkillFiles(extractDir);
    if (skillFiles.length === 0) {
      return {
        ok: false,
        repo: `${owner}/${repo}`,
        error: `No SKILL.md found in ${owner}/${repo}. It may be a multi-skill collection or not a skill repo.`,
      };
    }

    // Prefer a root SKILL.md; otherwise the shallowest single file.
    const rootSkill = path.join(extractDir, "SKILL.md");
    const chosen = skillFiles.includes(rootSkill)
      ? rootSkill
      : skillFiles.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length)[0];

    const raw = await fs.readFile(chosen, "utf8");
    const { frontmatter, body } = parseSkillMarkdown(raw);

    const id = repoToSkillId(repo);
    const name = firstLine(frontmatter.name) ?? repo;
    const description = firstLine(frontmatter.description);

    const skill: SkillDef = {
      id,
      name,
      description,
      body,
      frontmatter,
      layer: "personal",
      enabledAgents: [...ALL_AGENTS],
    };

    // writeSkillBundle copies SKILL.md plus sibling resources into the store.
    await writeSkillBundle(skill, path.dirname(chosen));

    const backup = await runSync()
      .then((r) => r.backup)
      .catch(() => undefined);

    return {
      ok: true,
      repo: `${owner}/${repo}`,
      id,
      name,
      backup,
    };
  } catch (err) {
    return { ok: false, repo: `${owner}/${repo}`, error: (err as Error).message };
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
