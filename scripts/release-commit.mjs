#!/usr/bin/env node
/**
 * scripts/release-commit.mjs — final step of `npm run release:patch`.
 *
 * Assumes `npm run verify` and `npm run bump:patch` have already succeeded
 * and the working tree contains version bumps in 4 package.json files.
 *
 * What it does:
 *   1. Reads the new version from root package.json.
 *   2. `git add` the four version files.
 *   3. Refuses to continue if there are *other* unrelated staged or
 *      unstaged changes (safety: release commits should be version-only).
 *   4. Creates a commit "release: v<version>" with co-author trailer.
 *   5. Tags the commit `v<version>` (annotated, no -f).
 *   6. Pushes commit and tag to origin/<current-branch>.
 *
 * Exits non-zero on any failure; does NOT roll back partial work.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const VERSION_FILES = [
  "package.json",
  "apps/web/package.json",
  "packages/core/package.json",
  "packages/cli/package.json",
];

const COAUTHOR_TRAILER =
  "Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>";

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

function shInherit(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function fail(msg) {
  console.error(`[release] ${msg}`);
  process.exit(1);
}

function main() {
  const rootPkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const version = rootPkg.version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`bad version: ${version}`);

  const branch = sh("git rev-parse --abbrev-ref HEAD");
  if (!branch || branch === "HEAD") fail("not on a branch (detached HEAD?)");

  // Stage only the version files.
  shInherit(`git add ${VERSION_FILES.join(" ")}`);

  // Make sure nothing else is staged or modified that would slip in.
  const diffNames = sh("git diff --cached --name-only").split("\n").filter(Boolean);
  const unrelated = diffNames.filter((f) => !VERSION_FILES.includes(f));
  if (unrelated.length > 0) {
    fail(
      `staged files unrelated to release found:\n  ${unrelated.join(
        "\n  ",
      )}\nCommit or stash them, then re-run.`,
    );
  }

  const dirty = sh("git diff --name-only").split("\n").filter(Boolean);
  if (dirty.length > 0) {
    fail(
      `unstaged changes outside release files:\n  ${dirty.join(
        "\n  ",
      )}\nCommit or stash them, then re-run.`,
    );
  }

  // Tag must not exist already.
  let tagExists = false;
  try {
    sh(`git rev-parse --verify --quiet v${version}`);
    tagExists = true;
  } catch {
    /* noop */
  }
  if (tagExists) fail(`tag v${version} already exists; bump again or delete it.`);

  // Commit + tag + push.
  const message = `release: v${version}\n\n${COAUTHOR_TRAILER}`;
  shInherit(`git commit -m ${JSON.stringify(message)}`);
  shInherit(`git tag -a v${version} -m ${JSON.stringify(`v${version}`)}`);
  shInherit(`git push origin ${branch}`);
  shInherit(`git push origin v${version}`);

  console.log(`\n[release] published v${version} on origin/${branch}`);
}

main();
