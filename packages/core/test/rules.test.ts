import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AgentId } from "../src/types.js";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("rules");
const { listBackups } = await import("../src/backup/index.js");
const { instructionsForAgent } = await import("../src/agents/inspect.js");
const { AGENT_PATHS, PLEXUS_PATHS } = await import("../src/store/paths.js");
const { readEffectiveRules, rulesFile, writePersonalRules } = await import("../src/store/rules.js");
const { applyRulesToAgents, detachRulesFromAgent, getRulesStatus, importRulesFromAgent } =
  await import("../src/rules/index.js");

afterAll(() => sandbox.cleanup());

beforeEach(async () => {
  await fs.rm(PLEXUS_PATHS.root, { recursive: true, force: true });
  for (const dir of [".claude", ".cursor", ".codex", ".gemini", ".qwen", ".factory"]) {
    await fs.rm(path.join(sandbox.home, dir), { recursive: true, force: true });
  }
});

function instructionPath(agent: AgentId): string {
  return instructionsForAgent(agent)[0].abs;
}

describe("rules store", () => {
  it("reads personal global rules over team global rules", async () => {
    const teamPath = rulesFile("team");
    await fs.mkdir(path.dirname(teamPath), { recursive: true });
    await fs.writeFile(teamPath, "team rules", "utf8");

    expect(await readEffectiveRules()).toMatchObject({
      layer: "team",
      content: "team rules",
    });

    await writePersonalRules("personal rules");

    expect(await readEffectiveRules()).toMatchObject({
      layer: "personal",
      content: "personal rules",
    });
  });
});

describe("rules status", () => {
  it("reports canonical status and per-agent sync state", async () => {
    await writePersonalRules("shared rules");
    const cursorPath = instructionPath("cursor");
    await fs.mkdir(path.dirname(cursorPath), { recursive: true });
    await fs.symlink(rulesFile("personal"), cursorPath, "file");

    const status = await getRulesStatus();

    expect(status.canonical).toMatchObject({
      exists: true,
      layer: "personal",
      path: rulesFile("personal"),
      content: "shared rules",
    });
    expect(status.agents.find((a) => a.agent === "cursor")).toMatchObject({
      targetPath: cursorPath,
      exists: true,
      isSymlink: true,
      linkTarget: rulesFile("personal"),
      inSync: true,
    });
    expect(status.agents.find((a) => a.agent === "codex")).toMatchObject({
      exists: false,
      inSync: false,
    });
  });
});

describe("applyRulesToAgents", () => {
  it("fails clearly when personal global rules do not exist", async () => {
    await expect(applyRulesToAgents(["codex"])).rejects.toThrow(
      "personal canonical rules file does not exist",
    );
  });

  it("snapshots and quarantines an existing real instruction file before replacing it", async () => {
    await writePersonalRules("canonical rules");
    const cursorPath = instructionPath("cursor");
    await fs.mkdir(path.dirname(cursorPath), { recursive: true });
    await fs.writeFile(cursorPath, "local cursor rules", "utf8");

    const [result] = await applyRulesToAgents(["cursor"]);

    expect(result).toMatchObject({
      agent: "cursor",
      targetPath: cursorPath,
      applied: true,
    });
    expect(result.snapshotDir).toBeTruthy();
    expect(result.backedUp).toContain(path.join("_collisions"));
    expect(await fs.readFile(cursorPath, "utf8")).toBe("canonical rules");

    const backups = await listBackups();
    expect(
      backups.some((backup) => backup.entries.some((e) => e.originalPath === cursorPath)),
    ).toBe(true);
  });

  it("materializes a team-only baseline into personal rules before applying", async () => {
    const teamPath = rulesFile("team");
    await fs.mkdir(path.dirname(teamPath), { recursive: true });
    await fs.writeFile(teamPath, "team rules", "utf8");
    const cursorPath = instructionPath("cursor");
    await fs.mkdir(path.dirname(cursorPath), { recursive: true });

    const [result] = await applyRulesToAgents(["cursor"]);

    expect(result.applied).toBe(true);
    expect(await fs.readFile(rulesFile("personal"), "utf8")).toBe("team rules");
    expect(await fs.readFile(cursorPath, "utf8")).toBe("team rules");
  });

  it("does not touch native MCP files", async () => {
    await writePersonalRules("canonical rules");
    const mcpPath = AGENT_PATHS.cursor.mcpPath;
    await fs.mkdir(path.dirname(mcpPath), { recursive: true });
    await fs.writeFile(mcpPath, '{"mcpServers":{"keep":{"command":"x"}}}', "utf8");

    await applyRulesToAgents(["cursor"]);

    expect(await fs.readFile(mcpPath, "utf8")).toBe('{"mcpServers":{"keep":{"command":"x"}}}');
  });
});

describe("detachRulesFromAgent", () => {
  it("turns a managed symlink into a local instruction file without losing content", async () => {
    await writePersonalRules("canonical rules");
    const cursorPath = instructionPath("cursor");
    await fs.mkdir(path.dirname(cursorPath), { recursive: true });
    await fs.symlink(rulesFile("personal"), cursorPath, "file");

    const result = await detachRulesFromAgent("cursor");

    expect(result).toMatchObject({
      agent: "cursor",
      targetPath: cursorPath,
      detached: true,
    });
    expect(result.snapshotDir).toBeTruthy();
    expect((await fs.lstat(cursorPath)).isSymbolicLink()).toBe(false);
    expect(await fs.readFile(cursorPath, "utf8")).toBe("canonical rules");

    const status = await getRulesStatus();
    expect(status.agents.find((a) => a.agent === "cursor")).toMatchObject({
      exists: true,
      isSymlink: false,
      inSync: true,
    });
  });

  it("does not detach a user-owned symlink even when its content matches the baseline", async () => {
    await writePersonalRules("canonical rules");
    const externalPath = path.join(sandbox.home, "external-rules.md");
    await fs.writeFile(externalPath, "canonical rules", "utf8");
    const cursorPath = instructionPath("cursor");
    await fs.mkdir(path.dirname(cursorPath), { recursive: true });
    await fs.symlink(externalPath, cursorPath, "file");

    const status = await getRulesStatus();
    expect(status.agents.find((a) => a.agent === "cursor")).toMatchObject({
      exists: true,
      isSymlink: true,
      linkTarget: externalPath,
      inSync: false,
    });

    const result = await detachRulesFromAgent("cursor");

    expect(result).toMatchObject({
      detached: false,
      skipped: true,
    });
    expect((await fs.lstat(cursorPath)).isSymbolicLink()).toBe(true);
    expect(await fs.readlink(cursorPath)).toBe(externalPath);
  });
});

describe("importRulesFromAgent", () => {
  it("imports an agent instruction file into personal global rules", async () => {
    const claudePath = instructionPath("claude-code");
    await fs.mkdir(path.dirname(claudePath), { recursive: true });
    await fs.writeFile(claudePath, "claude memory", "utf8");

    await importRulesFromAgent("claude-code");

    expect(await fs.readFile(rulesFile("personal"), "utf8")).toBe("claude memory");
  });
});
