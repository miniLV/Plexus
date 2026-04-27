import { ALL_AGENTS, AGENT_DISPLAY_NAMES, detectAgents } from "@plexus/core";
import { SpreadPanel } from "@/components/spread-panel";

export const dynamic = "force-dynamic";

export default async function SpreadPage() {
  const detected = detectAgents();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Spread</h1>
        <p className="text-sm text-plexus-mute">
          Copy MCP servers and skills from one agent to another. Plexus computes the
          diff (items in the source but missing from the target) and copies only what's
          missing — both the agent's native config and its Plexus store entries are taken
          into account.
        </p>
      </div>
      <SpreadPanel
        agents={[...ALL_AGENTS]}
        displayNames={AGENT_DISPLAY_NAMES}
        installed={Object.fromEntries(detected.map((d) => [d.id, d.installed])) as Record<string, boolean>}
      />
    </div>
  );
}
