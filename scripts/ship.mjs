#!/usr/bin/env node
/**
 * scripts/ship.mjs — one-shot "commit + bump + tag + push" for Plexus.
 *
 * Usage:
 *   npm run ship -- "<commit subject>"
 *   node scripts/ship.mjs "<commit subject>"
 *
 * Pipeline (fail-fast, halts in place on any red step):
 *   1. There must be at least one staged or unstaged change.
 *   2. npm run verify   — biome + vitest + build across all workspaces.
 *   3. node scripts/bump.mjs — patch-bump every package.json + dependency pin.
 *   4. git add -A      — stage user changes + the freshly written version files.
 *   5. git commit -m "<subject> (vX.Y.Z)" -m "<co-author trailer>"
 *   6. git tag -a vX.Y.Z -m vX.Y.Z
 *   7. git push origin <branch>
 *   8. git push origin vX.Y.Z
 *
 * Refuses to run if:
 *   - no commit subject was passed
 *   - the working tree is clean (nothing to ship)
 *   - HEAD is detached
 *   - tag for the next version already exists
 */

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const COAUTHOR_TRAILER =
  "Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>";

function fail(msg) {
  console.error(`[ship] ${msg}`);
  process.exit(1);
}

function gitOut(args) {
  return execFileSync("git", args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

function run(argv) {
  const [cmd, ...args] = argv;
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) fail(`command failed: ${argv.join(" ")}`);
}

function bumpPatch(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`bad semver: ${v}`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

function readRootVersion() {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  return pkg.version;
}

function main() {
  // 1. commit subject
  const subject = process.argv.slice(2).join(" ").trim();
  if (!subject) {
    fail('missing commit subject. Usage: npm run ship -- "<subject>"');
  }
  if (subject.length > 80) {
    fail(`commit subject too long (${subject.length} chars, max 80). Trim it.`);
  }

  // 2. branch + cleanliness preflight
  const branch = gitOut(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch || branch === "HEAD") fail("not on a branch (detached HEAD?)");

  const dirty = gitOut(["status", "--porcelain"]);
  if (!dirty) fail("nothing to ship — working tree is clean.");

  // 3. predict next version + ensure tag does not yet exist
  const current = readRootVersion();
  const next = bumpPatch(current);
  const existing = spawnSync("git", ["rev-parse", "--verify", "--quiet", `v${next}`], {
    cwd: ROOT,
  });
  if (existing.status === 0) {
    fail(`tag v${next} already exists; bump more than once before re-running.`);
  }

  console.log(`[ship] ${current} → ${next} on ${branch}`);
  console.log(`[ship] subject: ${subject}`);

  // 4. verify (fail-fast) BEFORE we touch any files
  console.log("[ship] running npm run verify…");
  run(["npm", "run", "verify"]);

  // 5. bump versions
  console.log("[ship] bumping versions…");
  run(["node", resolve(ROOT, "scripts/bump.mjs")]);

  // 6. stage + commit + tag + push
  run(["git", "add", "-A"]);

  const dirtyAfter = gitOut(["diff", "--cached", "--name-only"]);
  if (!dirtyAfter) fail("after bump nothing was staged — refusing to commit empty.");

  run(["git", "commit", "-m", `${subject} (v${next})`, "-m", COAUTHOR_TRAILER]);
  run(["git", "tag", "-a", `v${next}`, "-m", `v${next}`]);
  run(["git", "push", "origin", branch]);
  run(["git", "push", "origin", `v${next}`]);

  console.log(`\n[ship] published v${next} on origin/${branch}`);
}

main();
