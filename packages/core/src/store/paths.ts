import os from "node:os";
import path from "node:path";
import type { AgentCapabilities, AgentId } from "../types.js";

const home = os.homedir();
const platform = process.platform;

/** Where Plexus stores its central source of truth. */
export const PLEXUS_ROOT = path.join(home, ".config", "plexus");

export const PLEXUS_PATHS = {
  root: PLEXUS_ROOT,
  team: path.join(PLEXUS_ROOT, "team"),
  personal: path.join(PLEXUS_ROOT, "personal"),
  config: path.join(PLEXUS_ROOT, "config.yaml"),
  mcpDirRel: "mcp",
  skillsDirRel: "skills",
  /** Plexus-owned canonical generated MCP files, symlinked from agent paths. */
  mcpCache: path.join(PLEXUS_ROOT, ".cache", "mcp"),
  /** Timestamped snapshots of agent native configs taken before each sync. */
  backups: path.join(PLEXUS_ROOT, "backups"),
};

/** Per-agent native config locations. */
export const AGENT_PATHS: Record<AgentId, AgentCapabilities> = {
  "claude-code": {
    mcp: true,
    skills: true,
    mcpFormat: "json",
    // Claude Code stores user-scope MCPs in `~/.claude.json` (alongside many
    // other client state keys). NOT to be confused with Claude *Desktop*
    // which uses `~/Library/Application Support/Claude/claude_desktop_config.json`.
    mcpPath: path.join(home, ".claude.json"),
    skillsDir: path.join(home, ".claude", "skills"),
    // ~/.claude.json carries auth, history, settings, etc. — never replace
    // the whole file; only rewrite the mcpServers section.
    mcpFileMode: "shared",
  },
  cursor: {
    mcp: true,
    skills: true,
    mcpFormat: "json",
    mcpPath: path.join(home, ".cursor", "mcp.json"),
    // Cursor doesn't have a true "skill" concept yet; we publish to commands.
    skillsDir: path.join(home, ".cursor", "commands"),
    // ~/.cursor/mcp.json is exclusively for MCP — safe to fully own via
    // a symlink to the Plexus canonical cache.
    mcpFileMode: "exclusive",
  },
  codex: {
    mcp: true,
    skills: true,
    mcpFormat: "toml",
    mcpPath: path.join(home, ".codex", "config.toml"),
    skillsDir: path.join(home, ".codex", "prompts"),
    // config.toml has [profile], [auth], [mcp_servers], ... — partial-write.
    mcpFileMode: "shared",
  },
  "factory-droid": {
    mcp: true,
    skills: true,
    mcpFormat: "json",
    mcpPath: path.join(home, ".factory", "mcp.json"),
    skillsDir: path.join(home, ".factory", "skills"),
    // Plexus can fully own this file.
    mcpFileMode: "exclusive",
  },
};

export const AGENT_DISPLAY_NAMES: Record<AgentId, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  "factory-droid": "Factory Droid",
};

/** Root directory we use to "detect" each agent. */
export const AGENT_ROOTS: Record<AgentId, string> = {
  "claude-code": path.join(home, ".claude"),
  cursor: path.join(home, ".cursor"),
  codex: path.join(home, ".codex"),
  "factory-droid": path.join(home, ".factory"),
};

export const ALL_AGENTS: AgentId[] = [
  "claude-code",
  "cursor",
  "codex",
  "factory-droid",
];
