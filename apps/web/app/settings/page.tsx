import { CustomAgentsPanel } from "@/components/custom-agents-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerLocale } from "@/lib/i18n-server";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS, readConfig } from "@plexus/core";
import { ArrowRight, Network } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Settings",
    description:
      "Plexus is local-only. Nothing leaves this machine — no telemetry, no remote logging. Configure which agents take part in sync and how Plexus mirrors files.",
    architectureTitle: "How sharing works",
    architecture:
      "Open the clickable architecture map for rules, skills, MCP files, backups, and the hybrid sync strategy.",
    openArchitecture: "View design",
  },
  zh: {
    title: "设置",
    description:
      "Plexus 只在本机运行，不发送遥测，也没有远程日志。你可以在这里配置哪些 Agent 参与同步，以及 Plexus 如何镜像文件。",
    architectureTitle: "同步机制是怎么工作的",
    architecture:
      "打开可点击的架构图，查看 Rules、Skills、MCP、备份和 hybrid sync strategy 的具体设计。",
    openArchitecture: "查看设计图",
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
      <Card className="flex flex-col gap-4 border-l-[3px] border-l-plexus-accent px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Network className="mt-0.5 h-4 w-4 shrink-0 text-plexus-accent" strokeWidth={1.5} />
          <div>
            <div className="text-sm font-semibold text-plexus-text">{copy.architectureTitle}</div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-plexus-text-2">
              {copy.architecture}
            </p>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm" className="shrink-0">
          <Link href="/about">
            {copy.openArchitecture}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
        </Button>
      </Card>
      <SettingsPanel config={config} agents={[...ALL_AGENTS]} displayNames={AGENT_DISPLAY_NAMES} />
      <CustomAgentsPanel />
    </div>
  );
}
