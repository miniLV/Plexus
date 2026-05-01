#!/usr/bin/env node
/**
 * scripts/release-npm.mjs — verified npm release gate for the single public package.
 *
 * Default mode is dry-run:
 *   node scripts/release-npm.mjs --dry
 *
 * Publish mode:
 *   node scripts/release-npm.mjs --publish
 *
 * The script validates the exact tarball users will install, then optionally
 * publishes that tarball and verifies the package again from the npm registry.
 */

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_NAME = "plexus-agent-config";
const WORKSPACE = "plexus-agent-config";
const REGISTRY = "https://registry.npmjs.org/";
const DASHBOARD_TIMEOUT_MS = 45_000;

const args = new Set(process.argv.slice(2));
const publish = args.has("--publish");
const dry = args.has("--dry") || !publish;
const requireClean = args.has("--require-clean") || publish;
const skipVerify = args.has("--skip-verify");
const skipRegistrySmoke = args.has("--skip-registry-smoke");
const keepArtifacts = args.has("--keep-artifacts");

if (args.has("--publish") && args.has("--dry")) {
  fail("use either --dry or --publish, not both");
}

const tmpRoot = mkdtempSync(join(tmpdir(), "plexus-npm-release-"));
const packDir = join(tmpRoot, "pack");
const localProject = join(tmpRoot, "local-install");
const registryProject = join(tmpRoot, "registry-install");
const childProcesses = new Set();

process.on("exit", () => {
  for (const child of childProcesses) {
    killChild(child, "SIGTERM");
  }
});

function log(message) {
  console.log(`[release:npm] ${message}`);
}

function fail(message) {
  console.error(`[release:npm] ${message}`);
  process.exit(1);
}

