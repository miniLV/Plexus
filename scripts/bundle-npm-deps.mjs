#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_NODE_MODULES = resolve(ROOT, "packages/cli/node_modules");
const CORE_DEST = resolve(CLI_NODE_MODULES, "plexus-agent-config-core");
const WEB_DEST = resolve(CLI_NODE_MODULES, "plexus-agent-config-web");
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
  rmSync(CORE_DEST, { recursive: true, force: true });
  rmSync(WEB_DEST, { recursive: true, force: true });
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

copyJson(
  resolve(ROOT, "packages/core/package.json"),
  resolve(CORE_DEST, "package.json"),
  (pkg) => ({
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
  }),
);
cpSync(coreDist, resolve(CORE_DEST, "dist"), { recursive: true });

copyJson(resolve(ROOT, "apps/web/package.json"), resolve(WEB_DEST, "package.json"), (pkg) => ({
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
  dependencies: pkg.dependencies,
}));
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
