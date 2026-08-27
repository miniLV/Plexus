import { NextResponse } from "next/server";
import { installMarketSkill } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { repo?: string };
    if (!body.repo || typeof body.repo !== "string") {
      return NextResponse.json({ error: "repo (owner/repo) is required" }, { status: 400 });
    }
    const result = await installMarketSkill(body.repo);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
