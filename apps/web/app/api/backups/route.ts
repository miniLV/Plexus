import { NextResponse } from "next/server";
import { listBackups } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await listBackups();
  return NextResponse.json({ snapshots: all });
}
