"use client";

import { useState } from "react";

type Row = {
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  authority: "personal" | "team" | "native";
  effectiveAgents: string[];
  nativeAgents: string[];
  enabledAgents?: string[];
};

const AGENT_LABELS: Record<string, string> = {
  "claude-code": "Claude",
  cursor: "Cursor",
  codex: "Codex",
  "factory-droid": "Droid",
};

function authorityClass(a: Row["authority"]): string {
  if (a === "personal") return "bg-plexus-border text-plexus-mute";
  if (a === "team") return "bg-plexus-accent/15 text-plexus-accent";
  return "bg-plexus-warn/15 text-plexus-warn";
}

export function McpEditor({
  initial,
  agents,
  displayNames,
  installed,
}: {
  initial: Row[];
  agents: string[];
  displayNames: Record<string, string>;
  installed: Record<string, boolean>;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    id: "",
    command: "",
    args: "",
    enabledAgents: agents,
  });
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/mcp/effective");
    const data = await res.json();
    setRows(data.rows ?? []);
  }

  async function toggle(row: Row, agent: string, enabled: boolean) {
    if (row.authority === "team") return;
    setBusy(`${row.id}:${agent}`);
    try {
      const res = await fetch(`/api/mcp/${encodeURIComponent(row.id)}/toggle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent, enabled }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(`Error: ${data.message}`);
      }
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function addRow() {
    if (!draft.id || !draft.command) {
      setMsg("id and command are required");
      return;
    }
    if (rows.some((r) => r.id === draft.id)) {
      setMsg(`Duplicate id: ${draft.id}`);
      return;
    }
    setBusy("__new__");
    try {
      const res = await fetch("/api/mcp", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          servers: [
            ...rows
              .filter((r) => r.authority === "personal")
              .map((r) => ({
                id: r.id,
                command: r.command,
                args: r.args,
                env: r.env,
                layer: "personal",
                enabledAgents: r.enabledAgents ?? [],
              })),
            {
              id: draft.id,
              command: draft.command,
              args: draft.args.split(/\s+/).filter(Boolean),
              layer: "personal",
              enabledAgents: draft.enabledAgents,
            },
          ],
        }),
      });
      if (!res.ok) {
        setMsg(await res.text());
        return;
      }
      // After writing, run a full sync to push to all enabledAgents.
      await fetch("/api/sync", { method: "POST" });
      setDraft({ id: "", command: "", args: "", enabledAgents: agents });
      setAdding(false);
      setMsg(null);
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function removeRow(row: Row) {
    if (row.authority !== "personal") return;
    if (!confirm(`Delete ${row.id} from Plexus and all agents?`)) return;
    setBusy(row.id);
    try {
      const next = rows
        .filter((r) => r.authority === "personal" && r.id !== row.id)
        .map((r) => ({
          id: r.id,
          command: r.command,
          args: r.args,
          env: r.env,
          layer: "personal",
          enabledAgents: r.enabledAgents ?? [],
        }));
      await fetch("/api/mcp", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ servers: next }),
      });
      await fetch("/api/sync", { method: "POST" });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-plexus-mute">
          {rows.length} unique server(s) · {rows.filter((r) => r.authority === "personal").length} in personal store · {rows.filter((r) => r.authority === "native").length} native-only
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-plexus-err">{msg}</span>}
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
            <input
              className="rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
              placeholder="command (e.g. npx)"
              value={draft.command}
              onChange={(e) => setDraft({ ...draft, command: e.target.value })}
            />
          </div>
          <input
            className="w-full rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm font-mono"
            placeholder="args (space-separated)"
            value={draft.args}
            onChange={(e) => setDraft({ ...draft, args: e.target.value })}
          />
          <button
            onClick={addRow}
            disabled={busy === "__new__"}
            className="rounded bg-plexus-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Save and sync
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
                {displayNames[a] ?? AGENT_LABELS[a] ?? a}
              </th>
            ))}
            <th className="border-b border-plexus-border py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4 + agents.length} className="py-6 text-center text-plexus-mute">
                No MCP servers anywhere. Click <span className="text-plexus-text">+ Add MCP</span>.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-plexus-border/60">
              <td className="py-3 pr-4 font-mono">{r.id}</td>
              <td className="py-3 pr-4">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${authorityClass(r.authority)}`}
                  title={
                    r.authority === "native"
                      ? "Only in agent's native config (not yet imported into Plexus)"
                      : r.authority === "team"
                      ? "Authority lives in the team layer (read-only)"
                      : "Managed in your personal Plexus layer"
                  }
                >
                  {r.authority}
                </span>
              </td>
              <td className="py-3 pr-4 font-mono text-xs text-plexus-mute">
                {r.command} {(r.args ?? []).join(" ")}
              </td>
              {agents.map((a) => {
                const has = r.effectiveAgents.includes(a);
                const isBusy = busy === `${r.id}:${a}`;
                const disabled = r.authority === "team" || !installed[a];
                return (
                  <td key={a} className="text-center">
                    <input
                      type="checkbox"
                      checked={has}
                      disabled={disabled || isBusy}
                      onChange={(e) => toggle(r, a, e.target.checked)}
                      className="h-4 w-4 accent-plexus-accent disabled:opacity-40"
                      title={!installed[a] ? `${displayNames[a]} not installed` : ""}
                    />
                  </td>
                );
              })}
              <td className="py-3 text-right">
                {r.authority === "personal" && (
                  <button
                    onClick={() => removeRow(r)}
                    disabled={busy === r.id}
                    className="text-xs text-plexus-mute hover:text-plexus-err disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-2 text-xs text-plexus-mute">
        <div>
          <span className="rounded bg-plexus-warn/15 px-1.5 py-0.5 text-plexus-warn">
            native
          </span>{" "}
          items are still only in the agent's own config. Toggling promotes them
          into your personal Plexus store.{" "}
          <span className="rounded bg-plexus-accent/15 px-1.5 py-0.5 text-plexus-accent">
            team
          </span>{" "}
          items live in the team repo and are read-only here.
        </div>
        <details>
          <summary className="cursor-pointer text-plexus-text">
            How does checking a box change the file system?
          </summary>
          <div className="mt-2 space-y-1 leading-relaxed">
            <p>
              <strong className="text-plexus-text">Cursor / Factory Droid</strong>:
              their MCP file is a single symlink to{" "}
              <code>~/.config/plexus/.cache/mcp/&lt;agent&gt;.json</code>.
              Plexus regenerates that cache file from your store; the agent
              transparently sees the new entries via the symlink.
            </p>
            <p>
              <strong className="text-plexus-text">Claude Code / Codex</strong>:
              their files carry many unrelated keys (auth/history/[profile]…), so
              Plexus partial-writes only the <code>mcpServers</code> section. The
              rest of the file is preserved byte-for-byte.
            </p>
            <p>
              Every toggle takes a backup snapshot to{" "}
              <code>~/.config/plexus/backups/&lt;timestamp&gt;/</code> first.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
