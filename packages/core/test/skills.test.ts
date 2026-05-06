import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import YAML from "yaml";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("skills");
const { readSkills, writeSkill } = await import("../src/store/skills.js");
const { PLEXUS_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

beforeEach(async () => {
  await fs.rm(PLEXUS_PATHS.root, { recursive: true, force: true });
});

function frontmatter(raw: string): Record<string, unknown> {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  expect(match).not.toBeNull();
  return YAML.parse(match?.[1] ?? "") as Record<string, unknown>;
}

describe("Skill store markdown normalization", () => {
  it("unwraps nested SKILL.md frontmatter and keeps a non-empty description", async () => {
    const skillDir = path.join(PLEXUS_PATHS.personal, "skills", "plantuml");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      [
        "---",
        "name: plantuml",
        'description: ""',
        "plexus_id: plantuml",
        "plexus_enabled_agents:",
        "  - codex",
        "---",
        "---",
        "name: plantuml",
        "description: **MANDATORY** - Use when creating PlantUML diagrams.",
        "---",
        "# PlantUML",
        "",
      ].join("\n"),
      "utf8",
    );

    const [skill] = await readSkills("personal");

    expect(skill.description).toBe("**MANDATORY** - Use when creating PlantUML diagrams.");
    expect(skill.body).toBe("# PlantUML\n");

    await writeSkill(skill);
    const raw = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf8");
    const fm = frontmatter(raw);

    expect(fm.description).toBe("**MANDATORY** - Use when creating PlantUML diagrams.");
    expect(raw.slice(raw.indexOf("---\n", 4))).not.toContain("name: plantuml");
  });

  it("serializes YAML sequence descriptions as strings", async () => {
    await writeSkill({
      id: "atlassian-mcp-enforcer",
      name: "atlassian-mcp-enforcer",
      description: undefined,
      body: "# Atlassian MCP Enforcer\n",
      frontmatter: {
        description: [
          "Use when enforcing Atlassian MCP access.",
          "Use when validating Jira or Confluence tools.",
        ],
      },
      layer: "personal",
      enabledAgents: ["codex"],
    });

    const raw = await fs.readFile(
      path.join(PLEXUS_PATHS.personal, "skills", "atlassian-mcp-enforcer", "SKILL.md"),
      "utf8",
    );
    const fm = frontmatter(raw);

    expect(fm.description).toBe(
      "Use when enforcing Atlassian MCP access. Use when validating Jira or Confluence tools.",
    );
  });
});
