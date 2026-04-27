"use client";

import { useEffect, useState } from "react";

type NewItem = {
  kind: "new";
  item: { id: string; name?: string };
  sourceAgents: string[];
};

type ExtendItem = {
  kind: "extend";
  id: string;
  displayName: string;
  agentsToAdd: string[];
  currentAgents: string[];
};

type Candidate = NewItem | ExtendItem;

type Preview = {
  mcp: Candidate[];
  skills: Candidate[];
  perAgent: Record<string, { mcp: number; skills: number }>;
};

const AGENT_LABELS: Record<string, string> = {
  "claude-code": "Claude",
  cursor: "Cursor",
  codex: "Codex",
  "factory-droid": "Droid",
};

function fmtAgents(ids: string[]): string {
  return ids.map((a) => AGENT_LABELS[a] ?? a).join(", ");
}

export function ImportBanner() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    mcpWritten: number;
    mcpExtended: number;
    skillsWritten: number;
    skillsExtended: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/import")
      .then((r) => r.json())
      .then(setPreview)
      .catch(() => {});
  }, []);

  if (!preview) return null;
  const total = preview.mcp.length + preview.skills.length;
  if (total === 0) return null;

  const newMcp = preview.mcp.filter((c) => c.kind === "new").length;
  const extendMcp = preview.mcp.filter((c) => c.kind === "extend").length;
  const newSkills = preview.skills.filter((c) => c.kind === "new").length;
  const extendSkills = preview.skills.filter((c) => c.kind === "extend").length;

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch("/api/import", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setDone({
          mcpWritten: data.mcpWritten,
          mcpExtended: data.mcpExtended,
          skillsWritten: data.skillsWritten,
          skillsExtended: data.skillsExtended,
        });
        setTimeout(() => window.location.reload(), 900);
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
          new: {done.mcpWritten} MCP / {done.skillsWritten} skill ·{" "}
          extended: {done.mcpExtended} MCP / {done.skillsExtended} skill. Reloading...
        </span>
      </div>
    );
  }

  return (
    <div className="rounded border border-plexus-accent/40 bg-plexus-accent/10 px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium text-plexus-accent">
            {newMcp + newSkills > 0
              ? "Found new MCP servers / skills in your installed agents"
              : "Some Plexus entries are missing agents that already have them"}
          </div>
          <div className="mt-1 text-plexus-mute">
            {newMcp + newSkills > 0 && (
              <>
                <span>new: {newMcp} MCP, {newSkills} skill</span>
              </>
            )}
            {newMcp + newSkills > 0 && extendMcp + extendSkills > 0 && (
              <span> · </span>
            )}
            {extendMcp + extendSkills > 0 && (
              <>
                <span>extend coverage: {extendMcp} MCP, {extendSkills} skill</span>
              </>
            )}
            <div className="mt-1 text-xs">
              {Object.entries(preview.perAgent)
                .filter(([, v]) => v.mcp + v.skills > 0)
                .map(([id, v]) => (
                  <span key={id} className="mr-3">
                    <span className="text-plexus-text">{AGENT_LABELS[id] ?? id}</span>{" "}
                    <span className="text-plexus-mute">
                      ({v.mcp} mcp, {v.skills} skill in native)
                    </span>
                  </span>
                ))}
            </div>
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
            {busy ? "Importing..." : "Apply"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="mb-1 font-medium text-plexus-text">
              MCP Servers ({preview.mcp.length})
            </div>
            <ul className="space-y-1 text-plexus-mute">
              {preview.mcp.map((c, i) =>
                c.kind === "new" ? (
                  <li key={`m-${c.item.id}-${i}`}>
                    <span className="rounded bg-plexus-accent/15 px-1.5 py-0.5 text-[10px] text-plexus-accent">
                      new
                    </span>{" "}
                    <span className="font-mono text-plexus-text">{c.item.id}</span>{" "}
                    <span>← {fmtAgents(c.sourceAgents)}</span>
                  </li>
                ) : (
                  <li key={`m-${c.id}-${i}`}>
                    <span className="rounded bg-plexus-warn/15 px-1.5 py-0.5 text-[10px] text-plexus-warn">
                      extend
                    </span>{" "}
                    <span className="font-mono text-plexus-text">{c.id}</span>{" "}
                    <span>+ {fmtAgents(c.agentsToAdd)}</span>
                  </li>
                ),
              )}
              {preview.mcp.length === 0 && <li className="text-plexus-mute">none</li>}
            </ul>
          </div>
          <div>
            <div className="mb-1 font-medium text-plexus-text">
              Skills ({preview.skills.length})
            </div>
            <ul className="max-h-64 space-y-1 overflow-auto text-plexus-mute">
              {preview.skills.map((c, i) =>
                c.kind === "new" ? (
                  <li key={`s-${c.item.id}-${i}`}>
                    <span className="rounded bg-plexus-accent/15 px-1.5 py-0.5 text-[10px] text-plexus-accent">
                      new
                    </span>{" "}
                    <span className="font-mono text-plexus-text">{c.item.id}</span>{" "}
                    <span>← {fmtAgents(c.sourceAgents)}</span>
                  </li>
                ) : (
                  <li key={`s-${c.id}-${i}`}>
                    <span className="rounded bg-plexus-warn/15 px-1.5 py-0.5 text-[10px] text-plexus-warn">
                      extend
                    </span>{" "}
                    <span className="font-mono text-plexus-text">{c.id}</span>{" "}
                    <span>+ {fmtAgents(c.agentsToAdd)}</span>
                  </li>
                ),
              )}
              {preview.skills.length === 0 && <li className="text-plexus-mute">none</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
