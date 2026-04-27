import { applySpread, previewSpread } from "@plexus/core";
import type { AgentId } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID: AgentId[] = ["claude-code", "cursor", "codex", "factory-droid"];

function isAgentId(v: unknown): v is AgentId {
  return typeof v === "string" && (VALID as string[]).includes(v);
}

/** GET /api/spread?from=cursor&to=claude-code → preview */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!isAgentId(from) || !isAgentId(to)) {
      return NextResponse.json({ error: "from/to must be a known agent id" }, { status: 400 });
    }
    return NextResponse.json(await previewSpread(from, to));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/spread
 * Body: { from, to, mcpIds?: string[], skillIds?: string[] }
 * If mcpIds / skillIds omitted, copies all.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      from?: string;
      to?: string;
      mcpIds?: string[];
      skillIds?: string[];
    };
    if (!isAgentId(body.from) || !isAgentId(body.to)) {
      return NextResponse.json({ error: "from/to must be a known agent id" }, { status: 400 });
    }
    const result = await applySpread({
      from: body.from,
      to: body.to,
      mcpIds: body.mcpIds,
      skillIds: body.skillIds,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
