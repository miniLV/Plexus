/**
 * Plexus core types.
 *
 * The data model is intentionally minimal for MVP:
 * - One central store under ~/.config/plexus/
 *   - team/        synced from a team git repo (read-only locally)
 *   - personal/    user's local additions (override / supplement team)
 *   - config.yaml  enable/disable + agent selection
 * - Each item (MCP server or skill) declares which agents it should publish to.
 * - Adapters know how to *apply* the merged store to each agent's native config.
 */

export type AgentId = "claude-code" | "cursor" | "codex" | "factory-droid";

export interface AgentDescriptor {
  id: AgentId;
  displayName: string;
  /** Root config directory (e.g. ~/.claude). */
  rootDir: string;
  /** Whether the agent appears to be installed on this machine. */
  installed: boolean;
  /** Resolved capabilities for the current platform. */
  capabilities: AgentCapabilities;
}

export interface AgentCapabilities {
  /** Does this agent support MCP servers natively? */
  mcp: boolean;
  /** Does this agent support skills (markdown bundles)? */
  skills: boolean;
  /** Native MCP config file format. */
  mcpFormat: "json" | "toml";
  /** Where the MCP config file lives. */
  mcpPath: string;
  /** Where the skills directory lives. */
  skillsDir: string;
}

export interface MCPServerDef {
  /** Stable id, used as the key in mcpServers map. */
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** Free-form description for the dashboard. */
  description?: string;
  /** Layer this item belongs to ("team" or "personal"). */
  layer: ConfigLayer;
  /** Subset of agents this item should publish to. */
  enabledAgents: AgentId[];
}

export interface SkillDef {
  /** Stable id, also used as folder name. */
  id: string;
  /** Display name. */
  name: string;
  description?: string;
  /** Raw markdown body of SKILL.md (excluding frontmatter). */
  body: string;
  /** Optional frontmatter passthrough for adapter-specific fields. */
  frontmatter?: Record<string, unknown>;
  layer: ConfigLayer;
  enabledAgents: AgentId[];
}

export type ConfigLayer = "team" | "personal";

export interface PlexusConfig {
  /** Optional team repo URL (https://github.com/org/repo). */
  teamRepo?: string;
  /** Per-agent enable switch (user can disable an installed agent). */
  agents: Record<AgentId, boolean>;
  /** Sync strategy: symlink (preferred) or copy. */
  syncStrategy: "symlink" | "copy";
}

export interface SyncResult {
  agent: AgentId;
  applied: {
    mcp: number;
    skills: number;
  };
  warnings: string[];
  errors: string[];
}

export interface SyncReport {
  results: SyncResult[];
  startedAt: string;
  finishedAt: string;
}
