import { NextResponse } from "next/server";
import { ALL_AGENTS, type AgentId, toggleMcpAgent } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

const VALID = new Set<string>(ALL_AGENTS);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { agent?: string; enabled?: boolean };
    if (!body.agent || !VALID.has(body.agent)) {
      return NextResponse.json({ ok: false, message: "agent invalid" }, { status: 400 });
    }
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ ok: false, message: "enabled required" }, { status: 400 });
    }
    const result = await toggleMcpAgent({
      id,
      agent: body.agent as AgentId,
      enabled: body.enabled,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 });
  }
}
