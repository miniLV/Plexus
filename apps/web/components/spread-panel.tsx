"use client";

import { useEffect, useState } from "react";

type Candidate<T> = { item: T; inStore: boolean };

type Preview = {
  from: string;
  to: string;
  mcp: Candidate<{ id: string; command: string; args?: string[] }>[];
  skills: Candidate<{ id: string; name: string }>[];
};

export function SpreadPanel({
  agents,
  displayNames,
  installed,
}: {
  agents: string[];
  displayNames: Record<string, string>;
  installed: Record<string, boolean>;
}) {
  const installedAgents = agents.filter((a) => installed[a]);
  const [from, setFrom] = useState(installedAgents[0] ?? agents[0]);
  const [to, setTo] = useState(installedAgents[1] ?? agents[1] ?? agents[0]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMcp, setSelectedMcp] = useState<Set<string>>(new Set());
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function loadPreview() {
    if (from === to) {
      setPreview({ from, to, mcp: [], skills: [] });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/spread?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      const data = await res.json();
      setPreview(data);
      // default: select all
      setSelectedMcp(new Set(data.mcp.map((c: any) => c.item.id)));
      setSelectedSkills(new Set(data.skills.map((c: any) => c.item.id)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function apply() {
    if (!preview) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/spread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          mcpIds: Array.from(selectedMcp),
          skillIds: Array.from(selectedSkills),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(
          `✓ Copied ${data.mcpAdded} MCP and ${data.skillsAdded} skill(s) → ${displayNames[to]}.${
            data.syncResult
              ? ` Synced (mcp ${data.syncResult.applied.mcp}, skills ${data.syncResult.applied.skills}).`
              : ""
          }`,
        );
        await loadPreview();
      } else {
        setResult(`Error: ${data.error ?? "unknown"}`);
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleAllMcp(checked: boolean) {
    if (!preview) return;
    setSelectedMcp(checked ? new Set(preview.mcp.map((c) => c.item.id)) : new Set());
  }

  function toggleAllSkills(checked: boolean) {
    if (!preview) return;
    setSelectedSkills(checked ? new Set(preview.skills.map((c) => c.item.id)) : new Set());
  }

  return (
    <div className="space-y-6">
      <div className="rounded border border-plexus-border bg-plexus-panel p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-plexus-mute">From</div>
            <select
              className="rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              {agents.map((a) => (
                <option key={a} value={a} disabled={!installed[a]}>
                  {displayNames[a] ?? a}
                  {!installed[a] ? " (not installed)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="pb-2 text-2xl text-plexus-mute">→</div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-plexus-mute">To</div>
            <select
              className="rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {agents.map((a) => (
                <option key={a} value={a} disabled={!installed[a]}>
                  {displayNames[a] ?? a}
                  {!installed[a] ? " (not installed)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={loadPreview}
              disabled={loading}
              className="rounded border border-plexus-border px-3 py-2 text-xs hover:bg-plexus-bg"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button
              onClick={apply}
              disabled={
                busy ||
                from === to ||
                (selectedMcp.size === 0 && selectedSkills.size === 0)
              }
              className="rounded bg-plexus-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy
                ? "Copying..."
                : `Copy ${selectedMcp.size + selectedSkills.size} → ${displayNames[to] ?? to}`}
            </button>
          </div>
        </div>
        {result && (
          <div className="mt-4 rounded bg-plexus-bg px-3 py-2 text-xs text-plexus-text">
            {result}
          </div>
        )}
      </div>

      {from === to ? (
        <div className="rounded border border-plexus-border bg-plexus-panel px-5 py-8 text-center text-sm text-plexus-mute">
          Pick two different agents.
        </div>
      ) : !preview ? (
        <div className="text-sm text-plexus-mute">Loading…</div>
      ) : preview.mcp.length === 0 && preview.skills.length === 0 ? (
        <div className="rounded border border-plexus-ok/40 bg-plexus-ok/10 px-5 py-8 text-center text-sm">
          <span className="text-plexus-ok">●</span> {displayNames[to]} already has everything {displayNames[from]} has.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded border border-plexus-border bg-plexus-panel p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                MCP Servers ({preview.mcp.length})
              </div>
              <label className="flex items-center gap-2 text-xs text-plexus-mute">
                <input
                  type="checkbox"
                  checked={selectedMcp.size === preview.mcp.length && preview.mcp.length > 0}
                  onChange={(e) => toggleAllMcp(e.target.checked)}
                  className="h-4 w-4 accent-plexus-accent"
                />
                Select all
              </label>
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {preview.mcp.length === 0 && (
                <li className="text-plexus-mute">No new MCP servers to copy.</li>
              )}
              {preview.mcp.map(({ item, inStore }) => (
                <li key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedMcp.has(item.id)}
                    onChange={(e) => {
                      const next = new Set(selectedMcp);
                      if (e.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      setSelectedMcp(next);
                    }}
                    className="h-4 w-4 accent-plexus-accent"
                  />
                  <span className="font-mono text-plexus-text">{item.id}</span>
                  <span className="text-plexus-mute">— {item.command}</span>
                  {!inStore && (
                    <span className="ml-auto rounded bg-plexus-warn/15 px-1.5 py-0.5 text-[10px] text-plexus-warn">
                      will import
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-plexus-border bg-plexus-panel p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                Skills ({preview.skills.length})
              </div>
              <label className="flex items-center gap-2 text-xs text-plexus-mute">
                <input
                  type="checkbox"
                  checked={selectedSkills.size === preview.skills.length && preview.skills.length > 0}
                  onChange={(e) => toggleAllSkills(e.target.checked)}
                  className="h-4 w-4 accent-plexus-accent"
                />
                Select all
              </label>
            </div>
            <ul className="mt-3 max-h-96 space-y-1 overflow-auto text-xs">
              {preview.skills.length === 0 && (
                <li className="text-plexus-mute">No new skills to copy.</li>
              )}
              {preview.skills.map(({ item, inStore }) => (
                <li key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedSkills.has(item.id)}
                    onChange={(e) => {
                      const next = new Set(selectedSkills);
                      if (e.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      setSelectedSkills(next);
                    }}
                    className="h-4 w-4 accent-plexus-accent"
                  />
                  <span className="font-mono text-plexus-text">{item.id}</span>
                  {!inStore && (
                    <span className="ml-auto rounded bg-plexus-warn/15 px-1.5 py-0.5 text-[10px] text-plexus-warn">
                      will import
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
