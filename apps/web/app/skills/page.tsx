import { ALL_AGENTS, readAllSkills } from "@plexus/core";
import { SkillsEditor } from "@/components/skills-editor";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const skills = await readAllSkills();
  // Send only metadata to the client; SKILL.md body fetched on demand if needed.
  const lite = skills.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    layer: s.layer,
    enabledAgents: s.enabledAgents,
  }));
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
        <p className="text-sm text-plexus-mute">
          Author once. Pick which agents see each skill.
        </p>
      </div>
      <SkillsEditor initial={lite} agents={[...ALL_AGENTS]} />
    </div>
  );
}
