import { NextResponse } from "next/server";
import { searchMarketSkills } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") ?? undefined;
    const query = url.searchParams.get("query") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const skills = await searchMarketSkills({ topic, query, limit });
    return NextResponse.json({ skills });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
