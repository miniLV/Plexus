import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("inspect");
const { inspectAgent } = await import("../src/agents/inspect.js");
const { AGENT_PATHS, PLEXUS_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

beforeEach(async () => {
  await fs.rm(PLEXUS_PATHS.root, { recursive: true, force: true });
  for (const dir of [".cursor", ".agents"]) {
    await fs.rm(path.join(sandbox.home, dir), { recursive: true, force: true });
  }
});

async function writeSkill(dir: string, name: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${name} description\n---\n${name} body\n`,
    "utf8",
  );
}

describe("inspectAgent", () => {
  it("keeps the agent skill path and only marks Plexus-store links as Plexus-owned", async () => {
    const cursorSkillsDir = AGENT_PATHS.cursor.skillsDir;
    await fs.mkdir(cursorSkillsDir, { recursive: true });

    const externalSkillDir = path.join(sandbox.home, ".agents", "skills", "find-skills");
    await writeSkill(externalSkillDir, "Find Skills");
    await fs.symlink(externalSkillDir, path.join(cursorSkillsDir, "find-skills"));

    const plexusSkillDir = path.join(PLEXUS_PATHS.personal, "skills", "shared-style");
    await writeSkill(plexusSkillDir, "Shared Style");
    await fs.symlink(plexusSkillDir, path.join(cursorSkillsDir, "shared-style"));

    const cursorManagedSkillDir = path.join(
      sandbox.home,
      ".cursor",
      "skills-cursor",
      "create-skill",
    );
    await writeSkill(cursorManagedSkillDir, "create-skill");

    const inspection = await inspectAgent("cursor");

    expect(inspection.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "find-skills",
          path: path.join(cursorSkillsDir, "find-skills"),
          linkTarget: externalSkillDir,
          managedByPlexus: false,
        }),
        expect.objectContaining({
          id: "shared-style",
          path: path.join(cursorSkillsDir, "shared-style"),
          linkTarget: plexusSkillDir,
          managedByPlexus: true,
        }),
      ]),
    );
    expect(inspection.skills.map((skill) => skill.id)).not.toContain("create-skill");
  });
});
