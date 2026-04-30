import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("spread");
const { applySpread } = await import("../src/spread/index.js");
const { listBackups } = await import("../src/backup/index.js");
const { writeMCP } = await import("../src/store/mcp.js");
const { AGENT_PATHS, PLEXUS_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

beforeEach(async () => {
  await fs.rm(PLEXUS_PATHS.root, { recursive: true, force: true });
  for (const dir of [".claude", ".cursor", ".codex", ".gemini", ".qwen", ".factory"]) {
    await fs.rm(path.join(sandbox.home, dir), { recursive: true, force: true });
  }
});

describe("applySpread", () => {
  it("snapshots native MCP files before applying the target adapter", async () => {
    await fs.mkdir(path.join(sandbox.home, ".cursor"), { recursive: true });
    await fs.mkdir(path.join(sandbox.home, ".codex"), { recursive: true });
    const codexConfig = [
      "[profile]",
      'model = "gpt-5"',
      "",
      "[mcp_servers.keep]",
      'command = "node"',
      "",
    ].join("\n");
    await fs.writeFile(AGENT_PATHS.codex.mcpPath, codexConfig, "utf8");
    await writeMCP("personal", [
      {
        id: "from-cursor",
        command: "npx",
        args: ["from-cursor"],
        layer: "personal",
        enabledAgents: ["cursor"],
      },
    ]);

    const result = await applySpread({ from: "cursor", to: "codex" });

    expect(result.backup).toBeTruthy();
    const backups = await listBackups();
    expect(
      backups.some((backup) =>
        backup.entries.some(
          (entry) =>
            entry.originalPath === AGENT_PATHS.codex.mcpPath &&
            entry.backupPath.startsWith(result.backup!),
        ),
      ),
    ).toBe(true);
    const nextCodexConfig = await fs.readFile(AGENT_PATHS.codex.mcpPath, "utf8");
    expect(nextCodexConfig).toContain("[mcp_servers.from-cursor]");
    expect(nextCodexConfig).toContain("[profile]");
  });
});
