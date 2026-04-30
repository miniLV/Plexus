import { TeamPanel } from "@/components/team-panel";
import { getServerLocale } from "@/lib/i18n-server";
import { teamStatus } from "@plexus/core";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Team",
    description:
      "Subscribe to a shared team config repo. Members pull updates with one click; everyone publishes new skills and MCPs through pull requests. The full team workflow is still in beta.",
  },
  zh: {
    title: "团队",
    description:
      "订阅一个共享的团队配置仓库。成员可以一键拉取更新，新的 Skills 和 MCP 通过 PR 发布。完整团队工作流仍处于 beta。",
  },
};

export default async function TeamPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];
  const status = await teamStatus();
  return (
    <div className="space-y-8">
      <header>
        <div className="mb-2 flex items-center gap-3">
          <h1 className="plexus-display">{copy.title}</h1>
          <span className="inline-flex h-6 items-center rounded-sm border border-plexus-accent/30 bg-plexus-accent/12 px-2 text-[11px] font-medium text-plexus-accent">
            beta
          </span>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
      </header>
      <TeamPanel status={status} />
    </div>
  );
}
