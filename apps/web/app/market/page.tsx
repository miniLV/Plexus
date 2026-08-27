import { SkillsMarket } from "@/components/skills-market";
import { getServerLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Skills Market",
    description:
      "Community agent skills from GitHub, ranked by stars. Install one into your personal store with a click, and Plexus syncs it to your enabled agents.",
  },
  zh: {
    title: "技能市场",
    description:
      "来自 GitHub 社区的 Agent Skills，按星标排行。一键安装到 personal store，Plexus 会同步到已启用的 agent。",
  },
};

export default async function MarketPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">{copy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
      </header>
      <SkillsMarket />
    </div>
  );
}
