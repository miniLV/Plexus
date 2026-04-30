import * as core from "@plexus/core";
import type { AgentId } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RulesCore = typeof core & {
  getRulesStatus?: () => Promise<unknown> | unknown;
  writePersonalRules?: (content: string) => Promise<unknown> | unknown;
  applyRulesToAgents?: (agentIds?: AgentId[]) => Promise<unknown> | unknown;
  importRulesFromAgent?: (agentId: AgentId) => Promise<unknown> | unknown;
};

const rulesCore = core as RulesCore;
const AGENT_IDS = new Set<string>(core.ALL_AGENTS);

function missing(name: keyof RulesCore) {
  return NextResponse.json(
    { error: `${name} is not available in @plexus/core yet.` },
    { status: 501 },
  );
}

async function statusAfter(result?: unknown) {
  const status = rulesCore.getRulesStatus ? await rulesCore.getRulesStatus() : undefined;
  return NextResponse.json(result === undefined ? status : { ok: true, result, status });
}

function parseAgentId(value: unknown): AgentId | null {
  if (typeof value !== "string") return null;
  return AGENT_IDS.has(value) ? (value as AgentId) : null;
}

export async function GET() {
  try {
    if (!rulesCore.getRulesStatus) return missing("getRulesStatus");
    return NextResponse.json(await rulesCore.getRulesStatus());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!rulesCore.writePersonalRules) return missing("writePersonalRules");
    const body = (await req.json()) as { content?: unknown };
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "content must be a string" }, { status: 400 });
    }

    const result = await rulesCore.writePersonalRules(body.content);
    return statusAfter(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: unknown;
      agentId?: unknown;
      agentIds?: unknown;
    };

    if (body.action === "apply") {
      if (!rulesCore.applyRulesToAgents) return missing("applyRulesToAgents");
      const parsedAgentIds = Array.isArray(body.agentIds)
        ? body.agentIds.map(parseAgentId)
        : undefined;
      if (parsedAgentIds?.some((id) => id === null)) {
        return NextResponse.json(
          { error: "agentIds contains an unknown agent id" },
          { status: 400 },
        );
      }
      const agentIds = parsedAgentIds as AgentId[] | undefined;
      const result = await rulesCore.applyRulesToAgents(agentIds);
      return statusAfter(result);
    }

    if (body.action === "import") {
      if (!rulesCore.importRulesFromAgent) return missing("importRulesFromAgent");
      const agentId = parseAgentId(body.agentId);
      if (!agentId) {
        return NextResponse.json({ error: "agentId must be a known agent id" }, { status: 400 });
      }
      const result = await rulesCore.importRulesFromAgent(agentId);
      return statusAfter(result);
    }

    return NextResponse.json({ error: "action must be apply or import" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
