import { MirrorPanel } from "@/components/mirror-panel";
import { getServerLocale } from "@/lib/i18n-server";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS, detectAgents } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Mirror",
    description:
      "Pick a source agent and the targets that should mirror it. Plexus uses symlinks for dedicated MCP files, partial-writes shared config files, and symlinks Skills everywhere.",
  },
  zh: {
    title: "镜像同步",
    description:
      "选择一个来源 Agent，再选择要镜像到哪些目标。Plexus 会对专用 MCP 文件使用软链接，对共享配置文件做局部写入，并把 Skills 通过软链接同步到各 Agent。",
  },
};

export default async function MirrorPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];
  const detected = detectAgents();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">{copy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
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
