import { NextResponse } from "next/server";
import { searchMarketSkills } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

function intParam(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query") ?? undefined;
    const page = intParam(url.searchParams.get("page"));
    const perPage = intParam(url.searchParams.get("perPage"));

    const result = await searchMarketSkills({ query, page, perPage });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
