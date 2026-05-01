import { NextResponse } from "next/server";
import { ALL_AGENTS, type AgentId, inspectAgent } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

const VALID = new Set<string>(ALL_AGENTS);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!VALID.has(id)) {
    return NextResponse.json({ ok: false, message: "unknown agent" }, { status: 404 });
  }
  const data = await inspectAgent(id as AgentId);
  return NextResponse.json(data);
}
