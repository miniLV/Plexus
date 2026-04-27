import { existsSync } from "node:fs";
import {
  AGENT_DISPLAY_NAMES,
  AGENT_PATHS,
  AGENT_ROOTS,
  ALL_AGENTS,
} from "../store/paths.js";
import type { AgentDescriptor } from "../types.js";

/**
 * Detect which AI agents appear to be installed.
 *
 * Heuristic: the agent's root config directory exists.
 * (We do NOT execute any binaries here.)
 */
export function detectAgents(): AgentDescriptor[] {
  return ALL_AGENTS.map((id) => ({
    id,
    displayName: AGENT_DISPLAY_NAMES[id],
    rootDir: AGENT_ROOTS[id],
    installed: existsSync(AGENT_ROOTS[id]),
    capabilities: AGENT_PATHS[id],
  }));
}
