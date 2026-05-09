import fs from "node:fs/promises";
import path from "node:path";
import TOML from "@iarna/toml";
import { afterAll, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("mcp-remove");
const { removeMcpEverywhere } = await import("../src/effective/index.js");
const { readMCP, writeMCP } = await import("../src/store/mcp.js");
const { AGENT_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

describe("removeMcpEverywhere", () => {
  it("removes a personal MCP from the store and native agent files", async () => {
    const claudePath = AGENT_PATHS["claude-code"].mcpPath;
    const codexPath = AGENT_PATHS.codex.mcpPath;

    await fs.mkdir(path.dirname(claudePath), { recursive: true });
    await fs.writeFile(
      claudePath,
      JSON.stringify(
        {
          authToken: "keep-me",
          mcpServers: {
            keep: { command: "npx", args: ["-y", "keep"] },
            "remove-me": { command: "node", args: ["server.js"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await fs.mkdir(path.dirname(codexPath), { recursive: true });
    await fs.writeFile(
      codexPath,
      `
[profile.default]
model = "keep-me"

[mcp_servers.keep]
command = "npx"
args = ["-y", "keep"]

[mcp_servers.remove-me]
command = "node"
args = ["server.js"]
`.trimStart(),
      "utf8",
    );

    await writeMCP("personal", [
      {
        id: "remove-me",
        command: "node",
        args: ["server.js"],
        layer: "personal",
        enabledAgents: ["claude-code", "codex"],
      },
    ]);

    const result = await removeMcpEverywhere("remove-me");

    expect(result.ok).toBe(true);
    expect((await readMCP("personal")).map((server) => server.id)).not.toContain("remove-me");

    const claudeAfter = JSON.parse(await fs.readFile(claudePath, "utf8")) as {
      authToken?: string;
      mcpServers?: Record<string, unknown>;
    };
    expect(claudeAfter.authToken).toBe("keep-me");
    expect(claudeAfter.mcpServers).toHaveProperty("keep");
    expect(claudeAfter.mcpServers).not.toHaveProperty("remove-me");

    const codexAfter = TOML.parse(await fs.readFile(codexPath, "utf8")) as {
      profile?: { default?: Record<string, unknown> };
      mcp_servers?: Record<string, unknown>;
    };
    expect(codexAfter.profile?.default?.model).toBe("keep-me");
    expect(codexAfter.mcp_servers).toHaveProperty("keep");
    expect(codexAfter.mcp_servers).not.toHaveProperty("remove-me");
  });

  it("removes a native-only MCP without leaving a personal store entry", async () => {
    const claudePath = AGENT_PATHS["claude-code"].mcpPath;

    await fs.mkdir(path.dirname(claudePath), { recursive: true });
    await fs.writeFile(
      claudePath,
      JSON.stringify(
        {
          mcpServers: {
            "native-only": { command: "node", args: ["native.js"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await removeMcpEverywhere("native-only");

    expect(result.ok).toBe(true);
    expect((await readMCP("personal")).map((server) => server.id)).not.toContain("native-only");

    const after = JSON.parse(await fs.readFile(claudePath, "utf8")) as {
      mcpServers?: Record<string, unknown>;
    };
    expect(after.mcpServers).not.toHaveProperty("native-only");
  });
});
