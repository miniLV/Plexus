#!/usr/bin/env node
/**
 * scripts/verify-release.mjs — guard the GitHub release timestamp.
 *
 * A release whose `published_at` lands *before* its `created_at` shows up in
 * the wrong place on the releases page (this bit v0.0.11, v0.0.12 and
 * v0.0.16). After release.yml creates or edits the release it calls this
 * script, which rebuilds the release if the timestamp is backdated.
 *
 * Usage (from release.yml):
 *   node scripts/verify-release.mjs "$TAG"
 *
 * Requires GITHUB_REPOSITORY and GH_TOKEN in the environment.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * ISO 8601 timestamps have a fixed shape, so lexicographic string comparison
 * is equivalent to chronological comparison.
 */
export function isBackdated(publishedAt, createdAt) {
  if (!publishedAt || !createdAt) return false;
  return publishedAt < createdAt;
}

function ghJson(repo, tag, field) {
  const result = spawnSync("gh", ["api", `repos/${repo}/releases/tags/${tag}`, "--jq", field], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`gh api failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function run(args) {
  const result = spawnSync("gh", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed`);
  }
}

function main() {
  const tag = process.argv[2];
  const repo = process.env.GITHUB_REPOSITORY;

  if (!tag) {
    console.error("usage: node scripts/verify-release.mjs <tag>");
    process.exit(2);
  }
  if (!repo) {
    console.error("GITHUB_REPOSITORY is required");
    process.exit(2);
  }

  const publishedAt = ghJson(repo, tag, ".published_at");
  const createdAt = ghJson(repo, tag, ".created_at");

  if (!isBackdated(publishedAt, createdAt)) {
    console.log(`release ${tag} published_at OK: ${publishedAt}`);
    return;
  }

  console.warn(
    `::warning::release ${tag} has a backdated published_at (${publishedAt} < ${createdAt}); rebuilding`,
  );

  const body = ghJson(repo, tag, ".body");
  const notesFile = join(tmpdir(), `release-${tag}.md`);
  writeFileSync(notesFile, body, "utf8");

  run(["release", "delete", tag, "--yes"]);
  run([
    "release",
    "create",
    tag,
    "--verify-tag",
    "--title",
    tag,
    "--notes-file",
    notesFile,
    "--latest",
  ]);

  console.log(`release ${tag} rebuilt with a correct published_at`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
