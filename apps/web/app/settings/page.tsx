import { ALL_AGENTS, AGENT_DISPLAY_NAMES, readConfig } from "@plexus/core";
import { SettingsPanel } from "@/components/settings-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await readConfig();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-plexus-mute">Plexus is local-only. Nothing leaves this machine.</p>
      </div>
      <SettingsPanel
        config={config}
        agents={[...ALL_AGENTS]}
        displayNames={AGENT_DISPLAY_NAMES}
      />
    </div>
  );
}
