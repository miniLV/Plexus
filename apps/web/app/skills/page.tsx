import { SkillsEditor } from "@/components/skills-editor";
import { AGENT_DISPLAY_NAMES, ALL_AGENTS, detectAgents, getEffectiveSkills } from "@plexus/core";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const rows = await getEffectiveSkills();
  const detected = detectAgents();
  const installed = Object.fromEntries(detected.map((d) => [d.id, d.installed])) as Record<
    string,
    boolean
  >;
  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">Skills</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">
          Every unique skill across your installed agents and the Plexus store. Toggle a checkbox to
          add or remove a skill from an agent — Plexus snapshots and symlinks for you.
        </p>
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
