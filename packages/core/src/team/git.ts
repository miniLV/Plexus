import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { PLEXUS_PATHS } from "../store/paths.js";
import { readConfig, writeConfig } from "../store/config.js";
import { pathExists } from "../store/fs-utils.js";

const exec = promisify(execFile);

/**
 * Team subscription helpers.
 *
 * MVP: a team's source of truth lives in a Git repo. We `git clone` it into
 * `~/.config/plexus/team/` and then `git pull` to refresh.
 *
 * A team repo MUST follow this layout (same as the personal layer):
 *   <repo>/
 *   ├── mcp/servers.yaml
 *   └── skills/<id>/SKILL.md
 *
 * `propose-to-team` is intentionally NOT implemented in the MVP CLI; the web
 * dashboard will guide users through opening a PR via GitHub web UI.
 */

async function isGitRepo(dir: string): Promise<boolean> {
  return pathExists(`${dir}/.git`);
}

export async function joinTeam(repoUrl: string): Promise<{ ok: boolean; message: string }> {
  const teamDir = PLEXUS_PATHS.team;

  if (await pathExists(teamDir)) {
    if (await isGitRepo(teamDir)) {
      try {
        const { stdout } = await exec("git", ["-C", teamDir, "remote", "get-url", "origin"]);
        const current = stdout.trim();
        if (current !== repoUrl) {
          return {
            ok: false,
            message: `Team layer already subscribed to ${current}. Run 'plexus leave' first.`,
          };
        }
        await exec("git", ["-C", teamDir, "pull", "--ff-only"]);
        const cfg = await readConfig();
        cfg.teamRepo = repoUrl;
        await writeConfig(cfg);
        return { ok: true, message: "Team layer refreshed." };
      } catch (err) {
        return { ok: false, message: `Git pull failed: ${(err as Error).message}` };
      }
    }
    const backup = `${teamDir}.plexus-backup-${Date.now()}`;
    await fs.rename(teamDir, backup);
  }

  try {
    await exec("git", ["clone", repoUrl, teamDir]);
    const cfg = await readConfig();
    cfg.teamRepo = repoUrl;
    await writeConfig(cfg);
    return { ok: true, message: `Cloned team repo to ${teamDir}.` };
  } catch (err) {
    return { ok: false, message: `Git clone failed: ${(err as Error).message}` };
  }
}

export async function pullTeam(): Promise<{ ok: boolean; message: string }> {
  const teamDir = PLEXUS_PATHS.team;
  if (!(await isGitRepo(teamDir))) {
    return { ok: false, message: "Team layer is not a git repo. Run 'plexus join <url>' first." };
  }
  try {
    await exec("git", ["-C", teamDir, "pull", "--ff-only"]);
    return { ok: true, message: "Team layer up-to-date." };
  } catch (err) {
    return { ok: false, message: `Git pull failed: ${(err as Error).message}` };
  }
}

export async function teamStatus(): Promise<{
  subscribed: boolean;
  repoUrl?: string;
  hasUpstreamUpdate?: boolean;
  ahead?: number;
  behind?: number;
}> {
  const teamDir = PLEXUS_PATHS.team;
  if (!(await isGitRepo(teamDir))) return { subscribed: false };

  try {
    const remoteUrl = (
      await exec("git", ["-C", teamDir, "remote", "get-url", "origin"])
    ).stdout.trim();

    let ahead = 0;
    let behind = 0;
    try {
      await exec("git", ["-C", teamDir, "fetch", "--quiet"]);
      const { stdout } = await exec("git", [
        "-C",
        teamDir,
        "rev-list",
        "--left-right",
        "--count",
        "HEAD...@{upstream}",
      ]);
      const [a, b] = stdout.trim().split(/\s+/).map((n) => parseInt(n, 10));
      ahead = a || 0;
      behind = b || 0;
    } catch {
      // upstream not set or offline; ignore.
    }

    return {
      subscribed: true,
      repoUrl: remoteUrl,
      hasUpstreamUpdate: behind > 0,
      ahead,
      behind,
    };
  } catch {
    return { subscribed: false };
  }
}
