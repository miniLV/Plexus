export type RulesAgentStatus = {
  agentId: string;
  displayName?: string;
  targetPath: string;
  status:
    | "linked"
    | "copied"
    | "in sync"
    | "drift"
    | "missing"
    | "disabled"
    | "not installed"
    | string;
  installed?: boolean;
  enabled?: boolean;
  lastAppliedAt?: string;
};

export type RulesPanelStatus = {
  content: string;
  canonicalPath: string;
  agents: RulesAgentStatus[];
  updatedAt?: string;
  unavailableReason?: string;
};

const DEFAULT_RULES_PATH = "~/.config/plexus/personal/rules/global.md";
const AGENT_LABELS: Record<string, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  "gemini-cli": "Gemini CLI",
  "qwen-code": "Qwen Code",
  "factory-droid": "Factory Droid",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function boolValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function statusFromCoreAgent(agent: Record<string, unknown>): RulesAgentStatus {
  const exists = boolValue(agent.exists) ?? false;
  const inSync = boolValue(agent.inSync) ?? false;
  const isSymlink = boolValue(agent.isSymlink) ?? false;
  const agentId = stringValue(agent.agent) ?? stringValue(agent.agentId) ?? "unknown";
  const installed = boolValue(agent.installed) ?? true;
  const enabled = boolValue(agent.enabled) ?? true;

  let status: RulesAgentStatus["status"] = "missing";
  if (!installed) {
    status = "not installed";
  } else if (!enabled) {
    status = "disabled";
  } else if (exists && inSync) {
    status = isSymlink ? "linked" : "in sync";
  } else if (exists) {
    status = "drift";
  }

  return {
    agentId,
    displayName: stringValue(agent.displayName) ?? AGENT_LABELS[agentId],
    targetPath: stringValue(agent.targetPath) ?? "",
    status,
    installed,
    enabled,
    lastAppliedAt: stringValue(agent.lastAppliedAt),
  };
}

function normalizeAgent(value: unknown): RulesAgentStatus | null {
  if (!isRecord(value)) return null;

  if ("exists" in value || "inSync" in value || "agent" in value) {
    return statusFromCoreAgent(value);
  }

  return {
    agentId: stringValue(value.agentId) ?? "unknown",
    displayName:
      stringValue(value.displayName) ?? AGENT_LABELS[stringValue(value.agentId) ?? "unknown"],
    targetPath: stringValue(value.targetPath) ?? "",
    status: stringValue(value.status) ?? "missing",
    installed: boolValue(value.installed),
    enabled: boolValue(value.enabled),
    lastAppliedAt: stringValue(value.lastAppliedAt),
  };
}

export function normalizeRulesStatus(value: unknown): RulesPanelStatus {
  if (!isRecord(value)) {
    return {
      content: "",
      canonicalPath: DEFAULT_RULES_PATH,
      agents: [],
      unavailableReason: "Rules status response was empty.",
    };
  }

  if (isRecord(value.status)) return normalizeRulesStatus(value.status);

  const canonical = isRecord(value.canonical) ? value.canonical : undefined;
  const agents = Array.isArray(value.agents)
    ? value.agents.map(normalizeAgent).filter((agent): agent is RulesAgentStatus => agent !== null)
    : [];

  return {
    content: stringValue(value.content) ?? stringValue(canonical?.content) ?? "",
    canonicalPath:
      stringValue(value.canonicalPath) ?? stringValue(canonical?.path) ?? DEFAULT_RULES_PATH,
    agents,
    updatedAt: stringValue(value.updatedAt) ?? stringValue(canonical?.updatedAt),
    unavailableReason: stringValue(value.unavailableReason),
  };
}
