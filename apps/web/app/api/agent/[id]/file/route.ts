import os from "node:os";
import path from "node:path";
import { readTextFile, snapshotSingleFile, writeTextFile } from "@plexus/core";
import type { AgentId } from "@plexus/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID: AgentId[] = ["claude-code", "cursor", "codex", "factory-droid"];
const HOME = os.homedir();

/**
 * Whitelist: only files under the user's home directory and only inside the
 * known agent roots can be read/written via this route. Symlink targets are
 * NOT auto-followed for safety.
 */
function safeResolve(absPath: string): string | null {
  const norm = path.resolve(absPath);
  if (!norm.startsWith(HOME)) return null;
  // Block obvious sensitive paths.
  if (norm.startsWith(path.join(HOME, ".ssh"))) return null;
  if (norm.startsWith(path.join(HOME, ".aws"))) return null;
  return norm;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(VALID as string[]).includes(id)) {
    return NextResponse.json({ ok: false, message: "unknown agent" }, { status: 404 });
  }
  const url = new URL(req.url);
  const filePath = url.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ ok: false, message: "missing ?path" }, { status: 400 });
  }
  const resolved = safeResolve(filePath);
  if (!resolved) {
    return NextResponse.json({ ok: false, message: "path not allowed" }, { status: 403 });
  }
  try {
    const content = await readTextFile(resolved);
    return NextResponse.json({ ok: true, path: resolved, content });
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(VALID as string[]).includes(id)) {
    return NextResponse.json({ ok: false, message: "unknown agent" }, { status: 404 });
  }
  try {
    const body = (await req.json()) as { path?: string; content?: string };
    if (!body.path || typeof body.content !== "string") {
      return NextResponse.json(
        { ok: false, message: "path and content required" },
        { status: 400 },
      );
    }
    const resolved = safeResolve(body.path);
    if (!resolved) {
      return NextResponse.json({ ok: false, message: "path not allowed" }, { status: 403 });
    }
    // Snapshot the exact file being edited so we always have a one-step undo.
    const backup = await snapshotSingleFile(
      resolved,
      `edit ${id}: ${path.basename(resolved)}`,
    ).catch(() => null);
    await writeTextFile(resolved, body.content);
    return NextResponse.json({ ok: true, backup });
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 });
  }
}
