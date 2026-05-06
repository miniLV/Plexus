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

function hasFrontmatter(parsed: { frontmatter: Record<string, unknown>; body: string }): boolean {
  return Object.keys(parsed.frontmatter).length > 0;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function descriptionValue(value: unknown): string | undefined {
  const direct = stringValue(value);
  if (direct) return direct;
  if (!Array.isArray(value)) return undefined;
  const parts = value
    .map((part) => stringValue(part))
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function parseLooseFrontmatter(raw: string): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || rawValue === undefined) continue;
    const value = rawValue.trim();
    if (!value) continue;
    frontmatter[key] = value.replace(/^(['"])(.*)\1$/, "$2");
  }
  return frontmatter;
}

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
    return { frontmatter: parseLooseFrontmatter(m[1]), body: m[2] };
  }
}

export function serializeSkillMarkdown(skill: SkillDef): string {
  const nested = parseSkillMarkdown(skill.body);
  const nestedFrontmatter = hasFrontmatter(nested) ? nested.frontmatter : {};
  const body = hasFrontmatter(nested) ? nested.body : skill.body;
  const name =
    stringValue(skill.name) ??
    stringValue(skill.frontmatter?.name) ??
    stringValue(nestedFrontmatter.name) ??
    skill.id;
  const nestedDescription = descriptionValue(nestedFrontmatter.description);
  const description =
    nestedDescription ??
    descriptionValue(skill.description) ??
    descriptionValue(skill.frontmatter?.description) ??
    name;
  const fm: Record<string, unknown> = {
    ...nestedFrontmatter,
    ...(skill.frontmatter ?? {}),
    name,
    description,
    plexus_id: skill.id,
    plexus_enabled_agents: skill.enabledAgents,
  };
  return `---\n${YAML.stringify(fm).trim()}\n---\n${body.trimStart()}`;
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
    const nested = parseSkillMarkdown(body);
    const nestedFrontmatter = hasFrontmatter(nested) ? nested.frontmatter : {};
    const normalizedBody = hasFrontmatter(nested) ? nested.body : body;
    const enabledFromFm = Array.isArray(frontmatter.plexus_enabled_agents)
      ? (frontmatter.plexus_enabled_agents as string[])
      : ALL_AGENTS;
    const id = stringValue(frontmatter.plexus_id) ?? entry.name;
    const name = stringValue(frontmatter.name) ?? stringValue(nestedFrontmatter.name) ?? entry.name;
    const nestedDescription = descriptionValue(nestedFrontmatter.description);
    skills.push({
      id,
      name,
      description: nestedDescription ?? descriptionValue(frontmatter.description),
      body: normalizedBody,
      frontmatter: { ...nestedFrontmatter, ...frontmatter },
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
