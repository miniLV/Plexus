import { NextResponse } from "next/server";
import { readConfig, writeConfig } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readConfig());
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    await writeConfig(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
