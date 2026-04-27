/**
 * ADR-008: shared-mode partial-write must preserve every non-mcpServers key
 * byte-identical (auth, history, settings).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("partial-json");
const { makeJsonMcpAdapter } = await import("../src/agents/adapters/json-mcp.js");
const { AGENT_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

const claudePath = AGENT_PATHS["claude-code"].mcpPath;

describe("Claude Code partial-write", () => {
  it("preserves auth, history, and unrelated keys when adding a new MCP", async () => {
    // Seed a realistic ~/.claude.json shape.
    const original = {
      authToken: "sk-very-secret-do-not-touch",
      userId: "user-42",
      conversationHistory: [
        { id: "c1", title: "How do I configure MCP?" },
        { id: "c2", title: "Refactor my code please" },
      ],
      mcpServers: {
        "user-added-mcp": {
          command: "npx",
          args: ["-y", "@user/mcp-tool"],
        },
      },
      settings: {
        theme: "dark",
        telemetry: false,
      },
    };
    await fs.mkdir(path.dirname(claudePath), { recursive: true });
    await fs.writeFile(claudePath, JSON.stringify(original, null, 2), "utf8");

    // Apply a Plexus-managed MCP that isn't already in the file.
    const adapter = makeJsonMcpAdapter("claude-code");
    const result = await adapter.apply({
      agentId: "claude-code",
      mcp: [
        {
          id: "plexus-managed",
          command: "node",
          args: ["./tool.js"],
          layer: "personal",
          enabledAgents: ["claude-code"],
        },
      ],
      skills: [],
      skillSourcePaths: new Map(),
      syncStrategy: "symlink",
    });

    expect(result.errors).toEqual([]);
    expect(result.applied.mcp).toBe(1);

    const after = JSON.parse(await fs.readFile(claudePath, "utf8")) as Record<string, unknown>;
    // Auth + history + settings preserved.
    expect(after.authToken).toBe("sk-very-secret-do-not-touch");
    expect(after.userId).toBe("user-42");
    expect(after.conversationHistory).toEqual(original.conversationHistory);
    expect(after.settings).toEqual(original.settings);

    // Both user-added and managed MCP present.
    const servers = after.mcpServers as Record<string, unknown>;
    expect(Object.keys(servers).sort()).toEqual(["plexus-managed", "user-added-mcp"]);
    expect((servers["user-added-mcp"] as Record<string, unknown>).command).toBe("npx");
    expect((servers["plexus-managed"] as Record<string, unknown>).command).toBe("node");
  });

  it("removes a managed MCP from the file when it's no longer enabled for this agent", async () => {
    // First, sync with managed MCP enabled.
    const adapter = makeJsonMcpAdapter("claude-code");
    await adapter.apply({
      agentId: "claude-code",
      mcp: [
        {
          id: "managed-temp",
          command: "x",
          layer: "personal",
          enabledAgents: ["claude-code"],
        },
      ],
      skills: [],
      skillSourcePaths: new Map(),
      syncStrategy: "symlink",
    });
    let after = JSON.parse(await fs.readFile(claudePath, "utf8")) as Record<string, unknown>;
    expect(Object.keys(after.mcpServers as Record<string, unknown>)).toContain("managed-temp");

    // Now disable for this agent — should be removed but other keys stay.
    await adapter.apply({
      agentId: "claude-code",
      mcp: [
        {
          id: "managed-temp",
          command: "x",
          layer: "personal",
          enabledAgents: ["cursor"], // not claude-code
        },
      ],
      skills: [],
      skillSourcePaths: new Map(),
      syncStrategy: "symlink",
    });

    after = JSON.parse(await fs.readFile(claudePath, "utf8")) as Record<string, unknown>;
    expect(Object.keys(after.mcpServers as Record<string, unknown>)).not.toContain("managed-temp");
    // Auth still there.
    expect(after.authToken).toBe("sk-very-secret-do-not-touch");
  });
});
