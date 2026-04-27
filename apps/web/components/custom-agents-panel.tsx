"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

type CustomAgent = {
  id: string;
  displayName: string;
  instructionFile: string;
  note?: string;
  createdAt: string;
};

export function CustomAgentsPanel() {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ id: "", displayName: "", instructionFile: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formIdInput = useId();
  const formNameInput = useId();
  const formFileInput = useId();
  const formNoteInput = useId();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/custom-agents");
      const data = await res.json();
      setAgents(data.agents ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/custom-agents");
        const data = await res.json();
        if (!cancelled) setAgents(data.agents ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/custom-agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: form.id.trim(),
          displayName: form.displayName.trim(),
          instructionFile: form.instructionFile.trim(),
          note: form.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Failed to add custom agent");
        return;
      }
      setForm({ id: "", displayName: "", instructionFile: "", note: "" });
      setAdding(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm(`Remove custom agent '${id}'? The instruction file on disk is not deleted.`))
      return;
    setBusy(true);
    try {
      await fetch(`/api/custom-agents/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="plexus-eyebrow mb-1">Custom agents</div>
          <p className="max-w-xl text-xs text-plexus-text-3">
            Register an AI agent Plexus doesn't know about (e.g. GitHub Copilot CLI, an in-house
            tool). Lite scope: only its instruction file (CLAUDE.md / AGENTS.md / etc.) is tracked —
            MCP and Skills sync are not enabled for custom agents yet.
          </p>
        </div>
        {!adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Add agent
          </Button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <form
          onSubmit={handleAdd}
          className="mt-5 space-y-3 rounded border border-plexus-border bg-plexus-bg p-4"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label
                htmlFor={formIdInput}
                className="mb-1 block text-[11px] uppercase tracking-[0.10em] text-plexus-text-3"
              >
                Agent id
              </label>
              <input
                id={formIdInput}
                type="text"
                required
                placeholder="e.g. copilot-cli"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                className="w-full rounded border border-plexus-border bg-plexus-surface px-3 py-2 text-sm text-plexus-text outline-none focus:border-plexus-accent"
              />
            </div>
            <div>
              <label
                htmlFor={formNameInput}
                className="mb-1 block text-[11px] uppercase tracking-[0.10em] text-plexus-text-3"
              >
                Display name
              </label>
              <input
                id={formNameInput}
                type="text"
                required
                placeholder="e.g. GitHub Copilot CLI"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full rounded border border-plexus-border bg-plexus-surface px-3 py-2 text-sm text-plexus-text outline-none focus:border-plexus-accent"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor={formFileInput}
              className="mb-1 block text-[11px] uppercase tracking-[0.10em] text-plexus-text-3"
            >
              Instruction file path
            </label>
            <input
              id={formFileInput}
              type="text"
              required
              placeholder="e.g. ~/.config/copilot/AGENTS.md"
              value={form.instructionFile}
              onChange={(e) => setForm({ ...form, instructionFile: e.target.value })}
              className="w-full rounded border border-plexus-border bg-plexus-surface px-3 py-2 font-mono text-xs text-plexus-text outline-none focus:border-plexus-accent"
            />
            <p className="mt-1 text-[11px] text-plexus-text-3">
              Absolute or `~/`-relative. Plexus will create or read the file when you click View /
              Edit.
            </p>
          </div>
          <div>
            <label
              htmlFor={formNoteInput}
              className="mb-1 block text-[11px] uppercase tracking-[0.10em] text-plexus-text-3"
            >
              Note <span className="lowercase text-plexus-text-3">(optional)</span>
            </label>
            <input
              id={formNoteInput}
              type="text"
              maxLength={280}
              placeholder="Anything to remember about this agent…"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full rounded border border-plexus-border bg-plexus-surface px-3 py-2 text-sm text-plexus-text outline-none focus:border-plexus-accent"
            />
          </div>
          {error && (
            <div className="rounded border border-plexus-err/40 bg-plexus-err/10 px-3 py-2 text-xs text-plexus-err">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setError(null);
                setForm({ id: "", displayName: "", instructionFile: "", note: "" });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? "Adding…" : "Add agent"}
            </Button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="mt-5">
        {loading && <div className="text-xs text-plexus-text-3">Loading custom agents…</div>}
        {!loading && agents.length === 0 && !adding && (
          <div className="rounded border border-dashed border-plexus-border bg-plexus-bg/40 px-4 py-6 text-center text-xs text-plexus-text-3">
            No custom agents yet. Click <span className="text-plexus-text">Add agent</span> to
            register one.
          </div>
        )}
        {agents.length > 0 && (
          <div className="overflow-hidden rounded border border-plexus-border">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-plexus-border bg-plexus-surface-2/40 px-4 py-2.5 text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
              <div>Agent</div>
              <div className="text-right">Lite</div>
              <div className="text-right">Action</div>
            </div>
            {agents.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-plexus-border/60 px-4 py-3 text-sm last:border-0"
              >
                <div>
                  <div className="font-semibold text-plexus-text">{a.displayName}</div>
                  <div className="font-mono text-[11px] text-plexus-text-3">{a.id}</div>
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-plexus-text-2">
                    <FileText className="h-3 w-3" strokeWidth={1.5} />
                    {a.instructionFile}
                  </div>
                  {a.note && (
                    <div className="mt-1 text-[11px] italic text-plexus-text-3">{a.note}</div>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant="native">instructions only</Badge>
                </div>
                <div className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(a.id)}
                    disabled={busy}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
