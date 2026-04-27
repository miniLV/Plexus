#!/usr/bin/env node
/**
 * scripts/bump.mjs — synchronous version bump for the Plexus monorepo.
 *
 * Per CLAUDE.md: every workspace package.json carries the same version and
 * `apps/web` declares `@plexus/core@<same>`, `packages/cli` likewise.
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
 * And keeps the @plexus/core dependency in apps/web + packages/cli pinned
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

// Workspaces that depend on @plexus/core and must stay pinned.
const CORE_DEPENDENTS = ["apps/web/package.json", "packages/cli/package.json"];

function readPkg(rel) {
  return JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));
}

function writePkg(rel, pkg) {
  writeFileSync(resolve(ROOT, rel), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
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
    for (const path of CORE_DEPENDENTS) {
      console.log(`  - ${path}: dependencies["@plexus/core"] → ${next}`);
    }
    return;
  }

  for (const { path } of PACKAGES) {
    const pkg = readPkg(path);
    pkg.version = next;
    writePkg(path, pkg);
  }

  for (const path of CORE_DEPENDENTS) {
    const pkg = readPkg(path);
    if (pkg.dependencies?.["@plexus/core"]) {
      pkg.dependencies["@plexus/core"] = next;
      writePkg(path, pkg);
    }
  }

  console.log("[bump] done. Don't forget to commit + tag.");
}

main();
