import { collectDebugSnapshot, formatDebugSnapshot } from "@plexus/core";
import { NextResponse } from "next/server";
import pkg from "../../../package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await collectDebugSnapshot();
  const text = formatDebugSnapshot(snapshot, pkg.version);
  return NextResponse.json({ text, snapshot });
}
