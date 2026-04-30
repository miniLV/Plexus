import { ALL_AGENTS, type AgentId, previewShareAll, runShareAll } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AGENTS = new Set<string>(ALL_AGENTS);

function normalizeAgent(input?: string | null): AgentId | undefined {
  return AGENTS.has(input ?? "") ? (input as AgentId) : undefined;
}

export async function GET(req: Request) {
  try {
    const preferredAgent = normalizeAgent(new URL(req.url).searchParams.get("preferredAgent"));
    const plan = await previewShareAll({ preferredAgent });
    return NextResponse.json(plan);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { preferredAgent?: string };
    const preferredAgent = normalizeAgent(body.preferredAgent);
    const report = await runShareAll({ preferredAgent });
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
