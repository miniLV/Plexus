import { SkillsEditor } from "@/components/skills-editor";
import { getServerLocale } from "@/lib/i18n-server";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS, detectAgents, getEffectiveSkills } from "@plexus/core";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Skills",
    description:
      "Every unique skill across your installed agents and the Plexus store. Toggle a checkbox to add or remove a skill from an agent — Plexus snapshots and symlinks for you.",
  },
  zh: {
    title: "技能",
    description:
      "这里汇总已安装 Agent 和 Plexus store 里的所有 Skill。勾选即可把 Skill 加到 Agent 或从 Agent 移除；Plexus 会负责快照和软链接。",
  },
};

export default async function SkillsPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];
  const rows = await getEffectiveSkills();
  const detected = detectAgents();
  const installed = Object.fromEntries(detected.map((d) => [d.id, d.installed])) as Record<
    string,
    boolean
  >;
  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">{copy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
      </header>
      <SkillsEditor
        initial={rows}
        agents={[...ALL_AGENTS]}
        displayNames={AGENT_DISPLAY_NAMES}
        installed={installed}
      />
    </div>
  );
}
