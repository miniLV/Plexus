import { CustomAgentsPanel } from "@/components/custom-agents-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { getServerLocale } from "@/lib/i18n-server";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS, readConfig } from "@plexus/core";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Settings",
    description:
      "Plexus is local-only. Nothing leaves this machine — no telemetry, no remote logging. Configure which agents take part in sync and how Plexus mirrors files.",
  },
  zh: {
    title: "设置",
    description:
      "Plexus 只在本机运行，不发送遥测，也没有远程日志。你可以在这里配置哪些 Agent 参与同步，以及 Plexus 如何镜像文件。",
  },
};

export default async function SettingsPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];
  const config = await readConfig();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">{copy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
      </header>
      <SettingsPanel config={config} agents={[...ALL_AGENTS]} displayNames={AGENT_DISPLAY_NAMES} />
      <CustomAgentsPanel />
    </div>
  );
}
