import { ArchitecturePanel } from "@/components/architecture-panel";
import { getServerLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "About",
    description:
      "A clickable technical design map for how Plexus shares rules, skills, and MCP servers across AI agents without hiding each agent's native files.",
  },
  zh: {
    title: "关于 Plexus",
    description:
      "这里是 Plexus 的可点击技术设计图：它解释 Rules、Skills、MCP 如何在多个 AI Agent 之间共享，同时保留每个 Agent 的原生文件。",
  },
};

export default async function AboutPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">{copy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
      </header>
      <ArchitecturePanel locale={locale} />
    </div>
  );
}
