import type { AgentId } from "../../types.js";
import type { AgentAdapter } from "./base.js";
import { codexAdapter } from "./codex.js";
import { makeJsonMcpAdapter } from "./json-mcp.js";
import { opencodeAdapter } from "./opencode.js";

export const adapters: Record<AgentId, AgentAdapter> = {
  "claude-code": makeJsonMcpAdapter("claude-code"),
  cursor: makeJsonMcpAdapter("cursor"),
  codex: codexAdapter,
  "gemini-cli": makeJsonMcpAdapter("gemini-cli"),
  "qwen-code": makeJsonMcpAdapter("qwen-code"),
  "factory-droid": makeJsonMcpAdapter("factory-droid"),
  deepseek: makeJsonMcpAdapter("deepseek"),
  opencode: opencodeAdapter,
};

export { codexAdapter, makeJsonMcpAdapter, opencodeAdapter };
export type { AgentAdapter, ApplyContext } from "./base.js";
