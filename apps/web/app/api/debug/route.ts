import { NextResponse } from "next/server";
import { collectDebugSnapshot, formatDebugSnapshot } from "plexus-agent-config-core";
import pkg from "../../../package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await collectDebugSnapshot();
  const text = formatDebugSnapshot(snapshot, pkg.version);
  return NextResponse.json({ text, snapshot });
}
