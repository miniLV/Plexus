"use client";

import { useEffect, useState } from "react";

type Preview = {
  mcp: { item: { id: string }; sourceAgents: string[] }[];
  skills: { item: { id: string }; sourceAgents: string[] }[];
  skipped: { mcp: string[]; skills: string[] };
  perAgent: Record<string, { mcp: number; skills: number }>;
};

const AGENT_LABELS: Record<string, string> = {
  "claude-code": "Claude",
  cursor: "Cursor",
  codex: "Codex",
  "factory-droid": "Droid",
};

export function ImportBanner({
  hasAnyContent,
}: {
  hasAnyContent: boolean;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ mcpWritten: number; skillsWritten: number } | null>(null);

  useEffect(() => {
    if (hasAnyContent) return;
    fetch("/api/import")
      .then((r) => r.json())
      .then(setPreview)
      .catch(() => {});
  }, [hasAnyContent]);

  // Don't show if user already has content, or if nothing to import.
  if (hasAnyContent) return null;
  if (!preview || (preview.mcp.length === 0 && preview.skills.length === 0)) return null;

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch("/api/import", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setDone({ mcpWritten: data.mcpWritten, skillsWritten: data.skillsWritten });
        setTimeout(() => window.location.reload(), 800);
      } else {
        alert(`Import failed: ${data.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded border border-plexus-ok/40 bg-plexus-ok/10 px-4 py-3 text-sm">
        <span className="text-plexus-ok">✓ Imported</span>{" "}
        <span className="text-plexus-mute">
          {done.mcpWritten} MCP server(s), {done.skillsWritten} skill(s). Reloading...
        </span>
      </div>
    );
  }

  return (
    <div className="rounded border border-plexus-accent/40 bg-plexus-accent/10 px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium text-plexus-accent">
            Found existing config in your installed agents
          </div>
          <div className="mt-1 text-plexus-mute">
            <span>{preview.mcp.length} unique MCP server(s)</span>{" "}
            <span>· {preview.skills.length} unique skill(s)</span>{" "}
            <span>across:</span>{" "}
            {Object.entries(preview.perAgent)
              .filter(([, v]) => v.mcp + v.skills > 0)
              .map(([id, v]) => (
                <span key={id} className="ml-2">
                  <span className="text-plexus-text">{AGENT_LABELS[id] ?? id}</span>{" "}
                  <span className="text-plexus-mute">({v.mcp + v.skills})</span>
                </span>
              ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setOpen(!open)}
            className="rounded border border-plexus-border px-3 py-1.5 text-xs hover:bg-plexus-bg"
          >
            {open ? "Hide" : "Preview"}
          </button>
          <button
            onClick={apply}
            disabled={busy}
            className="rounded bg-plexus-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? "Importing..." : "Import as personal"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="mb-1 font-medium text-plexus-text">MCP Servers ({preview.mcp.length})</div>
            <ul className="space-y-1 text-plexus-mute">
              {preview.mcp.map(({ item, sourceAgents }) => (
                <li key={item.id}>
                  <span className="font-mono text-plexus-text">{item.id}</span>{" "}
                  <span className="text-plexus-mute">
                    ← {sourceAgents.map((a) => AGENT_LABELS[a] ?? a).join(", ")}
                  </span>
                </li>
              ))}
              {preview.mcp.length === 0 && <li className="text-plexus-mute">none</li>}
            </ul>
          </div>
          <div>
            <div className="mb-1 font-medium text-plexus-text">Skills ({preview.skills.length})</div>
            <ul className="max-h-64 space-y-1 overflow-auto text-plexus-mute">
              {preview.skills.map(({ item, sourceAgents }) => (
                <li key={item.id}>
                  <span className="font-mono text-plexus-text">{item.id}</span>{" "}
                  <span className="text-plexus-mute">
                    ← {sourceAgents.map((a) => AGENT_LABELS[a] ?? a).join(", ")}
                  </span>
                </li>
              ))}
              {preview.skills.length === 0 && <li className="text-plexus-mute">none</li>}
            </ul>
          </div>
          {(preview.skipped.mcp.length > 0 || preview.skipped.skills.length > 0) && (
            <div className="col-span-2 text-plexus-mute">
              Skipped (already in personal layer):{" "}
              {[...preview.skipped.mcp, ...preview.skipped.skills].join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
