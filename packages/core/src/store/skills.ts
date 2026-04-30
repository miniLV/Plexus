import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { ConfigLayer, SkillDef } from "../types.js";
import { ensureDir, pathExists } from "./fs-utils.js";
import { ALL_AGENTS, PLEXUS_PATHS } from "./paths.js";
import { ensureStoreScaffolding, layerRoot } from "./scaffolding.js";

function skillsRoot(layer: ConfigLayer): string {
  return path.join(layerRoot(layer), PLEXUS_PATHS.skillsDirRel);
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseSkillMarkdown(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: {}, body: raw };
  try {
    const fm = YAML.parse(m[1]) ?? {};
    return { frontmatter: fm as Record<string, unknown>, body: m[2] };
  } catch {
    return { frontmatter: {}, body: raw };
  }
}

export function serializeSkillMarkdown(skill: SkillDef): string {
  const fm: Record<string, unknown> = {
    ...(skill.frontmatter ?? {}),
    name: skill.name,
    description: skill.description ?? "",
    plexus_id: skill.id,
    plexus_enabled_agents: skill.enabledAgents,
  };
  return `---\n${YAML.stringify(fm).trim()}\n---\n${skill.body.trimStart()}`;
}

export async function readSkills(layer: ConfigLayer): Promise<SkillDef[]> {
  await ensureStoreScaffolding();
  const root = skillsRoot(layer);
  if (!(await pathExists(root))) return [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  const skills: SkillDef[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(root, entry.name, "SKILL.md");
    if (!(await pathExists(skillFile))) continue;
    const raw = await fs.readFile(skillFile, "utf8");
    const { frontmatter, body } = parseSkillMarkdown(raw);
    const enabledFromFm = Array.isArray(frontmatter.plexus_enabled_agents)
      ? (frontmatter.plexus_enabled_agents as string[])
      : ALL_AGENTS;
    skills.push({
      id: (frontmatter.plexus_id as string) ?? entry.name,
      name: (frontmatter.name as string) ?? entry.name,
      description: (frontmatter.description as string) ?? undefined,
      body,
      frontmatter,
      layer,
      enabledAgents: enabledFromFm.filter((a): a is any => ALL_AGENTS.includes(a as any)),
    });
  }
  return skills;
}

export async function writeSkill(skill: SkillDef): Promise<void> {
  await ensureStoreScaffolding();
  const root = skillsRoot(skill.layer);
  const dir = path.join(root, skill.id);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, "SKILL.md"), serializeSkillMarkdown(skill), "utf8");
}

export async function deleteSkill(layer: ConfigLayer, skillId: string): Promise<void> {
  const dir = path.join(skillsRoot(layer), skillId);
  if (await pathExists(dir)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function readAllSkills(): Promise<SkillDef[]> {
  const [team, personal] = await Promise.all([readSkills("team"), readSkills("personal")]);
  return [...team, ...personal];
}

/** Resolve the on-disk source directory for a single skill (used by sync). */
export function resolveSkillSourceDir(layer: ConfigLayer, skillId: string): string {
  return path.join(skillsRoot(layer), skillId);
}
