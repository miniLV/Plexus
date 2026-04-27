import { inspectAgent } from "@plexus/core";
import type { AgentId } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID: AgentId[] = ["claude-code", "cursor", "codex", "factory-droid"];

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(VALID as string[]).includes(params.id)) {
    return NextResponse.json({ ok: false, message: "unknown agent" }, { status: 404 });
  }
  const data = await inspectAgent(params.id as AgentId);
  return NextResponse.json(data);
}
