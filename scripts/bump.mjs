#!/usr/bin/env node
/**
 * scripts/bump.mjs — synchronous version bump for the Plexus monorepo.
 *
 * Per CLAUDE.md: every workspace package.json carries the same version and
 * `apps/web` declares `plexus-agent-config-core@<same>`, `packages/cli` likewise.
 *
 * Usage:
 *   node scripts/bump.mjs              # auto-increment patch (0.0.3 → 0.0.4)
 *   node scripts/bump.mjs 0.1.0        # explicit version
 *   node scripts/bump.mjs --dry        # print plan, don't write
 *
 * Updates the version field in:
 *   - package.json
 *   - apps/web/package.json
 *   - packages/core/package.json
 *   - packages/cli/package.json
 *   - package-lock.json
 * And keeps the plexus-agent-config-core dependency in apps/web + packages/cli pinned
 * to the new version.
 *
 * Exits non-zero on any inconsistency or write failure.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PACKAGES = [
  { path: "package.json", isRoot: true },
  { path: "apps/web/package.json" },
  { path: "packages/core/package.json" },
  { path: "packages/cli/package.json" },
];

const LOCKFILE = "package-lock.json";
const CORE_PACKAGE = "plexus-agent-config-core";
const CLI_PACKAGE = "plexus-agent-config";
const WEB_PACKAGE = "plexus-agent-config-web";

// Workspaces that depend on plexus-agent-config-core and must stay pinned.
const CORE_DEPENDENTS = ["apps/web/package.json", "packages/cli/package.json"];
const WEB_DEPENDENTS = ["packages/cli/package.json"];

function readPkgText(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function readPkg(rel) {
  return JSON.parse(readPkgText(rel));
}

function writePkgText(rel, text) {
  writeFileSync(resolve(ROOT, rel), text, "utf8");
}

function writeJson(rel, value) {
  writeFileSync(resolve(ROOT, rel), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * Replace the top-level `"version": "X.Y.Z"` line in a package.json without
 * reformatting the rest of the file (so biome's preferred line wrapping for
 * arrays/objects is preserved).
 */
function replaceVersionField(text, next) {
  const re = /"version"\s*:\s*"\d+\.\d+\.\d+"/;
  if (!re.test(text)) throw new Error("could not find a top-level version field");
  return text.replace(re, `"version": "${next}"`);
}

/**
 * Replace `"plexus-agent-config-core": "X.Y.Z"` inside a dependencies block. Workspace
 * pins are always exact, so a pinned-semver match is unambiguous.
 */
function replaceCoreDep(text, next) {
  const re = /"plexus-agent-config-core"\s*:\s*"\d+\.\d+\.\d+"/;
  if (!re.test(text)) return text;
  return text.replace(re, `"${CORE_PACKAGE}": "${next}"`);
}

function replaceWebDep(text, next) {
  const re = /"plexus-agent-config-web"\s*:\s*"\d+\.\d+\.\d+"/;
  if (!re.test(text)) return text;
  return text.replace(re, `"${WEB_PACKAGE}": "${next}"`);
}

function replaceIfCurrent(holder, key, current, next) {
  if (holder?.[key] === current) {
    holder[key] = next;
  }
}

function manifestToLockPackagePath(path) {
  return path.replace(/\/package\.json$/, "");
}

function bumpPackageLock(current, next) {
  const lock = readPkg(LOCKFILE);

  replaceIfCurrent(lock, "version", current, next);
  replaceIfCurrent(lock.packages?.[""], "version", current, next);

  for (const { path } of PACKAGES.filter((pkg) => !pkg.isRoot)) {
    replaceIfCurrent(lock.packages?.[manifestToLockPackagePath(path)], "version", current, next);
  }

  for (const path of CORE_DEPENDENTS) {
    const lockPath = manifestToLockPackagePath(path);
    replaceIfCurrent(lock.packages?.[lockPath]?.dependencies, CORE_PACKAGE, current, next);
  }

  replaceIfCurrent(lock.dependencies?.[CLI_PACKAGE]?.requires, CORE_PACKAGE, current, next);
  replaceIfCurrent(lock.dependencies?.[CLI_PACKAGE]?.requires, WEB_PACKAGE, current, next);
  replaceIfCurrent(lock.dependencies?.[WEB_PACKAGE]?.requires, CORE_PACKAGE, current, next);

  writeJson(LOCKFILE, lock);
}

function bumpPatch(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`Cannot patch-bump non-semver version: ${v}`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

function isValidSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(v);
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const explicit = args.find((a) => !a.startsWith("--"));

  const rootPkg = readPkg("package.json");
  const current = rootPkg.version;
  if (!isValidSemver(current)) {
    console.error(`[bump] root package.json has non-semver version: ${current}`);
    process.exit(1);
  }

  const next = explicit ?? bumpPatch(current);
  if (!isValidSemver(next)) {
    console.error(`[bump] target version is not valid semver: ${next}`);
    process.exit(1);
  }

  // Sanity: every workspace must currently equal root.
  for (const { path } of PACKAGES) {
    const pkg = readPkg(path);
    if (pkg.version !== current) {
      console.error(
        `[bump] version drift: ${path} is ${pkg.version}, root is ${current}. Fix manually first.`,
      );
      process.exit(1);
    }
  }

  console.log(`[bump] ${current} → ${next}${dry ? " (dry run)" : ""}`);

  if (dry) {
    for (const { path } of PACKAGES) console.log(`  - ${path}: version → ${next}`);
    console.log(`  - ${LOCKFILE}: workspace versions → ${next}`);
    for (const path of CORE_DEPENDENTS) {
      console.log(`  - ${path}: dependencies["plexus-agent-config-core"] → ${next}`);
    }
    for (const path of WEB_DEPENDENTS) {
      console.log(`  - ${path}: dependencies["plexus-agent-config-web"] → ${next}`);
    }
    return;
  }

  for (const { path } of PACKAGES) {
    let text = readPkgText(path);
    text = replaceVersionField(text, next);
    if (CORE_DEPENDENTS.includes(path)) {
      text = replaceCoreDep(text, next);
    }
    if (WEB_DEPENDENTS.includes(path)) {
      text = replaceWebDep(text, next);
    }
    writePkgText(path, text);
  }
  bumpPackageLock(current, next);

  console.log("[bump] done. Don't forget to commit + tag.");
}

main();
