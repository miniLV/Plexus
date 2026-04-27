"use client";

import { useState } from "react";

type MCP = {
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
  layer: "team" | "personal";
  enabledAgents: string[];
};

const AGENT_LABELS: Record<string, string> = {
  "claude-code": "Claude",
  cursor: "Cursor",
  codex: "Codex",
  "factory-droid": "Droid",
};

export function McpEditor({
  initial,
  agents,
}: {
  initial: MCP[];
  agents: string[];
}) {
  const [servers, setServers] = useState<MCP[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<MCP>({
    id: "",
    command: "",
    args: [],
    layer: "personal",
    enabledAgents: agents,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function persist(next: MCP[]) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/mcp", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ servers: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      setServers(next);
      setMsg("Saved");
      setTimeout(() => setMsg(null), 1500);
    } catch (e) {
      setMsg(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  function toggleAgent(serverId: string, agent: string) {
    const next = servers.map((s) =>
      s.id === serverId
        ? {
            ...s,
            enabledAgents: s.enabledAgents.includes(agent)
              ? s.enabledAgents.filter((a) => a !== agent)
              : [...s.enabledAgents, agent],
          }
        : s,
    );
    persist(next);
  }

  function removeServer(id: string) {
    if (!confirm(`Delete MCP server "${id}"?`)) return;
    persist(servers.filter((s) => s.id !== id));
  }

  function addServer() {
    if (!draft.id || !draft.command) {
      setMsg("id and command are required");
      return;
    }
    if (servers.some((s) => s.id === draft.id)) {
      setMsg(`Duplicate id: ${draft.id}`);
      return;
    }
    persist([...servers, draft]);
    setDraft({ id: "", command: "", args: [], layer: "personal", enabledAgents: agents });
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-plexus-mute">{servers.length} server(s)</div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-plexus-mute">{msg}</span>}
          <button
            onClick={() => setAdding(!adding)}
            className="rounded border border-plexus-border px-3 py-1.5 text-xs hover:bg-plexus-panel"
          >
            {adding ? "Cancel" : "+ Add MCP"}
          </button>
        </div>
      </div>

      {adding && (
        <div className="space-y-3 rounded border border-plexus-accent/40 bg-plexus-panel p-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
              placeholder="id (e.g. github)"
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
            />
            <select
              className="rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
              value={draft.layer}
              onChange={(e) =>
                setDraft({ ...draft, layer: e.target.value as "team" | "personal" })
              }
            >
              <option value="personal">personal</option>
              <option value="team">team</option>
            </select>
          </div>
          <input
            className="w-full rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
            placeholder="command (e.g. npx)"
            value={draft.command}
            onChange={(e) => setDraft({ ...draft, command: e.target.value })}
          />
          <input
            className="w-full rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm font-mono"
            placeholder='args (space-separated, e.g. -y @modelcontextprotocol/server-github)'
            value={(draft.args ?? []).join(" ")}
            onChange={(e) =>
              setDraft({ ...draft, args: e.target.value.split(/\s+/).filter(Boolean) })
            }
          />
          <button
            onClick={addServer}
            disabled={saving}
            className="rounded bg-plexus-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Save
          </button>
        </div>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-plexus-mute">
            <th className="border-b border-plexus-border py-2 pr-4">ID</th>
            <th className="border-b border-plexus-border py-2 pr-4">Layer</th>
            <th className="border-b border-plexus-border py-2 pr-4">Command</th>
            {agents.map((a) => (
              <th key={a} className="border-b border-plexus-border px-2 py-2 text-center">
                {AGENT_LABELS[a] ?? a}
              </th>
            ))}
            <th className="border-b border-plexus-border py-2"></th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 && (
            <tr>
              <td colSpan={5 + agents.length} className="py-6 text-center text-plexus-mute">
                No MCP servers yet. Click <span className="text-plexus-text">+ Add MCP</span> to create one.
              </td>
            </tr>
          )}
          {servers.map((s) => (
            <tr key={`${s.layer}:${s.id}`} className="border-b border-plexus-border/60">
              <td className="py-3 pr-4 font-mono">{s.id}</td>
              <td className="py-3 pr-4">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    s.layer === "team"
                      ? "bg-plexus-accent/15 text-plexus-accent"
                      : "bg-plexus-border text-plexus-mute"
                  }`}
                >
                  {s.layer}
                </span>
              </td>
              <td className="py-3 pr-4 font-mono text-xs text-plexus-mute">
                {s.command} {(s.args ?? []).join(" ")}
              </td>
              {agents.map((a) => (
                <td key={a} className="text-center">
                  <input
                    type="checkbox"
                    checked={s.enabledAgents.includes(a)}
                    onChange={() => toggleAgent(s.id, a)}
                    disabled={s.layer === "team"}
                    className="h-4 w-4 accent-plexus-accent"
                  />
                </td>
              ))}
              <td className="py-3 text-right">
                {s.layer === "personal" && (
                  <button
                    onClick={() => removeServer(s.id)}
                    className="text-xs text-plexus-mute hover:text-plexus-err"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-plexus-mute">
        Team-layer servers are read-only here — propose changes via PR to the team repo.
      </p>
    </div>
  );
}
