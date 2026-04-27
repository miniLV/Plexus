/**
 * ADR-008 / CLAUDE.md §4.3: cleanupLegacyResidue must move every
 * `<name>.plexus-backup-*` entry out of agent skill directories into
 * `_legacy-residue/`, and be idempotent (no-op on the second run).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("cleanup-residue");
const { cleanupLegacyResidue, LEGACY_RESIDUE_ROOT } = await import("../src/backup/index.js");
const { AGENT_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

describe("cleanupLegacyResidue", () => {
  it("moves residue out of agent skill dirs and is idempotent on a second run", async () => {
    // Seed residue in two agents' skill dirs.
    const claudeSkills = AGENT_PATHS["claude-code"].skillsDir;
    const droidSkills = AGENT_PATHS["factory-droid"].skillsDir;
    await fs.mkdir(claudeSkills, { recursive: true });
    await fs.mkdir(droidSkills, { recursive: true });
    await fs.mkdir(path.join(claudeSkills, "good-skill"));
    await fs.mkdir(path.join(claudeSkills, "stale-skill.plexus-backup-2025-01-01T00-00-00Z"));
    await fs.writeFile(
      path.join(droidSkills, "another.plexus-backup-2025-02-02T00-00-00Z"),
      "junk",
    );

    const r1 = await cleanupLegacyResidue();
    expect(r1.moved.length).toBe(2);
    // Originals gone.
    expect(await fs.readdir(claudeSkills)).toEqual(["good-skill"]);
    expect(await fs.readdir(droidSkills)).toEqual([]);
    // Moved targets exist under _legacy-residue/.
    for (const m of r1.moved) {
      expect(m.to.startsWith(LEGACY_RESIDUE_ROOT)).toBe(true);
      await fs.access(m.to);
    }

    // Second run is a no-op.
    const r2 = await cleanupLegacyResidue();
    expect(r2.moved.length).toBe(0);
  });
});
