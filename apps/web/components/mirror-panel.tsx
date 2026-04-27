"use client";

import { useEffect, useState } from "react";

type Candidate<T> = { item: T; inStore: boolean };

type Preview = {
  from: string;
  to: string;
  mcp: Candidate<{ id: string; command: string; args?: string[] }>[];
  skills: Candidate<{ id: string; name: string }>[];
};

type PerTargetPreview = {
  agent: string;
  preview: Preview | null;
  loading: boolean;
};

const FILE_MODE_LABEL: Record<string, string> = {
  "claude-code": "partial-write",
  cursor: "symlink",
  codex: "partial-write",
  "factory-droid": "symlink",
};

export function MirrorPanel({
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
  const [targets, setTargets] = useState<Set<string>>(
    new Set(installedAgents.filter((a) => a !== (installedAgents[0] ?? agents[0]))),
  );
  const [previews, setPreviews] = useState<PerTargetPreview[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function loadPreviews() {
    const list: PerTargetPreview[] = [];
    for (const t of targets) {
      list.push({ agent: t, preview: null, loading: true });
    }
    setPreviews(list);
    const results = await Promise.all(
      Array.from(targets).map(async (t) => {
        if (t === from) return { agent: t, preview: null, loading: false };
        try {
          const res = await fetch(
            `/api/spread?from=${encodeURIComponent(from)}&to=${encodeURIComponent(t)}`,
          );
          const data = (await res.json()) as Preview;
          return { agent: t, preview: data, loading: false };
        } catch {
          return { agent: t, preview: null, loading: false };
        }
      }),
    );
    setPreviews(results);
  }

  useEffect(() => {
    if (from && targets.size > 0) loadPreviews();
    else setPreviews([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, Array.from(targets).join(",")]);

  function toggleTarget(agent: string) {
    if (agent === from) return;
    const next = new Set(targets);
    if (next.has(agent)) next.delete(agent);
    else next.add(agent);
    setTargets(next);
  }

  async function applyAll() {
    setBusy(true);
    setResult(null);
    let totalMcp = 0;
    let totalSkills = 0;
    const errors: string[] = [];
    for (const p of previews) {
      if (!p.preview) continue;
      const mcpIds = p.preview.mcp.map((c) => c.item.id);
      const skillIds = p.preview.skills.map((c) => c.item.id);
      if (mcpIds.length === 0 && skillIds.length === 0) continue;
      try {
        const res = await fetch("/api/spread", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ from, to: p.agent, mcpIds, skillIds }),
        });
        const data = await res.json();
        if (data.ok) {
          totalMcp += data.mcpAdded ?? 0;
          totalSkills += data.skillsAdded ?? 0;
        } else {
          errors.push(`${displayNames[p.agent]}: ${data.error ?? "unknown"}`);
        }
      } catch (e) {
        errors.push(`${displayNames[p.agent]}: ${(e as Error).message}`);
      }
    }
    setResult(
      errors.length > 0
        ? `Mirrored ${totalMcp} MCP, ${totalSkills} skill(s). Errors: ${errors.join("; ")}`
        : `Mirrored ${totalMcp} MCP and ${totalSkills} skill(s) across ${
            previews.filter((p) => p.preview && (p.preview.mcp.length || p.preview.skills.length)).length
          } target agent(s).`,
    );
    setBusy(false);
    await loadPreviews();
  }

  const totalDelta = previews.reduce(
    (acc, p) => acc + (p.preview ? p.preview.mcp.length + p.preview.skills.length : 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="rounded border border-plexus-border bg-plexus-panel p-5">
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-4">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-plexus-mute">
              Source
            </div>
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
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-plexus-mute">
              Target agents (mirror destinations)
            </div>
            <div className="flex flex-wrap gap-2">
              {agents
                .filter((a) => a !== from)
                .map((a) => (
                  <label
                    key={a}
                    className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 text-sm ${
                      targets.has(a)
                        ? "border-plexus-accent/60 bg-plexus-accent/10"
                        : "border-plexus-border"
                    } ${!installed[a] ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={targets.has(a)}
                      disabled={!installed[a]}
                      onChange={() => toggleTarget(a)}
                      className="h-4 w-4 accent-plexus-accent"
                    />
                    <span>{displayNames[a] ?? a}</span>
                    <span className="rounded bg-plexus-bg px-1.5 py-0.5 text-[10px] text-plexus-mute">
                      via {FILE_MODE_LABEL[a] ?? "?"}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-xs text-plexus-mute">
            {totalDelta === 0
              ? targets.size === 0
                ? "Pick at least one target."
                : "Targets are already up-to-date with source."
              : `${totalDelta} item(s) will be mirrored to ${targets.size} agent(s).`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadPreviews}
              disabled={targets.size === 0}
              className="rounded border border-plexus-border px-3 py-2 text-xs hover:bg-plexus-bg disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={applyAll}
              disabled={busy || totalDelta === 0}
              className="rounded bg-plexus-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Mirroring..." : `Mirror ${totalDelta} → ${targets.size} agent(s)`}
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-4 rounded bg-plexus-bg px-3 py-2 text-xs text-plexus-text">
            {result}
          </div>
        )}
      </div>

      {previews.length > 0 && (
        <div className="space-y-4">
          {previews.map((p) => (
            <div
              key={p.agent}
              className="rounded border border-plexus-border bg-plexus-panel p-4"
            >
              <div className="flex items-baseline gap-3">
                <div className="text-sm font-medium">
                  {displayNames[p.agent]}
                </div>
                <span className="rounded bg-plexus-bg px-1.5 py-0.5 text-[10px] text-plexus-mute">
                  via {FILE_MODE_LABEL[p.agent] ?? "?"}
                </span>
                <div className="ml-auto text-xs text-plexus-mute">
                  {p.loading
                    ? "loading..."
                    : p.preview
                    ? `${p.preview.mcp.length} MCP · ${p.preview.skills.length} skill(s) to mirror`
                    : "unable to load"}
                </div>
              </div>
              {p.preview && (p.preview.mcp.length > 0 || p.preview.skills.length > 0) && (
                <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="mb-1 font-medium text-plexus-text">
                      MCP ({p.preview.mcp.length})
                    </div>
                    <ul className="space-y-0.5 text-plexus-mute">
                      {p.preview.mcp.slice(0, 12).map((c) => (
                        <li key={c.item.id}>
                          <span className="font-mono text-plexus-text">
                            {c.item.id}
                          </span>
                          {!c.inStore && (
                            <span className="ml-2 rounded bg-plexus-warn/15 px-1 py-0.5 text-[9px] text-plexus-warn">
                              will import
                            </span>
                          )}
                        </li>
                      ))}
                      {p.preview.mcp.length > 12 && (
                        <li>... +{p.preview.mcp.length - 12} more</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1 font-medium text-plexus-text">
                      Skills ({p.preview.skills.length})
                    </div>
                    <ul className="max-h-40 space-y-0.5 overflow-auto text-plexus-mute">
                      {p.preview.skills.slice(0, 30).map((c) => (
                        <li key={c.item.id}>
                          <span className="font-mono text-plexus-text">
                            {c.item.id}
                          </span>
                        </li>
                      ))}
                      {p.preview.skills.length > 30 && (
                        <li>... +{p.preview.skills.length - 30} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
              {p.preview && p.preview.mcp.length === 0 && p.preview.skills.length === 0 && (
                <div className="mt-2 text-xs text-plexus-ok">
                  ● already up-to-date with source
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <details className="rounded border border-plexus-border bg-plexus-panel p-4 text-xs text-plexus-mute">
        <summary className="cursor-pointer text-plexus-text">
          What does mirror actually do under the hood?
        </summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>
            For each target agent, Plexus imports any source-agent items not yet in
            its store, adds the target to <code>enabledAgents</code>, and runs sync.
          </p>
          <p>
            <span className="text-plexus-accent">Cursor</span> /{" "}
            <span className="text-plexus-accent">Factory Droid</span>: their MCP file
            becomes a symlink to{" "}
            <code>~/.config/plexus/.cache/mcp/&lt;agent&gt;.json</code>. Editing
            either side edits the same bytes — there is one source of truth.
          </p>
          <p>
            <span className="text-plexus-accent">Claude Code</span> /{" "}
            <span className="text-plexus-accent">Codex</span>: their files carry
            unrelated keys (auth, history, settings, [profile], [auth]). Plexus
            partial-writes the MCP section in place; everything else is preserved
            verbatim.
          </p>
          <p>
            <span className="text-plexus-accent">Skills</span>: written as symlinks
            from each agent's skill dir to the Plexus personal store. All agents
            read the same SKILL.md.
          </p>
          <p>
            Every sync first snapshots all four agents' MCP files into{" "}
            <code>~/.config/plexus/backups/&lt;timestamp&gt;/</code>.
          </p>
        </div>
      </details>
    </div>
  );
}
