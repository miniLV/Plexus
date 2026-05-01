#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import kleur from "kleur";
import {
  ALL_AGENTS,
  type AgentId,
  detectAgents,
  ensureStoreScaffolding,
  joinTeam,
  pullTeam,
  runShareAll,
  teamStatus,
} from "plexus-agent-config-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

function help(): void {
  console.log(`
${kleur.bold("Plexus")} – team-shared AI agent config

${kleur.bold("Usage:")}
  plexus              start the local dashboard (default)
  plexus start [-p <port>]
  plexus detect       list detected AI agents on this machine
  plexus join <git-url>   subscribe to a team config repo
  plexus pull         refresh the team layer from upstream
  plexus sync [--prefer <agent>]  import, share, and apply config to all enabled agents
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

const AGENTS = new Set<string>(ALL_AGENTS);

function preferredAgentFromArgs(args: string[]): AgentId | undefined {
  const idx = args.findIndex((arg) => arg === "--prefer" || arg === "--primary");
  if (idx < 0) return undefined;
  const value = args[idx + 1];
  if (!AGENTS.has(value ?? "")) {
    console.error(kleur.red(`Usage: plexus sync --prefer <${ALL_AGENTS.join("|")}>`));
    process.exit(1);
  }
  return value as AgentId;
}

async function cmdSync(args: string[]): Promise<void> {
  await ensureStoreScaffolding();
  const preferredAgent = preferredAgentFromArgs(args);
  console.log(kleur.cyan("→ sharing config across all enabled agents..."));
  const report = await runShareAll({ preferredAgent });
  if (report.preferredAgent && report.conflictsResolved > 0) {
    console.log(
      `  ${kleur.green("✓")} resolved ${report.conflictsResolved} conflict(s) with ${report.preferredAgent}`,
    );
  }
  console.log(
    `  ${kleur.green("✓")} imported ${report.imported.mcpWritten + report.imported.mcpExtended} MCP and ${
      report.imported.skillsWritten + report.imported.skillsExtended
    } skills`,
  );
  console.log(
    `  ${kleur.green("✓")} enabled ${report.shared.mcp} MCP and ${report.shared.skills} skills`,
  );
  if (report.rules.skipped) {
    console.log(`  ${kleur.yellow("warn")} ${report.rules.skipped}`);
  } else {
    console.log(
      `  ${kleur.green("✓")} applied rules to ${
        report.rules.applied.filter((r) => r.applied).length
      } agent files`,
    );
  }
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
  const installedWebDir = (() => {
    try {
      return path.dirname(require.resolve("plexus-agent-config-web/package.json"));
    } catch {
      return null;
    }
  })();

  const candidates = [
    installedWebDir,
    path.resolve(__dirname, "../vendor/plexus-agent-config-web"),
    // Monorepo development / npm link paths.
    path.resolve(__dirname, "../../../apps/web"),
    path.resolve(__dirname, "../../apps/web"),
    path.resolve(process.cwd(), "apps/web"),
  ].filter((candidate): candidate is string => Boolean(candidate));

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
      await cmdSync(rest);
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
