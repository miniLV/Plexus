"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, X } from "lucide-react";
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
  "gemini-cli": "Gemini",
  "qwen-code": "Qwen",
  "factory-droid": "Droid",
};

function authorityVariant(a: Row["authority"]): "personal" | "team" | "native" {
  if (a === "team") return "team";
  if (a === "personal") return "personal";
  return "native";
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
      if (!data.ok) setMsg(`Error: ${data.message}`);
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs tracking-[0.02em] text-plexus-text-3">
          {rows.length} unique server{rows.length === 1 ? "" : "s"} ·{" "}
          {rows.filter((r) => r.authority === "personal").length} in personal store ·{" "}
          {rows.filter((r) => r.authority === "native").length} native-only
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-plexus-err">{msg}</span>}
          <Button
            variant={adding ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setAdding(!adding)}
          >
            {adding ? (
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            {adding ? "Cancel" : "Add MCP"}
          </Button>
        </div>
      </div>

      {adding && (
        <Card className="space-y-3 border-l-[3px] border-l-plexus-accent p-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="h-9 rounded border border-plexus-border bg-plexus-bg px-3 text-sm placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
              placeholder="id (e.g. github)"
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
            />
            <input
              className="h-9 rounded border border-plexus-border bg-plexus-bg px-3 text-sm placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
              placeholder="command (e.g. npx)"
              value={draft.command}
              onChange={(e) => setDraft({ ...draft, command: e.target.value })}
            />
          </div>
          <input
            className="h-9 w-full rounded border border-plexus-border bg-plexus-bg px-3 font-mono text-sm placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
            placeholder="args (space-separated)"
            value={draft.args}
            onChange={(e) => setDraft({ ...draft, args: e.target.value })}
          />
          <Button variant="primary" size="sm" onClick={addRow} disabled={busy === "__new__"}>
            Save and sync
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-plexus-border text-left text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Layer</th>
              <th className="px-4 py-3 font-medium">Command</th>
              {agents.map((a) => (
                <th key={a} className="px-2 py-3 text-center font-medium">
                  {displayNames[a] ?? AGENT_LABELS[a] ?? a}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4 + agents.length}
                  className="px-4 py-10 text-center text-sm text-plexus-text-3"
                >
                  No MCP servers anywhere. Click <span className="text-plexus-text">Add MCP</span>{" "}
                  to create one.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-plexus-border/60 last:border-0 hover:bg-plexus-surface-2/40"
              >
                <td className="px-4 py-3 font-mono text-[13px] text-plexus-text">{r.id}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={authorityVariant(r.authority)}
                    title={
                      r.authority === "native"
                        ? "Only in agent native config — toggling promotes to personal"
                        : r.authority === "team"
                          ? "Authority lives in the team layer (read-only)"
                          : "Managed in your personal Plexus layer"
                    }
                  >
                    {r.authority}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-plexus-text-3">
                  {r.command} {(r.args ?? []).join(" ")}
                </td>
                {agents.map((a) => {
                  const has = r.effectiveAgents.includes(a);
                  const isBusy = busy === `${r.id}:${a}`;
                  const disabled = r.authority === "team" || !installed[a];
                  return (
                    <td key={a} className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={has}
                        disabled={disabled || isBusy}
                        onChange={(e) => toggle(r, a, e.target.checked)}
                        className="h-4 w-4 cursor-pointer accent-plexus-accent disabled:cursor-not-allowed disabled:opacity-40"
                        title={!installed[a] ? `${displayNames[a]} not installed` : ""}
                      />
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right">
                  {r.authority === "personal" && (
                    <button
                      type="button"
                      onClick={() => removeRow(r)}
                      disabled={busy === r.id}
                      className="text-plexus-text-3 hover:text-plexus-err disabled:opacity-50"
                      title="Delete from Plexus and all agents"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="space-y-2 px-4 py-3 text-xs leading-relaxed text-plexus-text-3">
        <div>
          <Badge variant="native">native</Badge> items are still only in the agent's own config.
          Toggling promotes them into your personal Plexus store. <Badge variant="team">team</Badge>{" "}
          items live in the team repo and are read-only here.
        </div>
        <details>
          <summary className="cursor-pointer text-plexus-text-2 hover:text-plexus-text">
            How does checking a box change the file system?
          </summary>
          <div className="mt-2 space-y-2 leading-relaxed">
            <p>
              <strong className="text-plexus-text">Cursor / Factory Droid</strong>: their MCP file
              is a single symlink to{" "}
              <code className="rounded bg-plexus-surface-2 px-1 py-0.5 font-mono text-[11px]">
                ~/.config/plexus/.cache/mcp/&lt;agent&gt;.json
              </code>
              . Plexus regenerates that cache file from your store; the agent transparently sees the
              new entries via the symlink.
            </p>
            <p>
              <strong className="text-plexus-text">
                Claude Code / Codex / Gemini CLI / Qwen Code
              </strong>
              : their files carry many unrelated keys (auth/history/[profile]…), so Plexus
              partial-writes only the{" "}
              <code className="rounded bg-plexus-surface-2 px-1 py-0.5 font-mono text-[11px]">
                mcpServers
              </code>{" "}
              section. The rest of the file is preserved byte-for-byte.
            </p>
            <p>
              Every toggle takes a backup snapshot to{" "}
              <code className="rounded bg-plexus-surface-2 px-1 py-0.5 font-mono text-[11px]">
                ~/.config/plexus/backups/&lt;timestamp&gt;/
              </code>{" "}
              first.
            </p>
          </div>
        </details>
      </Card>
    </div>
  );
}
