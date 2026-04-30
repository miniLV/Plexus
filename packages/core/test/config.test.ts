import fs from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("config");
const { normalizeConfig, readConfig, writeConfig } = await import("../src/store/config.js");
const { ALL_AGENTS, PLEXUS_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

beforeEach(async () => {
  await fs.rm(PLEXUS_PATHS.root, { recursive: true, force: true });
});

describe("Plexus config validation", () => {
  it("merges partial agent config with defaults", () => {
    const config = normalizeConfig({ agents: { codex: false }, syncStrategy: "copy" });

    expect(config.syncStrategy).toBe("copy");
    expect(config.agents.codex).toBe(false);
    for (const agent of ALL_AGENTS.filter((agent) => agent !== "codex")) {
      expect(config.agents[agent]).toBe(true);
    }
  });

  it("rejects invalid sync strategies and agent flags", () => {
    expect(() => normalizeConfig({ agents: {}, syncStrategy: "rsync" })).toThrow("syncStrategy");
    expect(() => normalizeConfig({ agents: { codex: "yes" }, syncStrategy: "copy" })).toThrow(
      "agents.codex",
    );
  });

  it("writes atomically and persists only normalized keys", async () => {
    await writeConfig({
      teamRepo: "  https://github.com/acme/team-plexus-config.git  ",
      agents: { codex: false },
      syncStrategy: "symlink",
    });

    const config = await readConfig();
    expect(config.teamRepo).toBe("https://github.com/acme/team-plexus-config.git");
    expect(config.agents.codex).toBe(false);
    expect(Object.keys(config.agents).sort()).toEqual([...ALL_AGENTS].sort());
  });
});
