import { constants, accessSync, existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { AGENT_DISPLAY_NAMES, AGENT_PATHS, AGENT_ROOTS, ALL_AGENTS } from "../store/paths.js";
import type { AgentDescriptor, AgentId } from "../types.js";

/**
 * Detect which AI agents appear to be installed.
 *
 * Heuristic: any durable local signal exists:
 * - native config root / MCP file / skill directory
 * - known macOS app bundle for GUI-first agents
 * - known CLI shim on PATH
 *
 * We never execute the agent binary; PATH checks only inspect file metadata.
 */
export function detectAgents(): AgentDescriptor[] {
  return ALL_AGENTS.map((id) => ({
    id,
    displayName: AGENT_DISPLAY_NAMES[id],
    rootDir: AGENT_ROOTS[id],
    installed: isAgentInstalled(id),
    capabilities: AGENT_PATHS[id],
  }));
}

const home = os.homedir();

const APP_PATH_HINTS: Record<AgentId, string[]> = {
  "claude-code": [],
  cursor:
    process.platform === "darwin"
      ? ["/Applications/Cursor.app", path.join(home, "Applications", "Cursor.app")]
      : [],
  codex:
    process.platform === "darwin"
      ? ["/Applications/Codex.app", path.join(home, "Applications", "Codex.app")]
      : [],
  "gemini-cli": [],
  "qwen-code": [],
  "factory-droid": [],
};

const COMMAND_HINTS: Record<AgentId, string[]> = {
  "claude-code": ["claude"],
  cursor: ["cursor"],
  codex: ["codex"],
  "gemini-cli": ["gemini"],
  "qwen-code": ["qwen"],
  "factory-droid": ["factory-droid", "droid"],
};

function metadataPathHints(id: AgentId): string[] {
  const caps = AGENT_PATHS[id];
  return [AGENT_ROOTS[id], caps.mcpPath, caps.skillsDir];
}

function useConfigOnlyDetection(): boolean {
  return process.env.PLEXUS_DETECT_CONFIG_ONLY === "1";
}

export function isAgentInstalled(id: AgentId): boolean {
  if (useConfigOnlyDetection()) {
    return metadataPathHints(id).some((p) => existsSync(p));
  }

  if (APP_PATH_HINTS[id].some((p) => existsSync(p))) return true;
  return COMMAND_HINTS[id].some((cmd) => commandExistsOnPath(cmd));
}

function commandExistsOnPath(command: string): boolean {
  const pathValue = process.env.PATH;
  if (!pathValue) return false;

  const extensions =
    process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];

  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = path.join(dir, `${command}${ext}`);
      try {
        const stat = statSync(candidate);
        if (stat.isFile()) {
          return process.platform === "win32" || canExecute(candidate);
        }
      } catch {
        // keep scanning PATH
      }
    }
  }
  return false;
}

function canExecute(candidate: string): boolean {
  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
