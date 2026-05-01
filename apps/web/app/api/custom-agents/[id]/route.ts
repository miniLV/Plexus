import { NextResponse } from "next/server";
import { removeCustomAgent } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const removed = await removeCustomAgent(id);
    if (!removed) {
      return NextResponse.json(
        { ok: false, error: `No custom agent with id '${id}'` },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
