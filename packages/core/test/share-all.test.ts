import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import YAML from "yaml";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("share-all");
const { previewShareAll, runShareAll } = await import("../src/sync/index.js");
const { readMCP, writeMCP } = await import("../src/store/mcp.js");
const { readRules } = await import("../src/store/rules.js");
const { AGENT_PATHS, PLEXUS_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

beforeEach(async () => {
  await fs.rm(PLEXUS_PATHS.root, { recursive: true, force: true });
  for (const dir of [".claude", ".cursor", ".codex", ".gemini", ".qwen", ".factory"]) {
    await fs.rm(path.join(sandbox.home, dir), { recursive: true, force: true });
  }
  await fs.rm(path.join(sandbox.home, ".claude.json"), { force: true });
});

async function writeClaudeConfig(): Promise<void> {
  await fs.mkdir(path.join(sandbox.home, ".claude"), { recursive: true });
  await fs.writeFile(
    AGENT_PATHS["claude-code"].mcpPath,
    JSON.stringify({
      auth: "keep-me",
      mcpServers: {
        shared: { command: "node", args: ["claude"] },
        "claude-only": { command: "npx", args: ["claude-only"] },
      },
    }),
    "utf8",
  );
  await fs.writeFile(path.join(sandbox.home, ".claude", "CLAUDE.md"), "claude rules\n", "utf8");
}

async function writeCodexConfig(): Promise<void> {
  await fs.mkdir(path.join(sandbox.home, ".codex"), { recursive: true });
  await fs.writeFile(
    AGENT_PATHS.codex.mcpPath,
    [
      "[profile]",
      'model = "gpt-5"',
      "",
      "[mcp_servers.shared]",
      'command = "node"',
      'args = ["codex"]',
      "",
      "[mcp_servers.codex-only]",
      'command = "npx"',
      'args = ["codex-only"]',
      "",
    ].join("\n"),
    "utf8",
  );
  await fs.writeFile(path.join(sandbox.home, ".codex", "AGENTS.md"), "codex rules\n", "utf8");
}

async function writeGeminiConfig(): Promise<void> {
  await fs.mkdir(path.join(sandbox.home, ".gemini"), { recursive: true });
  await fs.writeFile(
    AGENT_PATHS["gemini-cli"].mcpPath,
    JSON.stringify(
      {
        ui: { theme: "Default" },
        mcpServers: {
          shared: { command: "node", args: ["gemini"] },
          remote: { url: "https://example.test/mcp", headers: { Authorization: "Bearer token" } },
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await fs.writeFile(path.join(sandbox.home, ".gemini", "GEMINI.md"), "gemini rules\n", "utf8");
}

async function writeQwenConfig(): Promise<void> {
  await fs.mkdir(path.join(sandbox.home, ".qwen"), { recursive: true });
  await fs.writeFile(
    AGENT_PATHS["qwen-code"].mcpPath,
    JSON.stringify(
      {
        model: { name: "qwen-coder" },
        mcpServers: {
          shared: { command: "node", args: ["qwen"] },
          "qwen-only": { command: "npx", args: ["qwen-only"] },
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await fs.writeFile(path.join(sandbox.home, ".qwen", "QWEN.md"), "qwen rules\n", "utf8");
}

describe("runShareAll", () => {
  it("preserves unique native config and resolves same-id conflicts with the preferred agent", async () => {
    await writeClaudeConfig();
    await writeCodexConfig();

    const plan = await previewShareAll({ preferredAgent: "codex" });

    expect(plan.targetAgents).toEqual(["claude-code", "codex"]);
    expect(plan.selectedPrimaryAgent).toBe("codex");
    expect(plan.mcp.safe).toBe(2);
    expect(plan.mcp.conflicts).toEqual([
      { id: "shared", sources: ["codex", "claude-code"], preferredAgent: "codex" },
    ]);
    expect(plan.rules.conflict).toBe(true);

    const report = await runShareAll({ preferredAgent: "codex" });
    expect(report.conflictsResolved).toBe(2);

    const raw = await fs.readFile(path.join(PLEXUS_PATHS.personal, "mcp", "servers.yaml"), "utf8");
    const servers = YAML.parse(raw).servers as Array<{
      id: string;
      args?: string[];
      enabledAgents: string[];
    }>;

    expect(servers.map((server) => server.id)).toEqual(["claude-only", "codex-only", "shared"]);
    expect(servers.find((server) => server.id === "shared")?.args).toEqual(["codex"]);
    expect(servers.every((server) => server.enabledAgents.join(",") === "claude-code,codex")).toBe(
      true,
    );

    const rules = await readRules("personal");
    expect(rules?.content).toBe("codex rules\n");
  });

  it("keeps the Plexus store authoritative for existing IDs", async () => {
    await writeClaudeConfig();
    await writeCodexConfig();
    await writeMCP("personal", [
      {
        id: "shared",
        command: "node",
        args: ["store"],
        layer: "personal",
        enabledAgents: ["claude-code"],
      },
    ]);

    await runShareAll({ preferredAgent: "codex" });

    const servers = await readMCP("personal");
    const shared = servers.find((server) => server.id === "shared");
    expect(shared?.args).toEqual(["store"]);
    expect(shared?.enabledAgents).toEqual(["claude-code", "codex"]);
  });

  it("imports Gemini CLI and Qwen Code without dropping remote MCP fields", async () => {
    await writeGeminiConfig();
    await writeQwenConfig();

    const report = await runShareAll({ preferredAgent: "qwen-code" });
    expect(report.targetAgents).toEqual(["gemini-cli", "qwen-code"]);

    const servers = await readMCP("personal");
    expect(servers.find((server) => server.id === "shared")?.args).toEqual(["qwen"]);
    expect(servers.find((server) => server.id === "remote")).toMatchObject({
      url: "https://example.test/mcp",
      headers: { Authorization: "Bearer token" },
    });

    const rawGemini = JSON.parse(await fs.readFile(AGENT_PATHS["gemini-cli"].mcpPath, "utf8"));
    expect(rawGemini.ui.theme).toBe("Default");
    expect(rawGemini.mcpServers.remote.url).toBe("https://example.test/mcp");
  });
});
