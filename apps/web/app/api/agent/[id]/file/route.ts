import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  AGENT_PATHS,
  ALL_AGENTS,
  type AgentId,
  instructionsForAgent,
  readTextFile,
  snapshotSingleFile,
  writeTextFile,
} from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

const VALID = new Set<string>(ALL_AGENTS);
const HOME = os.homedir();

function resolveUserPath(input: string): string {
  const expanded =
    input === "~" ? HOME : input.startsWith("~/") ? path.join(HOME, input.slice(2)) : input;
  return path.resolve(expanded);
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function readAllowedPath(agent: AgentId, filePath: string): string | null {
  const resolved = resolveUserPath(filePath);
  const instructionPaths = instructionsForAgent(agent).map((instruction) => instruction.abs);
  if (instructionPaths.some((instructionPath) => samePath(resolved, instructionPath))) {
    return resolved;
  }
  if (samePath(resolved, AGENT_PATHS[agent].mcpPath)) return resolved;
  if (path.basename(resolved) === "SKILL.md" && isInside(resolved, AGENT_PATHS[agent].skillsDir)) {
    return resolved;
  }
  return null;
}

function writeAllowedPath(agent: AgentId, filePath: string): string | null {
  const resolved = resolveUserPath(filePath);
  const instructionPaths = instructionsForAgent(agent).map((instruction) => instruction.abs);
  return instructionPaths.some((instructionPath) => samePath(resolved, instructionPath))
    ? resolved
    : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!VALID.has(id)) {
    return NextResponse.json({ ok: false, message: "unknown agent" }, { status: 404 });
  }
  const url = new URL(req.url);
  const filePath = url.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ ok: false, message: "missing ?path" }, { status: 400 });
  }
  const resolved = readAllowedPath(id as AgentId, filePath);
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
  if (!VALID.has(id)) {
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
    const resolved = writeAllowedPath(id as AgentId, body.path);
    if (!resolved) {
      return NextResponse.json({ ok: false, message: "path not allowed" }, { status: 403 });
    }
    // Snapshot the exact file being edited so we always have a one-step undo.
    let backup: string | null = null;
    try {
      await fs.lstat(resolved);
      backup = await snapshotSingleFile(resolved, `edit ${id}: ${path.basename(resolved)}`);
      if (!backup) {
        return NextResponse.json(
          { ok: false, message: "backup failed; file was not modified" },
          { status: 500 },
        );
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    await writeTextFile(resolved, body.content);
    return NextResponse.json({ ok: true, backup });
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 });
  }
}
