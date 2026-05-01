import { NextResponse } from "next/server";
import { getEffectiveMcp } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ rows: await getEffectiveMcp() });
}
