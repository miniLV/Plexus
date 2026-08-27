import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("opencode");
const { opencodeAdapter } = await import("../src/agents/adapters/opencode.js");
const { readNativeMcpFromAgent } = await import("../src/import/from-agents.js");
const { AGENT_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

const configPath = AGENT_PATHS.opencode.mcpPath;

beforeEach(async () => {
  await fs.rm(path.dirname(configPath), { recursive: true, force: true });
  await fs.mkdir(path.dirname(configPath), { recursive: true });
});

describe("OpenCode adapter", () => {
  it("partial-writes the mcp key and preserves unrelated config keys", async () => {
    await fs.writeFile(
      configPath,
      JSON.stringify(
        {
          model: "anthropic/claude-sonnet-4-5",
          permission: { edit: "ask" },
          mcp: {
            "user-added": { type: "local", command: ["npx", "-y", "tool"], enabled: true },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await opencodeAdapter.apply({
      agentId: "opencode",
      mcp: [
        {
          id: "plexus-managed",
          command: "node",
          args: ["./tool.js"],
          layer: "personal",
          enabledAgents: ["opencode"],
        },
        {
          id: "plexus-remote",
          command: "",
          url: "https://example.test/mcp",
          headers: { Authorization: "Bearer x" },
          layer: "personal",
          enabledAgents: ["opencode"],
        },
      ],
      skills: [],
      skillSourcePaths: new Map(),
      syncStrategy: "symlink",
    });

    expect(result.errors).toEqual([]);
    expect(result.applied.mcp).toBe(2);

    const after = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
    expect(after.model).toBe("anthropic/claude-sonnet-4-5");
    expect(after.permission).toEqual({ edit: "ask" });

    const mcp = after.mcp as Record<string, Record<string, unknown>>;
    expect(Object.keys(mcp).sort()).toEqual(["plexus-managed", "plexus-remote", "user-added"]);
    expect(mcp["user-added"]).toEqual({
      type: "local",
      command: ["npx", "-y", "tool"],
      enabled: true,
    });
    expect(mcp["plexus-managed"]).toEqual({ type: "local", command: ["node", "./tool.js"] });
    expect(mcp["plexus-remote"]).toEqual({
      type: "remote",
      url: "https://example.test/mcp",
      headers: { Authorization: "Bearer x" },
    });
  });

  it("removes a managed MCP when it is disabled for opencode", async () => {
    await fs.writeFile(configPath, JSON.stringify({ mcp: {} }), "utf8");

    const apply = (enabledAgents: string[]) =>
      opencodeAdapter.apply({
        agentId: "opencode",
        mcp: [{ id: "temp", command: "x", layer: "personal", enabledAgents }],
        skills: [],
        skillSourcePaths: new Map(),
        syncStrategy: "symlink",
      });

    await apply(["opencode"]);
    let after = JSON.parse(await fs.readFile(configPath, "utf8")) as {
      mcp: Record<string, unknown>;
    };
    expect(Object.keys(after.mcp)).toContain("temp");

    await apply(["cursor"]);
    after = JSON.parse(await fs.readFile(configPath, "utf8")) as { mcp: Record<string, unknown> };
    expect(Object.keys(after.mcp)).not.toContain("temp");
  });
});

describe("OpenCode skill projection", () => {
  it("projects disable-model-invocation skills as commands, not skills", async () => {
    const skillsDir = AGENT_PATHS.opencode.skillsDir;
    const commandsDir = AGENT_PATHS.opencode.commandsDir ?? "";

    const sourceDir = path.join(sandbox.home, "store", "normal-skill");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(
      path.join(sourceDir, "SKILL.md"),
      "---\nname: normal-skill\ndescription: auto skill\n---\nbody",
      "utf8",
    );

    const result = await opencodeAdapter.apply({
      agentId: "opencode",
      mcp: [],
      skills: [
        {
          id: "normal-skill",
          name: "normal-skill",
          description: "auto skill",
          body: "body",
          frontmatter: {},
          layer: "personal",
          enabledAgents: ["opencode"],
        },
        {
          id: "grill-me",
          name: "grill-me",
          description: "interview to sharpen a plan",
          body: "# Grill Me\n\nInterview.",
          frontmatter: { "disable-model-invocation": true },
          layer: "personal",
          enabledAgents: ["opencode"],
        },
      ],
      skillSourcePaths: new Map([["normal-skill", sourceDir]]),
      syncStrategy: "symlink",
    });

    expect(result.errors).toEqual([]);

    const skillLink = path.join(skillsDir, "normal-skill");
    expect((await fs.lstat(skillLink)).isSymbolicLink()).toBe(true);
    await expect(fs.access(path.join(skillsDir, "grill-me"))).rejects.toThrow();

    const commandPath = path.join(commandsDir, "grill-me.md");
    expect((await fs.lstat(commandPath)).isSymbolicLink()).toBe(true);
    const content = await fs.readFile(commandPath, "utf8");
    expect(content).toContain("description: interview to sharpen a plan");
    expect(content).toContain("# Grill Me");
  });

  it("removes a managed command when its skill is disabled", async () => {
    const commandsDir = AGENT_PATHS.opencode.commandsDir ?? "";

    const apply = (enabledAgents: string[]) =>
      opencodeAdapter.apply({
        agentId: "opencode",
        mcp: [],
        skills: [
          {
            id: "to-spec",
            name: "to-spec",
            description: "turn thread into a spec",
            body: "# To Spec\n\nbody",
            frontmatter: { "disable-model-invocation": true },
            layer: "personal",
            enabledAgents,
          },
        ],
        skillSourcePaths: new Map(),
        syncStrategy: "symlink",
      });

    await apply(["opencode"]);
    expect(await fs.readFile(path.join(commandsDir, "to-spec.md"), "utf8")).toContain("# To Spec");

    await apply(["cursor"]);
    await expect(fs.access(path.join(commandsDir, "to-spec.md"))).rejects.toThrow();
  });
});

describe("OpenCode import", () => {
  it("reads OpenCode mcp servers in both local and remote shapes", async () => {
    await fs.writeFile(
      configPath,
      JSON.stringify(
        {
          mcp: {
            "local-tool": {
              type: "local",
              command: ["npx", "-y", "tool"],
              environment: { FOO: "bar" },
            },
            "remote-tool": {
              type: "remote",
              url: "https://mcp.example.com",
              headers: { Authorization: "Bearer y" },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const servers = await readNativeMcpFromAgent("opencode");
    expect(servers.map((s) => s.id).sort()).toEqual(["local-tool", "remote-tool"]);

    const local = servers.find((s) => s.id === "local-tool");
    expect(local?.command).toBe("npx");
    expect(local?.args).toEqual(["-y", "tool"]);
    expect(local?.env).toEqual({ FOO: "bar" });

    const remote = servers.find((s) => s.id === "remote-tool");
    expect(remote?.url).toBe("https://mcp.example.com");
    expect(remote?.headers).toEqual({ Authorization: "Bearer y" });
  });
});
