import type { AgentId } from "../../types.js";
import type { AgentAdapter } from "./base.js";
import { codexAdapter } from "./codex.js";
import { makeJsonMcpAdapter } from "./json-mcp.js";

export const adapters: Record<AgentId, AgentAdapter> = {
  "claude-code": makeJsonMcpAdapter("claude-code"),
  cursor: makeJsonMcpAdapter("cursor"),
  codex: codexAdapter,
  "factory-droid": makeJsonMcpAdapter("factory-droid"),
};

export { codexAdapter, makeJsonMcpAdapter };
export type { AgentAdapter, ApplyContext } from "./base.js";
