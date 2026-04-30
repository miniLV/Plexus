/**
 * ADR-008: snapshot → mutate → restore must return every snapshotted file
 * to its original byte content.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("snapshot-restore");
const { snapshotAgentConfigs, restoreSnapshot, listBackups, snapshotSingleFile } = await import(
  "../src/backup/index.js"
);
const { AGENT_PATHS, ALL_AGENTS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

describe("snapshot/restore round-trip", () => {
  it("restores all agent files to their original bytes", async () => {
    // Seed every built-in agent with distinguishable content.
    const seeds: Record<string, string> = {};
    for (const id of ALL_AGENTS) {
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
    expect(snap.entries.length).toBe(ALL_AGENTS.length);

    // Mutate every file.
    for (const id of ALL_AGENTS) {
      const p = AGENT_PATHS[id].mcpPath;
      await fs.writeFile(p, "MUTATED", "utf8");
    }

    // Restore.
    const out = await restoreSnapshot(snap.id);
    expect(out.errors).toEqual([]);
    expect(out.restored).toBe(ALL_AGENTS.length);

    // Every file matches the original bytes exactly.
    for (const id of ALL_AGENTS) {
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

  it("keeps single-file snapshots unique when basenames match in the same millisecond", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T12:00:00.000Z"));
    try {
      const cursorRules = path.join(sandbox.home, ".cursor", "AGENTS.md");
      const codexRules = path.join(sandbox.home, ".codex", "AGENTS.md");
      await fs.mkdir(path.dirname(cursorRules), { recursive: true });
      await fs.mkdir(path.dirname(codexRules), { recursive: true });
      await fs.writeFile(cursorRules, "cursor", "utf8");
      await fs.writeFile(codexRules, "codex", "utf8");

      const cursorBackup = await snapshotSingleFile(cursorRules, "same-ms");
      const codexBackup = await snapshotSingleFile(codexRules, "same-ms");

      expect(cursorBackup).toBeTruthy();
      expect(codexBackup).toBeTruthy();
      expect(cursorBackup).not.toBe(codexBackup);

      const backups = await listBackups();
      const entries = backups.flatMap((backup) => backup.entries);
      const cursorEntry = entries.find((entry) => entry.originalPath === cursorRules);
      const codexEntry = entries.find((entry) => entry.originalPath === codexRules);
      expect(cursorEntry?.backupPath).toBeTruthy();
      expect(codexEntry?.backupPath).toBeTruthy();
      expect(path.basename(cursorEntry!.backupPath)).not.toBe(
        path.basename(codexEntry!.backupPath),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
