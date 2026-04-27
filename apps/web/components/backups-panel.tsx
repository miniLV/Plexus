"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Undo2 } from "lucide-react";
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
  return `${p.slice(0, left)}…${p.slice(p.length - right)}`;
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
        <div className="text-xs tracking-[0.02em] text-plexus-text-3">
          {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"} · Plexus keeps the most
          recent 20
        </div>
        <Button variant="ghost" size="sm" onClick={reload}>
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} /> Refresh
        </Button>
      </div>

      {msg && (
        <Card className="border-l-[3px] border-l-plexus-ok px-4 py-2.5 text-xs text-plexus-text-2">
          {msg}
        </Card>
      )}

      {snapshots.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <div className="text-sm text-plexus-text-2">
            No snapshots yet — they'll appear here after your first sync or edit.
          </div>
          <div className="mt-1 text-xs text-plexus-text-3">
            Plexus auto-snapshots every agent's MCP file before any write.
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snap) => {
            const date = new Date(snap.id.replace(/-/g, ":").slice(0, 23));
            const isOpen = expanded.has(snap.id);
            return (
              <Card key={snap.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-plexus-text">
                      {Number.isNaN(date.getTime()) ? snap.id : date.toLocaleString()}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-plexus-text-3">
                      {snap.entries.length} file{snap.entries.length === 1 ? "" : "s"} ·{" "}
                      <code className="font-mono">{shortenPath(snap.dir, 70)}</code>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" size="sm" onClick={() => toggleExpanded(snap.id)}>
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                      {isOpen ? "Hide" : "Details"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => restore(snap.id)}
                      disabled={busy === snap.id || snap.entries.length === 0}
                      title="Overwrite live agent files with this snapshot"
                    >
                      {busy === snap.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <Undo2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                      {busy === snap.id ? "Restoring…" : "Restore"}
                    </Button>
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-3 space-y-1 border-t border-plexus-border pt-3 text-xs">
                    {snap.entries.length === 0 && (
                      <div className="text-plexus-text-3">No file entries.</div>
                    )}
                    {snap.entries.map((e) => (
                      <div
                        key={`${e.agent ?? "single"}:${e.originalPath}`}
                        className="grid grid-cols-[1fr_auto] gap-3"
                      >
                        <code className="font-mono text-plexus-text">
                          {shortenPath(e.originalPath, 80)}
                        </code>
                        <span className="text-plexus-text-3">{e.agent ?? "single-file"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
