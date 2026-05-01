import { NextResponse } from "next/server";
import { restoreSnapshot } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await restoreSnapshot(id);
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 });
  }
}
