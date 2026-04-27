#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectAgents,
  ensureStoreScaffolding,
  joinTeam,
  pullTeam,
  runSync,
  teamStatus,
} from "@plexus/core";
import kleur from "kleur";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function help(): void {
  console.log(`
${kleur.bold("Plexus")} – team-shared AI agent config

${kleur.bold("Usage:")}
  plexus              start the local dashboard (default)
  plexus start [-p <port>]
  plexus detect       list detected AI agents on this machine
  plexus join <git-url>   subscribe to a team config repo
  plexus pull         refresh the team layer from upstream
  plexus sync         apply current store to all enabled agents
  plexus status       show subscription / sync status
  plexus help         show this help
`);
}

async function cmdDetect(): Promise<void> {
  const agents = detectAgents();
  for (const a of agents) {
    const tag = a.installed ? kleur.green("installed") : kleur.gray("missing  ");
    console.log(`  ${tag}  ${a.displayName.padEnd(16)}  ${kleur.dim(a.rootDir)}`);
  }
}

async function cmdSync(): Promise<void> {
  await ensureStoreScaffolding();
  console.log(kleur.cyan("→ syncing all enabled agents..."));
  const report = await runSync();
  for (const r of report.results) {
    const ok = r.errors.length === 0;
    const head = ok ? kleur.green("✓") : kleur.red("✗");
    console.log(
      `  ${head} ${r.agent.padEnd(16)}  mcp=${r.applied.mcp}  skills=${r.applied.skills}`,
    );
    for (const w of r.warnings) console.log(`    ${kleur.yellow("warn")} ${w}`);
    for (const e of r.errors) console.log(`    ${kleur.red("err ")} ${e}`);
  }
}

async function cmdStatus(): Promise<void> {
  const ts = await teamStatus();
  if (ts.subscribed) {
    console.log(`Team:    ${kleur.cyan(ts.repoUrl ?? "")}`);
    if (ts.hasUpstreamUpdate) {
      console.log(
        `         ${kleur.yellow(`⟳ ${ts.behind} update(s) available – run 'plexus pull'`)}`,
      );
    } else {
      console.log(`         ${kleur.green("up-to-date")}`);
    }
  } else {
    console.log(`Team:    ${kleur.gray("not subscribed")}  (run 'plexus join <git-url>')`);
  }
  await cmdDetect();
}

function findWebDir(): string | null {
  // When installed: dist/ is co-located near apps/web. Walk up from __dirname.
  const candidates = [
    path.resolve(__dirname, "../../../apps/web"),
    path.resolve(__dirname, "../../apps/web"),
    path.resolve(process.cwd(), "apps/web"),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(c, "package.json"))) return c;
  }
  return null;
}

async function cmdStart(port: number): Promise<void> {
  await ensureStoreScaffolding();
  const webDir = findWebDir();
  if (!webDir) {
    console.error(
      kleur.red("Could not locate apps/web. If you cloned the monorepo, run from the repo root."),
    );
    process.exit(1);
  }

  const env = { ...process.env, PORT: String(port), PLEXUS_PORT: String(port) };
  const isProdBuild = existsSync(path.join(webDir, ".next"));
  const args = isProdBuild ? ["run", "start"] : ["run", "dev"];

  console.log(kleur.cyan(`→ Starting Plexus dashboard on http://localhost:${port}`));
  console.log(kleur.dim(`  (mode: ${isProdBuild ? "production" : "development"})`));

  const child = spawn("npm", [...args, "--", "-p", String(port)], {
    cwd: webDir,
    env,
    stdio: "inherit",
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

async function main(): Promise<void> {
  const [, , cmd = "start", ...rest] = process.argv;
  switch (cmd) {
    case "help":
    case "--help":
    case "-h":
      help();
      return;
    case "detect":
      await cmdDetect();
      return;
    case "sync":
      await cmdSync();
      return;
    case "status":
      await cmdStatus();
      return;
    case "join": {
      const url = rest[0];
      if (!url) {
        console.error(kleur.red("Usage: plexus join <git-url>"));
        process.exit(1);
      }
      const r = await joinTeam(url);
      console.log(r.ok ? kleur.green(r.message) : kleur.red(r.message));
      process.exit(r.ok ? 0 : 1);
      return;
    }
    case "pull": {
      const r = await pullTeam();
      console.log(r.ok ? kleur.green(r.message) : kleur.red(r.message));
      process.exit(r.ok ? 0 : 1);
      return;
    }
    default: {
      const portFlagIdx = rest.findIndex((a) => a === "-p" || a === "--port");
      const port = portFlagIdx >= 0 ? Number.parseInt(rest[portFlagIdx + 1] ?? "7777", 10) : 7777;
      await cmdStart(port);
      return;
    }
  }
}

main().catch((err) => {
  console.error(kleur.red("Fatal:"), err);
  process.exit(1);
});
