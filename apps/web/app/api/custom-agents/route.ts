import { NextResponse } from "next/server";
import { addCustomAgent, listCustomAgents } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ agents: await listCustomAgents() });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      id: string;
      displayName: string;
      instructionFile: string;
      note?: string;
    };
    const created = await addCustomAgent(body);
    return NextResponse.json({ ok: true, agent: created });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
