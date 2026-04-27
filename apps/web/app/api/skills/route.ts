import { ALL_AGENTS, readAllSkills, writeSkill } from "@plexus/core";
import type { AgentId, SkillDef } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const skills = await readAllSkills();
  const lite = skills.map(({ body: _b, frontmatter: _fm, ...rest }) => rest);
  return NextResponse.json({ skills: lite });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<SkillDef> & {
      id: string;
      name: string;
      body?: string;
    };
    if (!body.id || !body.name) {
      return NextResponse.json({ error: "id and name required" }, { status: 400 });
    }
    const skill: SkillDef = {
      id: body.id,
      name: body.name,
      description: body.description,
      body: body.body ?? "",
      layer: "personal",
      enabledAgents:
        body.enabledAgents && body.enabledAgents.length > 0
          ? body.enabledAgents.filter((a): a is AgentId => ALL_AGENTS.includes(a as AgentId))
          : [...ALL_AGENTS],
    };
    await writeSkill(skill);
    return NextResponse.json({ ok: true, id: skill.id });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
