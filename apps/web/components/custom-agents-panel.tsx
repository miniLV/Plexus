"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

type CustomAgent = {
  id: string;
  displayName: string;
  instructionFile: string;
  note?: string;
  createdAt: string;
};

type CatalogAgent = {
  id: string;
  displayName: string;
  support: "full" | "instructions-only" | "manual";
  managed: boolean;
  installed: boolean;
  rootDir?: string;
  instructionFile?: string;
  mcpPath?: string;
  skillsDir?: string;
  note: string;
};

export function CustomAgentsPanel() {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [catalog, setCatalog] = useState<CatalogAgent[]>([]);
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
      const [customRes, catalogRes] = await Promise.all([
        fetch("/api/custom-agents"),
        fetch("/api/agent-catalog"),
      ]);
      const customData = await customRes.json();
      const catalogData = await catalogRes.json();
      setAgents(customData.agents ?? []);
      setCatalog(catalogData.agents ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [customRes, catalogRes] = await Promise.all([
          fetch("/api/custom-agents"),
          fetch("/api/agent-catalog"),
        ]);
        const customData = await customRes.json();
        const catalogData = await catalogRes.json();
        if (!cancelled) {
          setAgents(customData.agents ?? []);
          setCatalog(catalogData.agents ?? []);
        }
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

  async function addPreset(agent: CatalogAgent) {
    if (!agent.instructionFile) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/custom-agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: agent.id,
          displayName: agent.displayName,
          instructionFile: agent.instructionFile,
          note: agent.note,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Failed to add custom agent");
        return;
      }
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

  const customIds = new Set(agents.map((agent) => agent.id));
  const sortedCatalog = [...catalog].sort(
    (a, b) =>
      Number(b.installed) - Number(a.installed) || a.displayName.localeCompare(b.displayName),
  );

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="plexus-eyebrow mb-1">Agent catalog</div>
          <p className="max-w-xl text-xs text-plexus-text-3">
            Built-in agents sync Rules, MCP, and Skills. Other popular tools are listed as manual
            presets so users can quickly track an instruction file without waiting for a native
            adapter.
          </p>
        </div>
        {!adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Add agent
          </Button>
        )}
      </div>

      {catalog.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded border border-plexus-border">
          <div className="grid min-w-[720px] grid-cols-[1fr_86px_92px_96px] gap-x-4 border-b border-plexus-border bg-plexus-surface-2/40 px-4 py-2.5 text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
            <div>Agent</div>
            <div className="text-right">Status</div>
            <div className="text-right">Support</div>
            <div className="text-right">Action</div>
          </div>
          {sortedCatalog.map((agent) => {
            const alreadyTracked = customIds.has(agent.id);
            return (
              <div
                key={agent.id}
                className={`grid min-w-[720px] grid-cols-[1fr_86px_92px_96px] gap-x-4 border-b border-plexus-border/60 px-4 py-3 text-sm last:border-0 ${
                  agent.installed ? "bg-plexus-bg" : "bg-plexus-surface text-plexus-text-3"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-plexus-text">{agent.displayName}</div>
                  <div className="font-mono text-[11px] text-plexus-text-3">{agent.id}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-plexus-text-2">
                    {agent.mcpPath ?? agent.instructionFile ?? agent.rootDir}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={agent.installed ? "synced" : "native"}>
                    {agent.installed ? "installed" : "missing"}
                  </Badge>
                </div>
                <div className="text-right">
                  <Badge variant={agent.managed ? "personal" : "outline"}>
                    {agent.support === "full" ? "full sync" : "manual"}
                  </Badge>
                </div>
                <div className="text-right">
                  {agent.managed ? (
                    <Badge variant="synced">built-in</Badge>
                  ) : alreadyTracked ? (
                    <Badge variant="native">tracked</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addPreset(agent)}
                      disabled={busy || !agent.instructionFile}
                    >
                      Track file
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
          <div className="overflow-x-auto rounded border border-plexus-border">
            <div className="grid min-w-[720px] grid-cols-[1fr_130px_180px] gap-x-4 border-b border-plexus-border bg-plexus-surface-2/40 px-4 py-2.5 text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
              <div>Agent</div>
              <div className="text-right">Lite</div>
              <div className="text-right">Action</div>
            </div>
            {agents.map((a) => (
              <div
                key={a.id}
                className="grid min-w-[720px] grid-cols-[1fr_130px_180px] gap-x-4 border-b border-plexus-border/60 px-4 py-3 text-sm last:border-0"
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
                <div className="flex justify-end gap-2 text-right">
                  <CustomAgentFileButton agent={a} />
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

function CustomAgentFileButton({ agent }: { agent: CustomAgent }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    setBusy(true);
    fetch(`/api/custom-agents/${encodeURIComponent(agent.id)}/file`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setMsg(data.message ?? "Failed to read file");
          return;
        }
        setContent(data.content ?? "");
        setExists(Boolean(data.exists));
      })
      .catch((err) => setMsg((err as Error).message))
      .finally(() => {
        setLoaded(true);
        setBusy(false);
      });
  }, [open, loaded, agent.id]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/custom-agents/${encodeURIComponent(agent.id)}/file`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message ?? "Failed to save file");
        return;
      }
      setExists(true);
      setMsg(data.backup ? `Saved. Backup: ${data.backup}` : "Saved.");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
        Edit
      </Button>
      {open && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[80vh] w-[80vw] max-w-5xl cursor-default flex-col overflow-hidden rounded-md border border-plexus-border bg-plexus-surface text-left shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-plexus-border px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={exists ? "synced" : "native"}>
                    {exists ? "editing" : "new file"}
                  </Badge>
                  <span className="text-sm font-semibold text-plexus-text">
                    {agent.displayName}
                  </span>
                </div>
                <code className="mt-1 block truncate font-mono text-xs text-plexus-text-3">
                  {agent.instructionFile}
                </code>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-plexus-text-3 hover:text-plexus-text"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="border-b border-plexus-border bg-plexus-surface-2/40 px-5 py-2 text-xs text-plexus-text-3">
              Plexus snapshots the current file before save. Missing files are created on first
              save.
            </div>
            {msg && (
              <div className="border-b border-plexus-border bg-plexus-surface-2 px-5 py-2 text-xs text-plexus-text-2">
                {msg}
              </div>
            )}
            <textarea
              className="flex-1 resize-none bg-plexus-bg p-4 font-mono text-xs text-plexus-text outline-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2 border-t border-plexus-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={busy}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />}
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
