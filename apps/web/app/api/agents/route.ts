import { NextResponse } from "next/server";
import { detectAgents } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ agents: detectAgents() });
}
