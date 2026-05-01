import { NextResponse } from "next/server";
import { getEffectiveSkills } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ rows: await getEffectiveSkills() });
}
