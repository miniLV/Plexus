import { McpEditor } from "@/components/mcp-editor";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS, detectAgents, getEffectiveMcp } from "@plexus/core";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const rows = await getEffectiveMcp();
  const detected = detectAgents();
  const installed = Object.fromEntries(detected.map((d) => [d.id, d.installed])) as Record<
    string,
    boolean
  >;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">MCP Servers</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">
          Every unique MCP across your installed agents and the Plexus store. Toggle a checkbox to
          add or remove an MCP from an agent — Plexus handles the writes and snapshots first.
        </p>
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
