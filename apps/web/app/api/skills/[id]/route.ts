import { NextResponse } from "next/server";
import { ALL_AGENTS, deleteSkill, readSkills, writeSkill } from "plexus-agent-config-core";
import type { AgentId, ConfigLayer } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

function layerFromQuery(req: Request): ConfigLayer {
  const url = new URL(req.url);
  const l = url.searchParams.get("layer");
  return l === "team" ? "team" : "personal";
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const layer = layerFromQuery(req);
    if (layer === "team") {
      return NextResponse.json({ error: "team-layer skills are read-only here" }, { status: 403 });
    }
    const skills = await readSkills(layer);
    const skill = skills.find((s) => s.id === id);
    if (!skill) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const body = (await req.json()) as {
      enabledAgents?: string[];
      name?: string;
      description?: string;
      body?: string;
    };
    const next = {
      ...skill,
      ...(body.name ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(body.enabledAgents
        ? {
            enabledAgents: body.enabledAgents.filter((a): a is AgentId =>
              ALL_AGENTS.includes(a as AgentId),
            ),
          }
        : {}),
    };
    await writeSkill(next);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const layer = layerFromQuery(req);
    if (layer === "team") {
      return NextResponse.json(
        { error: "team-layer skills cannot be deleted here" },
        { status: 403 },
      );
    }
    await deleteSkill("personal", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
