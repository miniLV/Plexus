import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import kleur from "kleur";

export interface WebDirOptions {
  dirname: string;
  cwd: string;
}

export interface DashboardCommand {
  command: string;
  args: string[];
}

export interface SpawnSpec {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

function resolveInstalledWebDir(): string | null {
  try {
    const requireFromHere = createRequire(import.meta.url);
    return path.dirname(requireFromHere.resolve("plexus-agent-config-web/package.json"));
  } catch {
    return null;
  }
}

export function findWebDir(options: WebDirOptions): string | null {
  const { dirname, cwd } = options;
  const candidates = [
    resolveInstalledWebDir(),
    path.resolve(dirname, "../vendor/plexus-agent-config-web"),
    path.resolve(dirname, "../../../apps/web"),
    path.resolve(dirname, "../../apps/web"),
    path.resolve(cwd, "apps/web"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const c of candidates) {
    if (existsSync(path.join(c, "package.json"))) return c;
  }
  return null;
}

export function parsePortArg(args: string[]): number {
  const flagIdx = args.findIndex((a) => a === "-p" || a === "--port");
  const fromFlag = flagIdx >= 0 ? Number.parseInt(args[flagIdx + 1] ?? "", 10) : Number.NaN;
  if (Number.isInteger(fromFlag)) return fromFlag;
  const positional = args.find((a) => /^\d+$/.test(a));
  const fromPositional = positional !== undefined ? Number.parseInt(positional, 10) : Number.NaN;
  if (Number.isInteger(fromPositional)) return fromPositional;
  return 7777;
}

function defaultResolveNextBin(fromDir: string): string | null {
  try {
    return createRequire(path.join(fromDir, "package.json")).resolve("next/dist/bin/next");
  } catch {
    return null;
  }
}

export function resolveDashboardCommand(
  webDir: string,
  port: number,
  resolveNextBin: (fromDir: string) => string | null = defaultResolveNextBin,
): DashboardCommand | null {
  const nextBin = resolveNextBin(webDir);
  if (!nextBin) return null;
  const isProdBuild = existsSync(path.join(webDir, ".next"));
  return {
    // Spawn the Node binary directly instead of `npm run` so this works on
    // Windows too, where npm is an npm.cmd shim that spawn() cannot execute.
    command: process.execPath,
    args: [nextBin, isProdBuild ? "start" : "dev", "-p", String(port)],
  };
}

export function startDashboard(spec: SpawnSpec): ChildProcess {
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: spec.env,
    stdio: "inherit",
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (err) => {
    console.error(kleur.red("Fatal:"), err);
    process.exit(1);
  });
  return child;
}
