import { MirrorPanel } from "@/components/mirror-panel";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS, detectAgents } from "@plexus/core";

export const dynamic = "force-dynamic";

export default async function MirrorPage() {
  const detected = detectAgents();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mirror</h1>
        <p className="text-sm text-plexus-mute">
          Pick a source agent and the target agents that should mirror it. Plexus handles the
          writes: <span className="text-plexus-text">Cursor</span> and{" "}
          <span className="text-plexus-text">Factory Droid</span> get a single symlink to the
          canonical Plexus copy; <span className="text-plexus-text">Claude Code</span> and{" "}
          <span className="text-plexus-text">Codex</span> have their MCP section partial-written in
          place (other settings preserved). Skills are symlinked everywhere.
        </p>
      </div>
      <MirrorPanel
        agents={[...ALL_AGENTS]}
        displayNames={AGENT_DISPLAY_NAMES}
        installed={
          Object.fromEntries(detected.map((d) => [d.id, d.installed])) as Record<string, boolean>
        }
      />
    </div>
  );
}
