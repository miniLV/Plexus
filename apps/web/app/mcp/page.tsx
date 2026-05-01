import { McpEditor } from "@/components/mcp-editor";
import { getServerLocale } from "@/lib/i18n-server";
import {
  AGENT_DISPLAY_NAMES,
  ALL_AGENTS,
  detectAgents,
  getEffectiveMcp,
} from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "MCP Servers",
    description:
      "Every unique MCP across your installed agents and the Plexus store. Toggle a checkbox to add or remove an MCP from an agent — Plexus handles the writes and snapshots first.",
  },
  zh: {
    title: "MCP 服务",
    description:
      "这里汇总已安装 Agent 和 Plexus store 里的所有 MCP。勾选即可把某个 MCP 加到 Agent 或从 Agent 移除；Plexus 会先做快照，再处理写入。",
  },
};

export default async function McpPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];
  const rows = await getEffectiveMcp();
  const detected = detectAgents();
  const installed = Object.fromEntries(detected.map((d) => [d.id, d.installed])) as Record<
    string,
    boolean
  >;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">{copy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
      </header>
      <McpEditor
        initial={rows}
        agents={[...ALL_AGENTS]}
        displayNames={AGENT_DISPLAY_NAMES}
        installed={installed}
      />
    </div>
  );
}
