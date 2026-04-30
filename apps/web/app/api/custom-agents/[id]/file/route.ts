import { getCustomAgent, readTextFile, snapshotSingleFile, writeTextFile } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function getAgentOr404(id: string) {
  const agent = await getCustomAgent(id);
  if (!agent) {
    return {
      agent: null,
      response: NextResponse.json(
        { ok: false, message: `No custom agent with id '${id}'` },
        { status: 404 },
      ),
    };
  }
  return { agent, response: null };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agent, response } = await getAgentOr404(id);
  if (!agent) return response;
  try {
    const content = await readTextFile(agent.instructionFile);
    return NextResponse.json({ ok: true, path: agent.instructionFile, content, exists: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({
        ok: true,
        path: agent.instructionFile,
        content: "",
        exists: false,
      });
    }
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agent, response } = await getAgentOr404(id);
  if (!agent) return response;
  try {
    const body = (await req.json()) as { content?: string };
    if (typeof body.content !== "string") {
      return NextResponse.json({ ok: false, message: "content required" }, { status: 400 });
    }
    const backup = await snapshotSingleFile(
      agent.instructionFile,
      `edit custom agent ${id}: instruction file`,
    ).catch(() => null);
    await writeTextFile(agent.instructionFile, body.content);
    return NextResponse.json({ ok: true, path: agent.instructionFile, backup });
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 });
  }
}
