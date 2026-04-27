import { joinTeam, pullTeam, teamStatus } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await teamStatus());
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: string; repoUrl?: string };
    if (body.action === "join") {
      if (!body.repoUrl) {
        return NextResponse.json({ ok: false, message: "repoUrl required" }, { status: 400 });
      }
      const r = await joinTeam(body.repoUrl);
      return NextResponse.json(r);
    }
    if (body.action === "pull") {
      const r = await pullTeam();
      return NextResponse.json(r);
    }
    return NextResponse.json({ ok: false, message: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 });
  }
}
