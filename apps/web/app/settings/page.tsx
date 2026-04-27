import { SettingsPanel } from "@/components/settings-panel";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS, readConfig } from "@plexus/core";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await readConfig();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-plexus-mute">
          Plexus is local-only. Nothing leaves this machine.
        </p>
      </div>
      <SettingsPanel config={config} agents={[...ALL_AGENTS]} displayNames={AGENT_DISPLAY_NAMES} />
    </div>
  );
}
