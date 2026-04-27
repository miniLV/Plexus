"use client";

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
  return `${p.slice(0, left)}...${p.slice(p.length - right)}`;
}

export function AgentDetail({ data }: { data: AgentInspection }) {
  return (
    <div className="space-y-8">
      {/* MCP file ───────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-plexus-mute">MCP File</h2>
        <div className="rounded border border-plexus-border bg-plexus-panel p-4 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <code className="font-mono text-plexus-text">{data.mcpFile.path}</code>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                data.mcpFileMode === "exclusive"
                  ? "bg-plexus-accent/15 text-plexus-accent"
                  : "bg-plexus-warn/15 text-plexus-warn"
              }`}
              title={
                data.mcpFileMode === "exclusive"
                  ? "Plexus owns this file end-to-end via a symlink to the canonical cache."
                  : "This file holds many unrelated keys (auth, history, profile...). Plexus only rewrites its own section."
              }
            >
              mode: {data.mcpFileMode}
            </span>
            {data.mcpFile.exists ? (
              data.mcpFile.isSymlink ? (
                <span className="rounded bg-plexus-ok/15 px-2 py-0.5 text-xs text-plexus-ok">
                  symlink
                </span>
              ) : (
                <span className="rounded bg-plexus-border px-2 py-0.5 text-xs text-plexus-mute">
                  regular file
                </span>
              )
            ) : (
              <span className="rounded bg-plexus-border px-2 py-0.5 text-xs text-plexus-mute">
                missing
              </span>
            )}
          </div>
          {data.mcpFile.isSymlink && data.mcpFile.linkTarget && (
            <div className="mt-2 text-xs text-plexus-mute">
              <span className="text-plexus-text">→</span>{" "}
              <code className="font-mono">{data.mcpFile.linkTarget}</code>
            </div>
          )}
          <div className="mt-3 flex gap-4 text-xs text-plexus-mute">
            <span>size: {fmtSize(data.mcpFile.size)}</span>
            <span>mtime: {fmtMtime(data.mcpFile.mtime)}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              href="/mcp"
              className="rounded border border-plexus-border px-3 py-1 text-xs hover:bg-plexus-bg"
            >
              Edit MCP servers →
            </Link>
            {data.mcpFile.exists && (
              <FileViewerButton agentId={data.id} filePath={data.mcpFile.path} readOnly />
            )}
          </div>
        </div>
      </section>

      {/* Instruction files ─────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-plexus-mute">
          Instruction Files
        </h2>
        {data.instructionFiles.length === 0 && (
          <div className="text-sm text-plexus-mute">
            No conventional instruction file for {data.displayName}.
          </div>
        )}
        {data.instructionFiles.map((f) => (
          <div
            key={f.status.path}
            className="rounded border border-plexus-border bg-plexus-panel p-4 text-sm"
          >
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-medium">{f.label}</span>
              <code className="font-mono text-xs text-plexus-mute">{f.status.path}</code>
              {f.status.exists ? (
                <span className="rounded bg-plexus-ok/15 px-2 py-0.5 text-xs text-plexus-ok">
                  exists
                </span>
              ) : (
                <span className="rounded bg-plexus-border px-2 py-0.5 text-xs text-plexus-mute">
                  not yet created
                </span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <FileViewerButton
                agentId={data.id}
                filePath={f.status.path}
                allowCreate={!f.status.exists}
              />
            </div>
          </div>
        ))}
      </section>

      {/* Skills ────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-plexus-mute">
            Skills ({data.skills.length})
          </h2>
          <Link href="/skills" className="text-xs text-plexus-accent hover:underline">
            Manage in Skills page →
          </Link>
        </div>
        <div className="rounded border border-plexus-border bg-plexus-panel">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2 text-xs uppercase tracking-wider text-plexus-mute">
            <div>ID</div>
            <div className="text-right">Owner</div>
            <div className="text-right">Action</div>
          </div>
          {data.skills.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-plexus-mute">
              No skills installed for this agent.
            </div>
          )}
          {data.skills.slice(0, 50).map((s) => (
            <div
              key={s.path}
              className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-t border-plexus-border/60 px-4 py-2 text-sm"
            >
              <div>
                <div className="font-mono">{s.id}</div>
                {s.isSymlink && s.linkTarget && (
                  <div className="mt-0.5 text-[10px] text-plexus-mute">
                    → {truncMid(s.linkTarget, 80)}
                  </div>
                )}
              </div>
              <div className="text-right">
                {s.isSymlink ? (
                  <span className="rounded bg-plexus-ok/15 px-2 py-0.5 text-xs text-plexus-ok">
                    Plexus-owned
                  </span>
                ) : (
                  <span className="rounded bg-plexus-warn/15 px-2 py-0.5 text-xs text-plexus-warn">
                    agent-local
                  </span>
                )}
              </div>
              <div className="text-right">
                {s.hasSkillMd && (
                  <FileViewerButton
                    agentId={data.id}
                    filePath={`${s.path}/SKILL.md`}
                    label="View / Edit"
                  />
                )}
              </div>
            </div>
          ))}
          {data.skills.length > 50 && (
            <div className="border-t border-plexus-border/60 px-4 py-2 text-center text-xs text-plexus-mute">
              ... and {data.skills.length - 50} more (manage on the Skills page)
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FileViewerButton({
  agentId,
  filePath,
  label = "View / Edit",
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
        if (!d.ok) {
          setMsg(`Read failed: ${d.message}`);
        } else {
          setContent(d.content);
        }
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
      if (!data.ok) {
        setMsg(`Save failed: ${data.message}`);
      } else {
        setMsg(data.backup ? `Saved. Backup: ${data.backup}` : "Saved.");
        setTimeout(() => setOpen(false), 600);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-plexus-border px-2 py-1 text-xs hover:bg-plexus-bg"
      >
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[80vh] w-[80vw] max-w-5xl flex-col rounded border border-plexus-border bg-plexus-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-plexus-border px-5 py-3">
              <div className="flex items-center justify-between">
                <code className="font-mono text-xs text-plexus-mute">{filePath}</code>
                <button
                  onClick={() => setOpen(false)}
                  className="text-plexus-mute hover:text-plexus-text"
                >
                  ✕
                </button>
              </div>
              {msg && <div className="mt-2 text-xs text-plexus-mute">{msg}</div>}
            </div>
            <textarea
              className="flex-1 resize-none bg-plexus-bg p-4 font-mono text-xs text-plexus-text outline-none"
              value={content}
              readOnly={readOnly}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2 border-t border-plexus-border px-5 py-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded border border-plexus-border px-3 py-1.5 text-xs hover:bg-plexus-bg"
              >
                Close
              </button>
              {!readOnly && (
                <button
                  onClick={save}
                  disabled={busy}
                  className="rounded bg-plexus-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Save (auto-backup)"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
