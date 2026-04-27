import { listBackups } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await listBackups();
  return NextResponse.json({ snapshots: all });
}
