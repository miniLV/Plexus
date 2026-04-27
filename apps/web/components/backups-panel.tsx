"use client";

import { useState } from "react";

type BackupEntry = {
  agent: string | null;
  backupPath: string;
  originalPath: string;
  wasSymlink: boolean;
  linkTarget?: string;
};

type Snapshot = {
  id: string;
  dir: string;
  entries: BackupEntry[];
};

function shortenPath(p: string, max = 60): string {
  if (p.length <= max) return p;
  const left = Math.floor(max / 2 - 2);
  const right = Math.floor(max / 2 - 2);
  return p.slice(0, left) + "..." + p.slice(p.length - right);
}

export function BackupsPanel({ initial }: { initial: Snapshot[] }) {
  const [snapshots, setSnapshots] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function reload() {
    const res = await fetch("/api/backups");
    const data = await res.json();
    setSnapshots(data.snapshots ?? []);
  }

  async function restore(id: string) {
    if (
      !confirm(
        `Restore snapshot ${id}?\n\nThis overwrites the current files at the backed-up paths. Plexus does NOT take a fresh snapshot before restoring — the latest agent state will be lost.`,
      )
    ) {
      return;
    }
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(id)}/restore`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(
          `Restored ${data.restored} file(s) from ${id}.${
            data.errors?.length ? ` Errors: ${data.errors.join("; ")}` : ""
          }`,
        );
      } else {
        setMsg(`Restore failed: ${data.errors?.join("; ") ?? data.message}`);
      }
      await reload();
    } finally {
      setBusy(null);
    }
  }

  function toggleExpanded(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-plexus-mute">
          {snapshots.length} snapshot(s). Plexus keeps the most recent 20.
        </div>
        <button
          onClick={reload}
          className="rounded border border-plexus-border px-3 py-1.5 text-xs hover:bg-plexus-bg"
        >
          Refresh
        </button>
      </div>

      {msg && (
        <div className="rounded border border-plexus-ok/40 bg-plexus-ok/10 px-3 py-2 text-xs text-plexus-text">
          {msg}
        </div>
      )}

      {snapshots.length === 0 ? (
        <div className="rounded border border-plexus-border bg-plexus-panel px-5 py-8 text-center text-sm text-plexus-mute">
          No snapshots yet. They'll appear here after your first sync or edit.
        </div>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snap) => {
            const date = new Date(snap.id.replace(/-/g, ":").slice(0, 23));
            const isOpen = expanded.has(snap.id);
            return (
              <div
                key={snap.id}
                className="rounded border border-plexus-border bg-plexus-panel p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-sm">
                      {isNaN(date.getTime()) ? snap.id : date.toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-xs text-plexus-mute">
                      {snap.entries.length} file(s) ·{" "}
                      <code className="font-mono">{shortenPath(snap.dir, 70)}</code>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => toggleExpanded(snap.id)}
                      className="rounded border border-plexus-border px-3 py-1 text-xs hover:bg-plexus-bg"
                    >
                      {isOpen ? "Hide" : "Details"}
                    </button>
                    <button
                      onClick={() => restore(snap.id)}
                      disabled={busy === snap.id || snap.entries.length === 0}
                      className="rounded bg-plexus-warn px-3 py-1 text-xs font-medium text-plexus-bg disabled:opacity-50"
                    >
                      {busy === snap.id ? "Restoring..." : "Restore"}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-3 space-y-1 border-t border-plexus-border pt-3 text-xs">
                    {snap.entries.length === 0 && (
                      <div className="text-plexus-mute">No file entries.</div>
                    )}
                    {snap.entries.map((e, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto] gap-3">
                        <code className="font-mono text-plexus-text">
                          {shortenPath(e.originalPath, 80)}
                        </code>
                        <span className="text-plexus-mute">
                          {e.agent ?? "single-file"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
