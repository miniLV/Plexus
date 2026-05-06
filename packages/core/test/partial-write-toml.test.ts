/**
 * ADR-008: Codex shared-mode partial-write must preserve [profile], [auth],
 * and any other top-level TOML tables when rewriting [mcp_servers].
 */
import fs from "node:fs/promises";
import path from "node:path";
import TOML from "@iarna/toml";
import { afterAll, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("partial-toml");
const { codexAdapter } = await import("../src/agents/adapters/codex.js");
const { AGENT_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

const codexPath = AGENT_PATHS.codex.mcpPath;

describe("Codex partial-write (TOML)", () => {
  it("preserves [profile] and [auth] when rewriting [mcp_servers]", async () => {
    const seedToml = `
[auth]
token = "codex-token-do-not-touch"

[profile.default]
model = "claude-3-7-sonnet"
temperature = 0.5

[mcp_servers.user-added]
command = "npx"
args = ["-y", "user-mcp"]
`.trimStart();

    await fs.mkdir(path.dirname(codexPath), { recursive: true });
    await fs.writeFile(codexPath, seedToml, "utf8");

    const result = await codexAdapter.apply({
      agentId: "codex",
      mcp: [
        {
          id: "plexus-managed",
          command: "node",
          args: ["./tool.js"],
          env: { FOO: "bar" },
          layer: "personal",
          enabledAgents: ["codex"],
        },
      ],
      skills: [],
      skillSourcePaths: new Map(),
      syncStrategy: "symlink",
    });

    expect(result.errors).toEqual([]);
    expect(result.applied.mcp).toBe(1);

    const after = TOML.parse(await fs.readFile(codexPath, "utf8")) as {
      auth?: Record<string, unknown>;
      profile?: { default?: Record<string, unknown> };
      mcp_servers?: Record<string, Record<string, unknown>>;
    };
    expect(after.auth?.token).toBe("codex-token-do-not-touch");
    expect(after.profile?.default?.model).toBe("claude-3-7-sonnet");
    expect(after.profile?.default?.temperature).toBe(0.5);

    const servers = after.mcp_servers ?? {};
    expect(Object.keys(servers).sort()).toEqual(["plexus-managed", "user-added"]);
    expect(servers["plexus-managed"]?.command).toBe("node");
    expect(servers["plexus-managed"]?.env).toEqual({ FOO: "bar" });
    expect(servers["user-added"]?.command).toBe("npx");
  });

  it("writes Codex URL MCP servers and skips managed entries without a transport", async () => {
    await fs.mkdir(path.dirname(codexPath), { recursive: true });
    await fs.writeFile(
      codexPath,
      `
[mcp_servers.empty]
command = ""
`.trimStart(),
      "utf8",
    );

    const result = await codexAdapter.apply({
      agentId: "codex",
      mcp: [
        {
          id: "remote-figma",
          command: "",
          url: "https://mcp.figma.com/mcp",
          headers: { Authorization: "Bearer token" },
          layer: "personal",
          enabledAgents: ["codex"],
        },
        {
          id: "empty",
          command: "",
          layer: "personal",
          enabledAgents: ["codex"],
        },
      ],
      skills: [],
      skillSourcePaths: new Map(),
      syncStrategy: "symlink",
    });

    expect(result.errors).toEqual([]);
    expect(result.applied.mcp).toBe(1);
    expect(result.warnings).toEqual(["Skipping MCP empty: missing command or url"]);

    const after = TOML.parse(await fs.readFile(codexPath, "utf8")) as {
      mcp_servers?: Record<string, Record<string, unknown>>;
    };
    const servers = after.mcp_servers ?? {};

    expect(Object.keys(servers)).toEqual(["remote-figma"]);
    expect(servers["remote-figma"]?.url).toBe("https://mcp.figma.com/mcp");
    expect(servers["remote-figma"]?.command).toBeUndefined();
    expect(servers["remote-figma"]?.http_headers).toEqual({ Authorization: "Bearer token" });
  });
});
