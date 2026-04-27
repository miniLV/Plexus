import { restoreSnapshot } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const result = await restoreSnapshot(params.id);
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message },
      { status: 500 },
    );
  }
}
