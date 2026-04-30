import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("import-preview");
const { buildImportPreview } = await import("../src/import/from-agents.js");
const { AGENT_PATHS, PLEXUS_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

beforeEach(async () => {
  await fs.rm(PLEXUS_PATHS.root, { recursive: true, force: true });
  for (const dir of [".claude", ".cursor", ".codex", ".factory", "external-skills"]) {
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

describe("buildImportPreview", () => {
  it("counts Plexus-owned skill symlinks but ignores user-owned external symlinks", async () => {
    const cursorSkillsDir = AGENT_PATHS.cursor.skillsDir;
    await fs.mkdir(cursorSkillsDir, { recursive: true });

    const plexusSkillDir = path.join(PLEXUS_PATHS.personal, "skills", "shared-style");
    await writeSkill(plexusSkillDir, "Shared Style");
    await fs.symlink(plexusSkillDir, path.join(cursorSkillsDir, "shared-style"));

    const nativeSkillDir = path.join(cursorSkillsDir, "native-tool");
    await writeSkill(nativeSkillDir, "Native Tool");

    const externalSkillDir = path.join(sandbox.home, "external-skills", "external-tool");
    await writeSkill(externalSkillDir, "External Tool");
    await fs.symlink(externalSkillDir, path.join(cursorSkillsDir, "external-tool"));

    const preview = await buildImportPreview({
      storeMcp: [],
      storeSkills: [
        {
          id: "shared-style",
          name: "Shared Style",
          body: "store body",
          layer: "personal",
          enabledAgents: ["claude-code"],
        },
      ],
    });

    expect(preview.perAgent.cursor.skills).toBe(2);
    expect(preview.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "extend",
          id: "shared-style",
          agentsToAdd: ["cursor"],
        }),
        expect.objectContaining({
          kind: "new",
          item: expect.objectContaining({ id: "native-tool" }),
        }),
      ]),
    );
    expect(preview.skills).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "new",
          item: expect.objectContaining({ id: "external-tool" }),
        }),
      ]),
    );
  });
});
