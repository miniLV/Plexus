import { removeCustomAgent } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const removed = await removeCustomAgent(params.id);
    if (!removed) {
      return NextResponse.json(
        { ok: false, error: `No custom agent with id '${params.id}'` },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
