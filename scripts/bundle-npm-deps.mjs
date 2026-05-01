#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PACKAGE_JSON = resolve(ROOT, "packages/cli/package.json");
const CLI_PACKAGE_BACKUP = resolve(ROOT, "packages/cli/package.json.prepack-backup");
const CLI_DIST_BIN = resolve(ROOT, "packages/cli/dist/bin.js");
const CLI_DIST_BIN_BACKUP = resolve(ROOT, "packages/cli/bin.js.prepack-backup");
const CLI_VENDOR = resolve(ROOT, "packages/cli/vendor");
const CORE_PACKAGE = "plexus-agent-config-core";
const WEB_PACKAGE = "plexus-agent-config-web";
const CORE_DEST = resolve(CLI_VENDOR, CORE_PACKAGE);
const WEB_DEST = resolve(CLI_VENDOR, WEB_PACKAGE);
const NEXT_ROOT_FILES = [
  "app-path-routes-manifest.json",
  "BUILD_ID",
  "build-manifest.json",
  "export-marker.json",
  "images-manifest.json",
  "next-minimal-server.js.nft.json",
  "next-server.js.nft.json",
  "package.json",
  "prerender-manifest.json",
  "react-loadable-manifest.json",
  "required-server-files.js",
  "required-server-files.json",
  "routes-manifest.json",
];

function clean() {
  rmSync(CLI_VENDOR, { recursive: true, force: true });
  if (existsSync(CLI_DIST_BIN_BACKUP)) {
    cpSync(CLI_DIST_BIN_BACKUP, CLI_DIST_BIN);
    rmSync(CLI_DIST_BIN_BACKUP, { force: true });
  }
  if (existsSync(CLI_PACKAGE_BACKUP)) {
    cpSync(CLI_PACKAGE_BACKUP, CLI_PACKAGE_JSON);
    rmSync(CLI_PACKAGE_BACKUP, { force: true });
  }
}

function copyJson(src, dest, transform) {
  const json = JSON.parse(readFileSync(src, "utf8"));
  writeFileSync(dest, `${JSON.stringify(transform(json), null, 2)}\n`, "utf8");
}

function requireDir(path, hint) {
  if (!existsSync(path)) {
    throw new Error(`${hint} is missing: ${path}`);
  }
}

function copyCorePackage(dest) {
  mkdirSync(dest, { recursive: true });
  copyJson(resolve(ROOT, "packages/core/package.json"), resolve(dest, "package.json"), (pkg) => ({
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    type: pkg.type,
    license: pkg.license,
    homepage: pkg.homepage,
    repository: pkg.repository,
    bugs: pkg.bugs,
    main: pkg.main,
    types: pkg.types,
    exports: pkg.exports,
    dependencies: pkg.dependencies,
  }));
  cpSync(coreDist, resolve(dest, "dist"), { recursive: true });
}

function rewriteCliCoreImport() {
  cpSync(CLI_DIST_BIN, CLI_DIST_BIN_BACKUP);
  const text = readFileSync(CLI_DIST_BIN, "utf8");
  writeFileSync(
    CLI_DIST_BIN,
    text.replaceAll(
      '"plexus-agent-config-core"',
      '"../vendor/plexus-agent-config-core/dist/index.js"',
    ),
    "utf8",
  );
}

function writePublishManifest() {
  cpSync(CLI_PACKAGE_JSON, CLI_PACKAGE_BACKUP);
  const pkg = JSON.parse(readFileSync(CLI_PACKAGE_JSON, "utf8"));
  pkg.bundledDependencies = undefined;
  pkg.devDependencies = undefined;
  pkg.files = ["dist/**/*", "vendor/**/*", "package.json"];
  writeFileSync(CLI_PACKAGE_JSON, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

if (process.argv.includes("--clean")) {
  clean();
  process.exit(0);
}

const coreDist = resolve(ROOT, "packages/core/dist");
const webNext = resolve(ROOT, "apps/web/.next");
const webPublic = resolve(ROOT, "apps/web/public");
requireDir(coreDist, "Run npm run build:core before packing");
requireDir(webNext, "Run npm run build -w plexus-agent-config-web before packing");

clean();
mkdirSync(CORE_DEST, { recursive: true });
mkdirSync(WEB_DEST, { recursive: true });

copyCorePackage(CORE_DEST);

copyJson(resolve(ROOT, "apps/web/package.json"), resolve(WEB_DEST, "package.json"), (pkg) => {
  const { "plexus-agent-config-core": _core, ...dependencies } = pkg.dependencies;
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    license: pkg.license,
    homepage: pkg.homepage,
    repository: pkg.repository,
    bugs: pkg.bugs,
    scripts: {
      start: pkg.scripts.start,
    },
    dependencies,
  };
});
const bundledNext = resolve(WEB_DEST, ".next");
mkdirSync(bundledNext, { recursive: true });
for (const file of NEXT_ROOT_FILES) {
  const src = resolve(webNext, file);
  if (existsSync(src)) {
    cpSync(src, resolve(bundledNext, file));
  }
}
cpSync(resolve(webNext, "server"), resolve(bundledNext, "server"), { recursive: true });
cpSync(resolve(webNext, "static"), resolve(bundledNext, "static"), { recursive: true });
cpSync(resolve(ROOT, "apps/web/next.config.mjs"), resolve(WEB_DEST, "next.config.mjs"));
if (existsSync(webPublic)) {
  cpSync(webPublic, resolve(WEB_DEST, "public"), { recursive: true });
}
copyCorePackage(resolve(WEB_DEST, "node_modules", CORE_PACKAGE));
rewriteCliCoreImport();
writePublishManifest();
