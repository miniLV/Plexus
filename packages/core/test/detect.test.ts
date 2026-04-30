import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const home = await fs.mkdtemp(path.join(os.tmpdir(), "plexus-detect-"));
const bin = path.join(home, "bin");
process.env.HOME = home;
process.env.USERPROFILE = home;
process.env.PATH = bin;
process.env.PLEXUS_DETECT_CONFIG_ONLY = undefined;

const { detectAgents } = await import("../src/agents/detect.js");
const { listAgentCatalog } = await import("../src/agents/catalog.js");
const { AGENT_PATHS } = await import("../src/store/paths.js");

afterAll(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

describe("detectAgents", () => {
  it("detects Cursor from an installed CLI even before config files exist", async () => {
    await fs.mkdir(bin, { recursive: true });
    const cursorBin = path.join(bin, "cursor");
    await fs.writeFile(cursorBin, "#!/bin/sh\n", "utf8");
    await fs.chmod(cursorBin, 0o755);

    const cursor = detectAgents().find((agent) => agent.id === "cursor");

    expect(cursor?.installed).toBe(true);
    await expect(fs.stat(path.join(home, ".cursor"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not treat Plexus-created skill directories as native installs", async () => {
    await fs.mkdir(path.join(home, ".qwen", "skills"), { recursive: true });

    const qwen = detectAgents().find((agent) => agent.id === "qwen-code");

    expect(qwen?.installed).toBe(false);
  });

  it("uses the Codex skills directory rather than legacy prompts", () => {
    expect(AGENT_PATHS.codex.skillsDir).toBe(path.join(home, ".codex", "skills"));
  });
});

describe("listAgentCatalog", () => {
  it("does not mark manual presets installed from an empty root directory", async () => {
    await fs.mkdir(path.join(home, ".kiro"), { recursive: true });

    const kiro = listAgentCatalog().find((agent) => agent.id === "kiro");

    expect(kiro?.installed).toBe(false);
  });

  it("marks manual presets installed when a known config file exists", async () => {
    const mcpPath = path.join(home, ".kiro", "settings", "mcp.json");
    await fs.mkdir(path.dirname(mcpPath), { recursive: true });
    await fs.writeFile(mcpPath, "{}", "utf8");

    const kiro = listAgentCatalog().find((agent) => agent.id === "kiro");

    expect(kiro?.installed).toBe(true);
  });
});
