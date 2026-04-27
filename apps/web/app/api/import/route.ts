import { applyImport, previewImport } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET = preview (read-only, no writes). */
export async function GET() {
  try {
    const preview = await previewImport();
    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

/** POST = apply: write previewed items into the personal layer. */
export async function POST() {
  try {
    const result = await applyImport();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
