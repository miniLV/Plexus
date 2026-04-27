import { readAllMCP, writeMCP } from "@plexus/core";
import type { MCPServerDef } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ servers: await readAllMCP() });
}

/**
 * Replace ALL personal-layer servers with the provided list.
 * Team-layer servers are read-only via this endpoint and are filtered out.
 */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { servers: MCPServerDef[] };
    if (!Array.isArray(body.servers)) {
      return NextResponse.json({ error: "servers must be array" }, { status: 400 });
    }
    const personal = body.servers.filter((s) => s.layer === "personal");
    await writeMCP("personal", personal);
    return NextResponse.json({ ok: true, count: personal.length });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
