import { NextResponse } from "next/server";
import {
  ALL_AGENTS,
  type AgentId,
  getEffectiveMcp,
  readMCP,
  removeMcpEverywhere,
  runSync,
  writeMCP,
} from "plexus-agent-config-core";
import type { MCPServerDef } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

const VALID_AGENTS = new Set<string>(ALL_AGENTS);

type FieldResult<T> = { ok: true; value: T } | { ok: false; message: string };

function validatePlainObject(value: unknown, label: string): Record<string, unknown> | string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return `${label} must be an object`;
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, label: string): FieldResult<string | undefined> {
  if (value == null || value === "") return { ok: true, value: undefined };
  if (typeof value !== "string") return { ok: false, message: `${label} must be a string` };
  return { ok: true, value: value.trim() ? value : undefined };
}

function stringRecord(
  value: unknown,
  label: string,
): FieldResult<Record<string, string> | undefined> {
  if (value == null) return { ok: true, value: undefined };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: `${label} must be an object with string values` };
  }
  const entries = Object.entries(value);
  const invalid = entries.find(([, child]) => typeof child !== "string");
  if (invalid) return { ok: false, message: `${label}.${invalid[0]} must be a string` };
  const record = Object.fromEntries(entries) as Record<string, string>;
  return { ok: true, value: entries.length > 0 ? record : undefined };
}

function stringArray(value: unknown, label: string): FieldResult<string[] | undefined> {
  if (value == null) return { ok: true, value: undefined };
  if (!Array.isArray(value)) return { ok: false, message: `${label} must be an array` };
  const invalid = value.find((child) => typeof child !== "string");
  if (invalid != null) return { ok: false, message: `${label} must contain only strings` };
  const next = value.map(String).filter(Boolean);
  return { ok: true, value: next.length > 0 ? next : undefined };
}

function agentArray(value: unknown, fallback: AgentId[]): FieldResult<AgentId[]> {
  if (value == null) return { ok: true, value: fallback };
  if (!Array.isArray(value)) return { ok: false, message: "enabledAgents must be an array" };
  const invalid = value.find((agent) => typeof agent !== "string" || !VALID_AGENTS.has(agent));
  if (invalid != null) {
    return { ok: false, message: `enabledAgents contains an unknown agent: ${String(invalid)}` };
  }
  const next = value.filter((agent): agent is AgentId => VALID_AGENTS.has(agent));
  return { ok: true, value: next.length > 0 ? Array.from(new Set(next)) : fallback };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { server?: unknown };
    const effective = await getEffectiveMcp();
    const row = effective.find((item) => item.id === id);
    if (!row) {
      return NextResponse.json({ ok: false, message: `MCP ${id} not found` }, { status: 404 });
    }
    if (row.authority === "team") {
      return NextResponse.json(
        { ok: false, message: "Team-layer MCPs are read-only here" },
        { status: 403 },
      );
    }

    const input = validatePlainObject(body.server, "server");
    if (typeof input === "string") {
      return NextResponse.json({ ok: false, message: input }, { status: 400 });
    }
    if (input.id != null && input.id !== id) {
      return NextResponse.json({ ok: false, message: "MCP id cannot be changed" }, { status: 400 });
    }

    const personal = await readMCP("personal");
    const existing = personal.find((server) => server.id === id);
    const enabledAgents = agentArray(
      input.enabledAgents,
      existing?.enabledAgents ?? row.enabledAgents ?? row.effectiveAgents,
    );
    const type = optionalString(input.type, "type");
    const args = stringArray(input.args, "args");
    const env = stringRecord(input.env, "env");
    const url = optionalString(input.url, "url");
    const httpUrl = optionalString(input.httpUrl, "httpUrl");
    const headers = stringRecord(input.headers, "headers");
    if (!enabledAgents.ok) {
      return NextResponse.json({ ok: false, message: enabledAgents.message }, { status: 400 });
    }
    if (!type.ok) {
      return NextResponse.json({ ok: false, message: type.message }, { status: 400 });
    }
    if (!args.ok) {
      return NextResponse.json({ ok: false, message: args.message }, { status: 400 });
    }
    if (!env.ok) {
      return NextResponse.json({ ok: false, message: env.message }, { status: 400 });
    }
    if (!url.ok) {
      return NextResponse.json({ ok: false, message: url.message }, { status: 400 });
    }
    if (!httpUrl.ok) {
      return NextResponse.json({ ok: false, message: httpUrl.message }, { status: 400 });
    }
    if (!headers.ok) {
      return NextResponse.json({ ok: false, message: headers.message }, { status: 400 });
    }
    if (input.command != null && typeof input.command !== "string") {
      return NextResponse.json({ ok: false, message: "command must be a string" }, { status: 400 });
    }
    const next: MCPServerDef = {
      id,
      type: type.value,
      command: typeof input.command === "string" ? input.command : "",
      args: args.value,
      env: env.value,
      url: url.value,
      httpUrl: httpUrl.value,
      headers: headers.value,
      layer: "personal",
      enabledAgents: enabledAgents.value,
    };
    if (!next.command.trim() && !next.url?.trim() && !next.httpUrl?.trim()) {
      return NextResponse.json(
        { ok: false, message: "MCP needs either command, url, or httpUrl" },
        { status: 400 },
      );
    }

    await writeMCP("personal", [...personal.filter((server) => server.id !== id), next]);
    const sync = await runSync();
    return NextResponse.json({ ok: true, sync });
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await removeMcpEverywhere(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 });
  }
}
