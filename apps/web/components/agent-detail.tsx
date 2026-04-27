"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, FileText, Loader2, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type FileStatus = {
  path: string;
  exists: boolean;
  isSymlink: boolean;
  linkTarget?: string;
  size?: number;
  mtime?: string;
};

type SkillEntry = {
  id: string;
  path: string;
  isSymlink: boolean;
  linkTarget?: string;
  hasSkillMd: boolean;
};

type InstructionFile = {
  label: string;
  filename: string;
  status: FileStatus;
};

type AgentInspection = {
  id: string;
  displayName: string;
  rootDir: string;
  installed: boolean;
  mcpFile: FileStatus;
  mcpFileMode: "exclusive" | "shared";
  skillsDir: FileStatus;
  skills: SkillEntry[];
  instructionFiles: InstructionFile[];
};

function fmtSize(n?: number) {
  if (n == null) return "—";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function fmtMtime(t?: string) {
  if (!t) return "—";
  return new Date(t).toLocaleString();
}

function truncMid(p: string, max = 60): string {
  if (p.length <= max) return p;
  const left = Math.floor(max / 2 - 2);
  const right = Math.floor(max / 2 - 2);
  return `${p.slice(0, left)}…${p.slice(p.length - right)}`;
}

export function AgentDetail({ data }: { data: AgentInspection }) {
  return (
    <div className="space-y-8">
      {/* MCP file ───────────────────────── */}
      <section className="space-y-3">
        <h2 className="plexus-eyebrow">MCP File</h2>
        <Card className="p-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <code className="font-mono text-plexus-text">{data.mcpFile.path}</code>
            <Badge
              variant={data.mcpFileMode === "exclusive" ? "synced" : "divergent"}
              title={
                data.mcpFileMode === "exclusive"
                  ? "Plexus owns this file end-to-end via a symlink to the canonical cache."
                  : "This file holds many unrelated keys (auth, history, profile…). Plexus only rewrites its own section."
              }
            >
              mode: {data.mcpFileMode}
            </Badge>
            {data.mcpFile.exists ? (
              data.mcpFile.isSymlink ? (
                <Badge variant="synced">symlink</Badge>
              ) : (
                <Badge variant="native">regular file</Badge>
              )
            ) : (
              <Badge variant="native">missing</Badge>
            )}
          </div>
          {data.mcpFile.isSymlink && data.mcpFile.linkTarget && (
            <div className="mt-2 text-xs text-plexus-text-3">
              <span className="text-plexus-text">→</span>{" "}
              <code className="font-mono">{data.mcpFile.linkTarget}</code>
            </div>
          )}
          <div className="mt-3 flex gap-4 text-xs text-plexus-text-3">
            <span>size: {fmtSize(data.mcpFile.size)}</span>
            <span>mtime: {fmtMtime(data.mcpFile.mtime)}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/mcp">
                Edit MCP servers <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Link>
            </Button>
            {data.mcpFile.exists && (
              <FileViewerButton agentId={data.id} filePath={data.mcpFile.path} readOnly />
            )}
          </div>
        </Card>
      </section>

      {/* Instruction files ─────────────── */}
      <section className="space-y-3">
        <h2 className="plexus-eyebrow">Instruction Files</h2>
        {data.instructionFiles.length === 0 && (
          <div className="text-sm text-plexus-text-3">
            No conventional instruction file for {data.displayName}.
          </div>
        )}
        {data.instructionFiles.map((f) => (
          <Card key={f.status.path} className="p-4 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-plexus-text">{f.label}</span>
              <code className="font-mono text-xs text-plexus-text-3">{f.status.path}</code>
              {f.status.exists ? (
                <Badge variant="synced">exists</Badge>
              ) : (
                <Badge variant="native">not yet created</Badge>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <FileViewerButton
                agentId={data.id}
                filePath={f.status.path}
                allowCreate={!f.status.exists}
              />
            </div>
          </Card>
        ))}
      </section>

      {/* Skills ────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="plexus-eyebrow">Skills ({data.skills.length})</h2>
          <Link
            href="/skills"
            className="inline-flex items-center gap-1 text-xs text-plexus-accent hover:underline"
          >
            Manage in Skills page <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
          </Link>
        </div>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-plexus-border px-4 py-3 text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
            <div>ID</div>
            <div className="text-right">Owner</div>
            <div className="text-right">Action</div>
          </div>
          {data.skills.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-plexus-text-3">
              No skills installed for this agent.
            </div>
          )}
          {data.skills.slice(0, 50).map((s) => (
            <div
              key={s.path}
              className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-plexus-border/60 px-4 py-2.5 text-sm last:border-0 hover:bg-plexus-surface-2/40"
            >
              <div>
                <div className="font-mono text-[13px] text-plexus-text">{s.id}</div>
                {s.isSymlink && s.linkTarget && (
                  <div className="mt-0.5 text-[10px] text-plexus-text-3">
                    → {truncMid(s.linkTarget, 80)}
                  </div>
                )}
              </div>
              <div className="text-right">
                {s.isSymlink ? (
                  <Badge variant="synced">Plexus-owned</Badge>
                ) : (
                  <Badge variant="divergent">agent-local</Badge>
                )}
              </div>
              <div className="text-right">
                {s.hasSkillMd && (
                  <FileViewerButton
                    agentId={data.id}
                    filePath={`${s.path}/SKILL.md`}
                    label="View"
                  />
                )}
              </div>
            </div>
          ))}
          {data.skills.length > 50 && (
            <div className="border-t border-plexus-border/60 px-4 py-2 text-center text-xs text-plexus-text-3">
              … and {data.skills.length - 50} more (manage on the Skills page)
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function FileViewerButton({
  agentId,
  filePath,
  label,
  readOnly,
  allowCreate,
}: {
  agentId: string;
  filePath: string;
  label?: string;
  readOnly?: boolean;
  allowCreate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    if (allowCreate) {
      setContent("");
      setLoaded(true);
      return;
    }
    fetch(`/api/agent/${agentId}/file?path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setMsg(`Read failed: ${d.message}`);
        else setContent(d.content);
        setLoaded(true);
      });
  }, [open, agentId, filePath, loaded, allowCreate]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/agent/${agentId}/file`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: filePath, content }),
      });
      const data = await res.json();
      if (!data.ok) setMsg(`Save failed: ${data.message}`);
      else {
        setMsg(data.backup ? `Saved. Backup: ${data.backup}` : "Saved.");
        setTimeout(() => setOpen(false), 600);
      }
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = label ?? (readOnly ? "View" : "View / Edit");

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {readOnly ? (
          <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
        ) : (
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
        )}
        {buttonLabel}
      </Button>
      {open && (
        <button
          type="button"
          aria-label="Close file viewer"
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[80vh] w-[80vw] max-w-5xl cursor-default flex-col overflow-hidden rounded-md border border-plexus-border bg-plexus-surface text-left shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-plexus-border px-5 py-3">
              <code className="font-mono text-xs text-plexus-text-3">{filePath}</code>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-plexus-text-3 hover:text-plexus-text"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            {msg && (
              <div className="border-b border-plexus-border bg-plexus-surface-2 px-5 py-2 text-xs text-plexus-text-2">
                {msg}
              </div>
            )}
            <textarea
              className="flex-1 resize-none bg-plexus-bg p-4 font-mono text-xs text-plexus-text outline-none"
              value={content}
              readOnly={readOnly}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2 border-t border-plexus-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
              {!readOnly && (
                <Button variant="primary" size="sm" onClick={save} disabled={busy}>
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />}
                  {busy ? "Saving…" : "Save (auto-backup)"}
                </Button>
              )}
            </div>
          </div>
        </button>
      )}
    </>
  );
}
