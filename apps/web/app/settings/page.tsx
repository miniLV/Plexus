import { CustomAgentsPanel } from "@/components/custom-agents-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS, readConfig } from "@plexus/core";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await readConfig();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">Settings</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">
          Plexus is local-only. Nothing leaves this machine — no telemetry, no remote logging.
          Configure which agents take part in sync and how Plexus mirrors files.
        </p>
      </header>
      <SettingsPanel config={config} agents={[...ALL_AGENTS]} displayNames={AGENT_DISPLAY_NAMES} />
      <CustomAgentsPanel />
    </div>
  );
}