function run(argv, options = {}) {
  const [cmd, ...cmdArgs] = argv;
  const result = spawnSync(cmd, cmdArgs, {
    cwd: options.cwd ?? ROOT,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.stdio ?? "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail(`command failed: ${argv.join(" ")}`);
  }
  return result;
}

function output(argv, options = {}) {
  try {
    return execFileSync(argv[0], argv.slice(1), {
      cwd: options.cwd ?? ROOT,
      env: { ...process.env, ...(options.env ?? {}) },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (options.allowFail) return null;
    const stderr = error.stderr?.toString().trim();
    fail(`command failed: ${argv.join(" ")}${stderr ? `\n${stderr}` : ""}`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
}

function compareSemver(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }
  return 0;
}

function assertVersionAtLeast(actual, minimum, label) {
  const normalized = actual.replace(/^v/, "").split("-")[0];
  if (!/^\d+\.\d+\.\d+$/.test(normalized) || compareSemver(normalized, minimum) < 0) {
    fail(`${label} must be >= ${minimum}; found ${actual}`);
  }
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function packageVersions() {
  return [
    ["package.json", readJson("package.json").version],
    ["apps/web/package.json", readJson("apps/web/package.json").version],
    ["packages/core/package.json", readJson("packages/core/package.json").version],
    ["packages/cli/package.json", readJson("packages/cli/package.json").version],
  ];
}

function checkPreflight(version) {
  assertVersionAtLeast(process.version, "20.0.0", "Node");
  const npmVersion = output(["npm", "-v"]);

  if (publish && process.env.GITHUB_ACTIONS === "true") {
    assertVersionAtLeast(process.version, "22.14.0", "Node for npm trusted publishing");
    assertVersionAtLeast(npmVersion, "11.5.1", "npm for trusted publishing");
  }

  for (const [path, packageVersion] of packageVersions()) {
    assert(packageVersion === version, `${path} is ${packageVersion}, expected ${version}`);
  }

  const tag = process.env.GITHUB_REF_NAME;
  if (tag?.startsWith("v")) {
    assert(tag === `v${version}`, `Git tag ${tag} does not match package version v${version}`);
  }

  if (requireClean) {
    const dirty = output(["git", "status", "--porcelain"]);
    assert(!dirty, "working tree must be clean before publishing");
  }

  const remoteVersion = output(
    ["npm", "view", `${PACKAGE_NAME}@${version}`, "version", "--registry", REGISTRY],
    { allowFail: true },
  );
  if (remoteVersion === version && publish) {
    fail(`${PACKAGE_NAME}@${version} is already published`);
  }
  if (remoteVersion === version && dry) {
    log(`${PACKAGE_NAME}@${version} already exists on npm; continuing dry-run only`);
  }
}

function cleanBundleState() {
  run(["node", resolve(ROOT, "scripts/bundle-npm-deps.mjs"), "--clean"], { stdio: "ignore" });
}

function packTarball() {
  mkdirSync(packDir, { recursive: true });
  run(["npm", "pack", "-w", WORKSPACE, "--pack-destination", packDir, "--loglevel", "warn"]);

  const tarballs = readdirSync(packDir).filter((file) => file.endsWith(".tgz"));
  assert(tarballs.length === 1, `expected one tarball in ${packDir}, found ${tarballs.length}`);
  return join(packDir, tarballs[0]);
}

function tarText(tarball, path) {
  return output(["tar", "-xOf", tarball, path]);
}

function inspectTarball(tarball, version) {
  log(`inspecting ${tarball}`);
  const listing = output(["tar", "-tf", tarball]).split("\n").filter(Boolean);
  const has = (path) => listing.includes(path);

  assert(has("package/package.json"), "tarball is missing package/package.json");
  assert(has("package/dist/bin.js"), "tarball is missing dist/bin.js");
  assert(
    has("package/vendor/plexus-agent-config-core/package.json"),
    "tarball is missing vendored core",
  );
  assert(
    has("package/vendor/plexus-agent-config-web/package.json"),
    "tarball is missing vendored web",
  );
  assert(
    has(
      "package/vendor/plexus-agent-config-web/node_modules/plexus-agent-config-core/package.json",
    ),
    "tarball is missing web-local core copy",
  );
  assert(
    has("package/vendor/plexus-agent-config-web/.next/BUILD_ID"),
    "tarball is missing built Next.js output",
  );
  assert(
    !listing.some((path) => path.includes("prepack-backup")),
    "tarball contains a prepack backup file",
  );

  const manifest = JSON.parse(tarText(tarball, "package/package.json"));
  assert(manifest.name === PACKAGE_NAME, `tarball name is ${manifest.name}`);
  assert(
    manifest.version === version,
    `tarball version is ${manifest.version}, expected ${version}`,
  );
  assert(!manifest.devDependencies, "published manifest must not include devDependencies");
  assert(!manifest.bundledDependencies, "published manifest must not include bundledDependencies");
  assert(
    !manifest.dependencies?.["plexus-agent-config-core"],
    "published manifest must not depend on unpublished core package",
  );
  assert(
    !manifest.dependencies?.["plexus-agent-config-web"],
    "published manifest must not depend on unpublished web package",
  );
  assert(
    manifest.files?.includes("vendor/**/*"),
    'published manifest must include "vendor/**/*" in files',
  );

  const bin = tarText(tarball, "package/dist/bin.js");
  assert(
    bin.includes("../vendor/plexus-agent-config-core/dist/index.js"),
    "CLI bundle must import vendored core",
  );
  assert(
    !bin.includes('"plexus-agent-config-core"') && !bin.includes("'plexus-agent-config-core'"),
    "CLI bundle still imports core as a bare package",
  );

  assert(!existsSync(resolve(ROOT, "packages/cli/vendor")), "postpack did not clean vendor/");
  assert(
    !existsSync(resolve(ROOT, "packages/cli/package.json.prepack-backup")),
    "postpack did not clean package.json backup",
  );
  assert(
    !existsSync(resolve(ROOT, "packages/cli/bin.js.prepack-backup")),
    "postpack did not clean dist/bin.js backup",
  );
}

function runPublishDryRun(tarball) {
  log("running npm publish --dry-run against the verified tarball");
  run([
    "npm",
    "publish",
    tarball,
    "--dry-run",
    "--access",
    "public",
    "--registry",
    REGISTRY,
    "--loglevel",
    "warn",
  ]);
}

function binPath(projectDir) {
  const suffix = process.platform === "win32" ? "plexus.cmd" : "plexus";
  return join(projectDir, "node_modules", ".bin", suffix);
}

function npmInit(projectDir) {
  mkdirSync(projectDir, { recursive: true });
  run(["npm", "init", "-y"], { cwd: projectDir, stdio: "ignore" });
}

async function sleep(ms) {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForHttp(url, child, label) {
  const started = Date.now();
  let lastError = "";

  while (Date.now() - started < DASHBOARD_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      fail(`${label} dashboard exited before becoming ready`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await sleep(500);
  }

  fail(`${label} dashboard did not answer ${url}: ${lastError}`);
}

function killChild(child, signal) {
  if (!child?.pid || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return;
  await new Promise((resolveWait) => {
    const timeout = setTimeout(resolveWait, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveWait();
    });
  });
}

async function stopChild(child) {
  killChild(child, "SIGTERM");
  await waitForExit(child, 1_500);
  killChild(child, "SIGKILL");
  await waitForExit(child, 1_500);
}

async function startDashboard(bin, projectDir, label) {
  const port = 7800 + Math.floor(Math.random() * 1000);
  const url = `http://127.0.0.1:${port}/`;
  log(`starting ${label} dashboard on ${url}`);

  const child = spawn(bin, ["start", "-p", String(port)], {
    cwd: projectDir,
    env: process.env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  childProcesses.add(child);
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  try {
    await waitForHttp(url, child, label);
    log(`${label} dashboard returned HTTP 200`);
  } finally {
    await stopChild(child);
    childProcesses.delete(child);
  }
}

async function smokeInstall(spec, projectDir, label) {
  log(`smoke testing ${label}: ${spec}`);
  npmInit(projectDir);
  run(["npm", "install", spec, "--registry", REGISTRY, "--loglevel", "warn"], { cwd: projectDir });
  const bin = binPath(projectDir);
  assert(existsSync(bin), `${label} install did not create plexus binary`);
  run([bin, "help"], { cwd: projectDir });
  run([bin, "detect"], { cwd: projectDir });
  await startDashboard(bin, projectDir, label);
}

function publishTarball(tarball) {
  log("publishing verified tarball to npm");
  run([
    "npm",
    "publish",
    tarball,
    "--access",
    "public",
    "--registry",
    REGISTRY,
    "--loglevel",
    "warn",
  ]);
}

function verifyRegistry(version) {
  log("checking npm registry metadata");
  const latest = output(["npm", "view", PACKAGE_NAME, "dist-tags.latest", "--registry", REGISTRY]);
  assert(latest === version, `npm latest is ${latest}, expected ${version}`);
  run([
    "npm",
    "view",
    `${PACKAGE_NAME}@${version}`,
    "version",
    "dist.unpackedSize",
    "dist.fileCount",
    "--registry",
    REGISTRY,
  ]);
}

async function main() {
  const version = readJson("package.json").version;
  log(`${PACKAGE_NAME}@${version} ${dry ? "dry-run" : "publish"} release`);
  log(`artifacts: ${tmpRoot}`);

  try {
    checkPreflight(version);
    if (!skipVerify) {
      log("running source verification");
      run(["npm", "run", "verify"]);
    }

    const tarball = packTarball();
    cleanBundleState();
    inspectTarball(tarball, version);
    runPublishDryRun(tarball);
    await smokeInstall(tarball, localProject, "local tarball");

    if (publish) {
      publishTarball(tarball);
      verifyRegistry(version);
      if (!skipRegistrySmoke) {
        await smokeInstall(`${PACKAGE_NAME}@latest`, registryProject, "npm registry");
      }
      log(`${PACKAGE_NAME}@${version} published and verified`);
    } else {
      log("dry-run complete; no package was published");
    }
  } finally {
    cleanBundleState();
    if (!keepArtifacts) {
      rmSync(tmpRoot, { recursive: true, force: true });
    } else {
      log(`kept artifacts at ${tmpRoot}`);
    }
  }
}

await main();
