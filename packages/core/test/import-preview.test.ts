import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("import-preview");
const { buildImportPreview } = await import("../src/import/from-agents.js");
const { applyImport } = await import("../src/import/index.js");
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
  it("preserves Codex URL MCP servers when importing native config", async () => {
    const codexConfig = [
      "[mcp_servers.remote-figma]",
      'url = "https://mcp.figma.com/mcp"',
      'http_headers = { Authorization = "Bearer token" }',
      "",
    ].join("\n");
    await fs.mkdir(path.dirname(AGENT_PATHS.codex.mcpPath), { recursive: true });
    await fs.writeFile(AGENT_PATHS.codex.mcpPath, codexConfig, "utf8");

    const preview = await buildImportPreview({ storeMcp: [], storeSkills: [] });

    expect(preview.mcp).toEqual([
      expect.objectContaining({
        kind: "new",
        item: expect.objectContaining({
          id: "remote-figma",
          command: "",
          url: "https://mcp.figma.com/mcp",
          headers: { Authorization: "Bearer token" },
        }),
      }),
    ]);
  });

  it("counts real and symlinked native skill directories", async () => {
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

    expect(preview.perAgent.cursor.skills).toBe(3);
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
        expect.objectContaining({
          kind: "new",
          item: expect.objectContaining({ id: "external-tool" }),
        }),
      ]),
    );
  });

  it("reads Cursor Agent Skills from ~/.cursor/skills instead of commands", async () => {
    await writeSkill(path.join(sandbox.home, ".cursor", "skills", "native-tool"), "Native Tool");
    await writeSkill(
      path.join(sandbox.home, ".cursor", "commands", "legacy-command"),
      "Legacy Command",
    );

    const preview = await buildImportPreview({ storeMcp: [], storeSkills: [] });

    expect(AGENT_PATHS.cursor.skillsDir).toBe(path.join(sandbox.home, ".cursor", "skills"));
    expect(preview.perAgent.cursor.skills).toBe(1);
    expect(preview.skills).toEqual(
      expect.arrayContaining([
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
          item: expect.objectContaining({ id: "legacy-command" }),
        }),
      ]),
    );
  });

  it("copies bundled native skill resources into the Plexus personal store", async () => {
    const nativeSkillDir = path.join(AGENT_PATHS["claude-code"].skillsDir, "diagram-tool");
    await writeSkill(nativeSkillDir, "Diagram Tool");
    await fs.mkdir(path.join(nativeSkillDir, "scripts"), { recursive: true });
    await fs.writeFile(
      path.join(nativeSkillDir, "scripts", "validate.py"),
      "print('ok')\n",
      "utf8",
    );
    await fs.mkdir(path.join(nativeSkillDir, "references"), { recursive: true });
    await fs.writeFile(path.join(nativeSkillDir, "references", "syntax.md"), "# Syntax\n", "utf8");

    await applyImport();

    const storeDir = path.join(PLEXUS_PATHS.personal, "skills", "diagram-tool");
    await expect(fs.readFile(path.join(storeDir, "SKILL.md"), "utf8")).resolves.toContain(
      "Diagram Tool",
    );
    await expect(fs.readFile(path.join(storeDir, "scripts", "validate.py"), "utf8")).resolves.toBe(
      "print('ok')\n",
    );
    await expect(fs.readFile(path.join(storeDir, "references", "syntax.md"), "utf8")).resolves.toBe(
      "# Syntax\n",
    );
  });
});
