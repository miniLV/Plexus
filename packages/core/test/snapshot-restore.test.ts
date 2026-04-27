/**
 * ADR-008: snapshot → mutate → restore must return every snapshotted file
 * to its original byte content.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("snapshot-restore");
const { snapshotAgentConfigs, restoreSnapshot, listBackups } = await import(
  "../src/backup/index.js"
);
const { AGENT_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

describe("snapshot/restore round-trip", () => {
  it("restores all four agent files to their original bytes", async () => {
    // Seed all four agents with distinguishable content.
    const seeds: Record<string, string> = {};
    for (const id of ["claude-code", "cursor", "codex", "factory-droid"] as const) {
      const p = AGENT_PATHS[id].mcpPath;
      await fs.mkdir(path.dirname(p), { recursive: true });
      const seed =
        id === "codex"
          ? `[auth]\ntoken = "${id}-original"\n\n[mcp_servers]\n`
          : JSON.stringify({ marker: id, mcpServers: {} }, null, 2);
      await fs.writeFile(p, seed, "utf8");
      seeds[id] = seed;
    }

    const snap = await snapshotAgentConfigs({ reason: "test" });
    expect(snap.entries.length).toBe(4);

    // Mutate every file.
    for (const id of ["claude-code", "cursor", "codex", "factory-droid"] as const) {
      const p = AGENT_PATHS[id].mcpPath;
      await fs.writeFile(p, "MUTATED", "utf8");
    }

    // Restore.
    const out = await restoreSnapshot(snap.id);
    expect(out.errors).toEqual([]);
    expect(out.restored).toBe(4);

    // Every file matches the original bytes exactly.
    for (const id of ["claude-code", "cursor", "codex", "factory-droid"] as const) {
      const p = AGENT_PATHS[id].mcpPath;
      const after = await fs.readFile(p, "utf8");
      expect(after).toBe(seeds[id]);
    }
  });

  it("listBackups returns the snapshot we just took", async () => {
    const list = await listBackups();
    expect(list.length).toBeGreaterThanOrEqual(1);
    // Each entry has the manifest fields we expect.
    for (const e of list[0].entries) {
      expect(typeof e.agent).toBe("string");
      expect(typeof e.originalPath).toBe("string");
      expect(typeof e.backupPath).toBe("string");
    }
  });
});
