import { inspectAgent } from "@plexus/core";
import type { AgentId } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID: AgentId[] = ["claude-code", "cursor", "codex", "factory-droid"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(VALID as string[]).includes(id)) {
    return NextResponse.json({ ok: false, message: "unknown agent" }, { status: 404 });
  }
  const data = await inspectAgent(id as AgentId);
  return NextResponse.json(data);
}
