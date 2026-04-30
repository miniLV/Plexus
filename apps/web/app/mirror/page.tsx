import { MirrorPanel } from "@/components/mirror-panel";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS, detectAgents } from "@plexus/core";

export const dynamic = "force-dynamic";

export default async function MirrorPage() {
  const detected = detectAgents();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">Mirror</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">
          Pick a source agent and the targets that should mirror it. Plexus handles the writes:{" "}
          <span className="text-plexus-text">Cursor</span> and{" "}
          <span className="text-plexus-text">Factory Droid</span> get a single symlink to the
          canonical Plexus copy; <span className="text-plexus-text">Claude Code</span> and{" "}
          <span className="text-plexus-text">Codex</span>, plus settings-based CLIs like{" "}
          <span className="text-plexus-text">Gemini CLI</span> and{" "}
          <span className="text-plexus-text">Qwen Code</span>, have their MCP section
          partial-written in place. Skills are symlinked everywhere.
        </p>
      </header>
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
