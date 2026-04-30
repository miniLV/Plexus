import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AGENT_DISPLAY_NAMES, AGENT_PATHS, AGENT_ROOTS, ALL_AGENTS } from "../store/paths.js";
import { isAgentInstalled } from "./detect.js";

export type AgentCatalogSupport = "full" | "instructions-only" | "manual";

export interface AgentCatalogEntry {
  id: string;
  displayName: string;
  support: AgentCatalogSupport;
  managed: boolean;
  installed: boolean;
  rootDir?: string;
  instructionFile?: string;
  mcpPath?: string;
  skillsDir?: string;
  note: string;
}

const home = os.homedir();

function exists(p?: string): boolean {
  return p ? fs.existsSync(p) : false;
}

function vscodeUserDir(): string {
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Code", "User");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? home, "Code", "User");
  }
  return path.join(home, ".config", "Code", "User");
}

function globalStorageDir(extensionId: string): string {
  return path.join(vscodeUserDir(), "globalStorage", extensionId);
}

function zedUserDir(): string {
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Zed");
  }
  return path.join(home, ".config", "zed");
}

const MANUAL_PRESETS: Array<Omit<AgentCatalogEntry, "installed">> = [
  {
    id: "windsurf",
    displayName: "Windsurf Cascade",
    support: "manual",
    managed: false,
    rootDir: path.join(home, ".codeium", "windsurf"),
    mcpPath: path.join(home, ".codeium", "windsurf", "mcp_config.json"),
    instructionFile: path.join(home, ".codeium", "windsurf", "AGENTS.md"),
    note: "Catalog only for now. Windsurf uses its own Rules surface; add as custom if you want Plexus to track one instruction file.",
  },
  {
    id: "kiro",
    displayName: "Kiro",
    support: "manual",
    managed: false,
    rootDir: path.join(home, ".kiro"),
    mcpPath: path.join(home, ".kiro", "settings", "mcp.json"),
    instructionFile: path.join(home, ".kiro", "steering", "plexus.md"),
    note: "Catalog only for now. Kiro has user-level MCP and steering files, but Plexus does not write them yet.",
  },
  {
    id: "vscode-copilot",
    displayName: "VS Code / GitHub Copilot",
    support: "manual",
    managed: false,
    rootDir: vscodeUserDir(),
    mcpPath: path.join(vscodeUserDir(), "mcp.json"),
    instructionFile: path.join(vscodeUserDir(), "AGENTS.md"),
    note: "VS Code stores user MCP separately from repo instructions. Add as custom if you keep a user instruction file.",
  },
  {
    id: "cline",
    displayName: "Cline",
    support: "manual",
    managed: false,
    rootDir: globalStorageDir("saoudrizwan.claude-dev"),
    instructionFile: path.join(globalStorageDir("saoudrizwan.claude-dev"), "AGENTS.md"),
    note: "VS Code extension storage varies by editor profile; use custom paths if yours differs.",
  },
  {
    id: "roo-code",
    displayName: "Roo Code",
    support: "manual",
    managed: false,
    rootDir: globalStorageDir("rooveterinaryinc.roo-cline"),
    instructionFile: path.join(globalStorageDir("rooveterinaryinc.roo-cline"), "AGENTS.md"),
    note: "VS Code extension storage varies by editor profile; use custom paths if yours differs.",
  },
  {
    id: "kilo-code",
    displayName: "Kilo Code",
    support: "manual",
    managed: false,
    rootDir: path.join(home, ".config", "kilo"),
    mcpPath: path.join(home, ".config", "kilo", "kilo.jsonc"),
    instructionFile: path.join(home, ".config", "kilo", "AGENTS.md"),
    note: "Kilo uses JSONC and extension/project scopes; catalog entry is manual until Plexus can round-trip JSONC.",
  },
  {
    id: "continue",
    displayName: "Continue",
    support: "manual",
    managed: false,
    rootDir: path.join(home, ".continue"),
    instructionFile: path.join(home, ".continue", "AGENTS.md"),
    note: "Continue configuration is flexible and often project-specific; add a custom instruction file if you use one.",
  },
  {
    id: "aider",
    displayName: "Aider",
    support: "instructions-only",
    managed: false,
    instructionFile: path.join(home, ".aider.conf.yml"),
    note: "Aider is config-file based. Plexus can track a file, but does not translate MCP or skills for Aider.",
  },
  {
    id: "amp",
    displayName: "Amp",
    support: "manual",
    managed: false,
    rootDir: path.join(home, ".config", "amp"),
    instructionFile: path.join(home, ".config", "amp", "AGENTS.md"),
    note: "Amp supports agent instruction files, but local config layout can vary.",
  },
  {
    id: "openhands",
    displayName: "OpenHands",
    support: "manual",
    managed: false,
    rootDir: path.join(home, ".openhands"),
    instructionFile: path.join(home, ".openhands", "AGENTS.md"),
    note: "OpenHands is usually project/container configured. Use custom paths for your local setup.",
  },
  {
    id: "zed-ai",
    displayName: "Zed AI",
    support: "manual",
    managed: false,
    rootDir: zedUserDir(),
    instructionFile: path.join(zedUserDir(), "AGENTS.md"),
    note: "Catalog only. Zed and extension settings vary across platforms.",
  },
];

export function listAgentCatalog(): AgentCatalogEntry[] {
  const builtIn = ALL_AGENTS.map((id): AgentCatalogEntry => {
    const caps = AGENT_PATHS[id];
    return {
      id,
      displayName: AGENT_DISPLAY_NAMES[id],
      support: "full",
      managed: true,
      installed: isAgentInstalled(id),
      rootDir: AGENT_ROOTS[id],
      mcpPath: caps.mcpPath,
      skillsDir: caps.skillsDir,
      note: "Built-in adapter. Plexus can sync Rules, MCP servers, and Skills.",
    };
  });

  const manual = MANUAL_PRESETS.map((entry) => ({
    ...entry,
    installed: exists(entry.mcpPath) || exists(entry.instructionFile),
  }));

  return [...builtIn, ...manual];
}
