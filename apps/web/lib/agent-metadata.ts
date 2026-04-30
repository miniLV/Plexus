export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  "gemini-cli": "Gemini CLI",
  "qwen-code": "Qwen Code",
  "factory-droid": "Factory Droid",
};

export const AGENT_SHORT_NAMES: Record<string, string> = {
  "claude-code": "Claude",
  cursor: "Cursor",
  codex: "Codex",
  "gemini-cli": "Gemini",
  "qwen-code": "Qwen",
  "factory-droid": "Droid",
};

export function agentDisplayName(agentId: string): string {
  return AGENT_DISPLAY_NAMES[agentId] ?? agentId;
}

export function agentShortName(agentId: string): string {
  return AGENT_SHORT_NAMES[agentId] ?? agentDisplayName(agentId);
}
