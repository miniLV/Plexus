import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { AgentId, ConfigLayer, SkillDef } from "../types.js";
import { ensureDir, pathExists } from "./fs-utils.js";
import { ALL_AGENTS, PLEXUS_PATHS } from "./paths.js";
import { ensureStoreScaffolding, layerRoot } from "./scaffolding.js";

function skillsRoot(layer: ConfigLayer): string {
  return path.join(layerRoot(layer), PLEXUS_PATHS.skillsDirRel);
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/** Hidden sidecar file Plexus uses to persist per-skill enabledAgents. */
const SIDECAR_FILE = ".plexus.json";

function stripPlexusKeys(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !key.startsWith("plexus_")));
}

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
    ...stripPlexusKeys(skill.frontmatter ?? {}),
    name,
    description,
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
    const id = entry.name;
    const name = stringValue(frontmatter.name) ?? stringValue(nestedFrontmatter.name) ?? entry.name;
    const nestedDescription = descriptionValue(nestedFrontmatter.description);
    const sidecarAgents = await readSkillSidecar(layer, entry.name);
    skills.push({
      id,
      name,
      description: nestedDescription ?? descriptionValue(frontmatter.description),
      body: normalizedBody,
      frontmatter: stripPlexusKeys({ ...nestedFrontmatter, ...frontmatter }),
      layer,
      enabledAgents: (sidecarAgents ?? ALL_AGENTS).filter((a) => ALL_AGENTS.includes(a)),
    });
  }
  return skills;
}

function sidecarPath(layer: ConfigLayer, id: string): string {
  return path.join(skillsRoot(layer), id, SIDECAR_FILE);
}

async function readSkillSidecar(layer: ConfigLayer, id: string): Promise<AgentId[] | undefined> {
  try {
    const raw = await fs.readFile(sidecarPath(layer, id), "utf8");
    const parsed = JSON.parse(raw) as { enabledAgents?: unknown };
    if (!Array.isArray(parsed.enabledAgents)) return undefined;
    return parsed.enabledAgents.filter(
      (a): a is AgentId => typeof a === "string" && ALL_AGENTS.includes(a as AgentId),
    );
  } catch {
    return undefined;
  }
}

async function writeSkillSidecar(skill: SkillDef): Promise<void> {
  await fs.writeFile(
    sidecarPath(skill.layer, skill.id),
    JSON.stringify({ enabledAgents: skill.enabledAgents }, null, 2),
    "utf8",
  );
}

export async function writeSkill(skill: SkillDef): Promise<void> {
  await ensureStoreScaffolding();
  const root = skillsRoot(skill.layer);
  const dir = path.join(root, skill.id);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, "SKILL.md"), serializeSkillMarkdown(skill), "utf8");
  await writeSkillSidecar(skill);
}

export async function writeSkillBundle(skill: SkillDef, sourceDir?: string): Promise<void> {
  await writeSkill(skill);
  if (!sourceDir) return;

  const destDir = path.join(skillsRoot(skill.layer), skill.id);
  await copySkillResources(sourceDir, destDir);
}

async function copySkillResources(sourceDir: string, destDir: string): Promise<void> {
  try {
    const [sourceReal, destReal] = await Promise.all([
      fs.realpath(sourceDir).catch(() => path.resolve(sourceDir)),
      fs.realpath(destDir).catch(() => path.resolve(destDir)),
    ]);
    if (sourceReal === destReal) return;

    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "SKILL.md" || entry.name === ".DS_Store" || entry.name === SIDECAR_FILE)
        continue;
      await fs.cp(path.join(sourceDir, entry.name), path.join(destDir, entry.name), {
        recursive: true,
        force: true,
      });
    }
  } catch {
    // A missing or unreadable native bundle should not block importing SKILL.md.
  }
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
