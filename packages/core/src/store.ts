import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { ALL_AGENTS, PLEXUS_PATHS } from "./paths.js";
import type {
  ConfigLayer,
  MCPServerDef,
  PlexusConfig,
  SkillDef,
} from "./types.js";

/**
 * Plexus filesystem store layout:
 *
 *   ~/.config/plexus/
 *   ├── config.yaml
 *   ├── team/
 *   │   ├── mcp/servers.yaml
 *   │   └── skills/<id>/SKILL.md
 *   └── personal/
 *       ├── mcp/servers.yaml
 *       └── skills/<id>/SKILL.md
 */

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureStoreScaffolding(): Promise<void> {
  await ensureDir(PLEXUS_PATHS.root);
  for (const layer of ["team", "personal"] as ConfigLayer[]) {
    const base = layer === "team" ? PLEXUS_PATHS.team : PLEXUS_PATHS.personal;
    await ensureDir(path.join(base, PLEXUS_PATHS.mcpDirRel));
    await ensureDir(path.join(base, PLEXUS_PATHS.skillsDirRel));
  }

  if (!(await exists(PLEXUS_PATHS.config))) {
    const defaults: PlexusConfig = {
      agents: Object.fromEntries(ALL_AGENTS.map((a) => [a, true])) as PlexusConfig["agents"],
      syncStrategy: "symlink",
    };
    await fs.writeFile(PLEXUS_PATHS.config, YAML.stringify(defaults), "utf8");
  }
}

export async function readConfig(): Promise<PlexusConfig> {
  await ensureStoreScaffolding();
  const raw = await fs.readFile(PLEXUS_PATHS.config, "utf8");
  return YAML.parse(raw) as PlexusConfig;
}

export async function writeConfig(cfg: PlexusConfig): Promise<void> {
  await ensureStoreScaffolding();
  await fs.writeFile(PLEXUS_PATHS.config, YAML.stringify(cfg), "utf8");
}

function layerRoot(layer: ConfigLayer): string {
  return layer === "team" ? PLEXUS_PATHS.team : PLEXUS_PATHS.personal;
}

function mcpFile(layer: ConfigLayer): string {
  return path.join(layerRoot(layer), PLEXUS_PATHS.mcpDirRel, "servers.yaml");
}

function skillsRoot(layer: ConfigLayer): string {
  return path.join(layerRoot(layer), PLEXUS_PATHS.skillsDirRel);
}

// ────────────────────────────────────────────────────────────────────────────
// MCP servers
// ────────────────────────────────────────────────────────────────────────────

export async function readMCP(layer: ConfigLayer): Promise<MCPServerDef[]> {
  await ensureStoreScaffolding();
  const file = mcpFile(layer);
  if (!(await exists(file))) return [];
  const raw = await fs.readFile(file, "utf8");
  const parsed = YAML.parse(raw) ?? {};
  const list = Array.isArray(parsed?.servers) ? parsed.servers : [];
  return list.map((s: any) => ({ ...s, layer })) as MCPServerDef[];
}

export async function writeMCP(layer: ConfigLayer, servers: MCPServerDef[]): Promise<void> {
  await ensureStoreScaffolding();
  const stripped = servers.map(({ layer: _l, ...rest }) => rest);
  const payload = { servers: stripped };
  await fs.writeFile(mcpFile(layer), YAML.stringify(payload), "utf8");
}

export async function readAllMCP(): Promise<MCPServerDef[]> {
  const [team, personal] = await Promise.all([readMCP("team"), readMCP("personal")]);
  return [...team, ...personal];
}

// ────────────────────────────────────────────────────────────────────────────
// Skills
// ────────────────────────────────────────────────────────────────────────────

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
    name: skill.name,
    description: skill.description ?? "",
    plexus_id: skill.id,
    plexus_enabled_agents: skill.enabledAgents,
    ...(skill.frontmatter ?? {}),
  };
  return `---\n${YAML.stringify(fm).trim()}\n---\n${skill.body.trimStart()}`;
}

export async function readSkills(layer: ConfigLayer): Promise<SkillDef[]> {
  await ensureStoreScaffolding();
  const root = skillsRoot(layer);
  if (!(await exists(root))) return [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  const skills: SkillDef[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(root, entry.name, "SKILL.md");
    if (!(await exists(skillFile))) continue;
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
      enabledAgents: enabledFromFm.filter((a): a is any =>
        ALL_AGENTS.includes(a as any),
      ),
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
  if (await exists(dir)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function readAllSkills(): Promise<SkillDef[]> {
  const [team, personal] = await Promise.all([readSkills("team"), readSkills("personal")]);
  return [...team, ...personal];
}
