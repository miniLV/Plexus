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
};

/** Per-agent native config locations. */
export const AGENT_PATHS: Record<AgentId, AgentCapabilities> = {
  "claude-code": {
    mcp: true,
    skills: true,
    mcpFormat: "json",
    // Claude Desktop config (Claude Code reuses MCP from Claude Desktop on macOS).
    mcpPath:
      platform === "darwin"
        ? path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
        : platform === "win32"
        ? path.join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json")
        : path.join(home, ".config", "Claude", "claude_desktop_config.json"),
    skillsDir: path.join(home, ".claude", "skills"),
  },
  cursor: {
    mcp: true,
    skills: true,
    mcpFormat: "json",
    mcpPath: path.join(home, ".cursor", "mcp.json"),
    // Cursor doesn't have a true "skill" concept yet; we publish to commands.
    skillsDir: path.join(home, ".cursor", "commands"),
  },
  codex: {
    mcp: true,
    skills: true,
    mcpFormat: "toml",
    mcpPath: path.join(home, ".codex", "config.toml"),
    skillsDir: path.join(home, ".codex", "prompts"),
  },
  "factory-droid": {
    mcp: true,
    skills: true,
    mcpFormat: "json",
    mcpPath: path.join(home, ".factory", "mcp.json"),
    skillsDir: path.join(home, ".factory", "skills"),
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
