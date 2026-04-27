import {
  ALL_AGENTS,
  AGENT_DISPLAY_NAMES,
  detectAgents,
  getEffectiveMcp,
} from "@plexus/core";
import { McpEditor } from "@/components/mcp-editor";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const rows = await getEffectiveMcp();
  const detected = detectAgents();
  const installed = Object.fromEntries(
    detected.map((d) => [d.id, d.installed]),
  ) as Record<string, boolean>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">MCP Servers</h1>
        <p className="text-sm text-plexus-mute">
          Every unique MCP across your installed agents and the Plexus store.
          Toggle a checkbox to add or remove that MCP from an agent — Plexus
          handles the writes.
        </p>
      </div>
      <McpEditor
        initial={rows}
        agents={[...ALL_AGENTS]}
        displayNames={AGENT_DISPLAY_NAMES}
        installed={installed}
      />
    </div>
  );
}
