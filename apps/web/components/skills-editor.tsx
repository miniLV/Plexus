"use client";

import { useState } from "react";

type Row = {
  id: string;
  name: string;
  description?: string;
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

export function SkillsEditor({
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
    name: "",
    description: "",
    body: "",
    layer: "personal" as const,
    enabledAgents: agents,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function reload() {
    const res = await fetch("/api/skills/effective");
    const data = await res.json();
    setRows(data.rows ?? []);
  }

  async function toggle(row: Row, agent: string, enabled: boolean) {
    if (row.authority === "team") return;
    setBusy(`${row.id}:${agent}`);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(row.id)}/toggle`, {
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

  async function removeRow(row: Row) {
    if (row.authority !== "personal") return;
    if (!confirm(`Delete skill "${row.id}"?`)) return;
    setBusy(row.id);
    try {
      await fetch(`/api/skills/${encodeURIComponent(row.id)}?layer=personal`, {
        method: "DELETE",
      });
      await fetch("/api/sync", { method: "POST" });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function addSkill() {
    if (!draft.id || !draft.name) {
      setMsg("id and name are required");
      return;
    }
    setBusy("__new__");
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        setMsg(await res.text());
        return;
      }
      await fetch("/api/sync", { method: "POST" });
      setDraft({
        id: "",
        name: "",
        description: "",
        body: "",
        layer: "personal",
        enabledAgents: agents,
      });
      setAdding(false);
      setMsg(null);
      await reload();
    } finally {
      setBusy(null);
    }
  }

  const visible = filter
    ? rows.filter(
        (r) =>
          r.id.toLowerCase().includes(filter.toLowerCase()) ||
          r.name.toLowerCase().includes(filter.toLowerCase()),
      )
    : rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-plexus-mute">
          {rows.length} unique skill(s) · {rows.filter((r) => r.authority === "personal").length} in
          personal store · {rows.filter((r) => r.authority === "native").length} native-only
        </div>
        <div className="flex items-center gap-3">
          <input
            className="rounded border border-plexus-border bg-plexus-bg px-2 py-1 text-xs w-48"
            placeholder="Filter by id or name..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {msg && <span className="text-xs text-plexus-err">{msg}</span>}
          <button
            onClick={() => setAdding(!adding)}
            className="rounded border border-plexus-border px-3 py-1.5 text-xs hover:bg-plexus-panel"
          >
            {adding ? "Cancel" : "+ Add Skill"}
          </button>
        </div>
      </div>

      {adding && (
        <div className="space-y-3 rounded border border-plexus-accent/40 bg-plexus-panel p-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
              placeholder="id (folder-safe, e.g. code-review)"
              value={draft.id}
              onChange={(e) =>
                setDraft({ ...draft, id: e.target.value.replace(/[^a-z0-9-_]/gi, "-") })
              }
            />
            <input
              className="rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
              placeholder="name (display)"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <input
            className="w-full rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
            placeholder="description (optional)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <textarea
            className="h-48 w-full rounded border border-plexus-border bg-plexus-bg px-3 py-2 font-mono text-xs"
            placeholder="SKILL.md body (markdown). Frontmatter is generated automatically."
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <button
            onClick={addSkill}
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
            <th className="border-b border-plexus-border py-2 pr-4">Name</th>
            <th className="border-b border-plexus-border py-2 pr-4">Layer</th>
            {agents.map((a) => (
              <th key={a} className="border-b border-plexus-border px-2 py-2 text-center">
                {displayNames[a] ?? AGENT_LABELS[a] ?? a}
              </th>
            ))}
            <th className="border-b border-plexus-border py-2" />
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={4 + agents.length} className="py-6 text-center text-plexus-mute">
                {rows.length === 0
                  ? "No skills found in any agent or in your store."
                  : "No skills match your filter."}
              </td>
            </tr>
          )}
          {visible.map((r) => (
            <tr key={r.id} className="border-b border-plexus-border/60">
              <td className="py-3 pr-4 font-mono">{r.id}</td>
              <td className="py-3 pr-4">{r.name}</td>
              <td className="py-3 pr-4">
                <span className={`rounded px-2 py-0.5 text-xs ${authorityClass(r.authority)}`}>
                  {r.authority}
                </span>
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
          <span className="rounded bg-plexus-warn/15 px-1.5 py-0.5 text-plexus-warn">native</span>{" "}
          skills are still only in the agent's own folder. Toggling promotes them into your personal
          Plexus store.{" "}
          <span className="rounded bg-plexus-accent/15 px-1.5 py-0.5 text-plexus-accent">team</span>{" "}
          skills are read-only here — propose changes via PR.
        </div>
        <details>
          <summary className="cursor-pointer text-plexus-text">
            How does checking a box change the file system?
          </summary>
          <div className="mt-2 space-y-1 leading-relaxed">
            <p>
              The skill folder is written into{" "}
              <code>~/.config/plexus/personal/skills/&lt;id&gt;/</code> (the canonical Plexus copy).
              Each enabled agent gets a symlink from its own skills directory to that folder, so all
              agents read the same SKILL.md.
            </p>
            <p>
              Toggling a skill off removes the symlink from that agent only; the Plexus copy stays.
              Other agents still see it.
            </p>
            <p>Every toggle takes a backup snapshot first.</p>
          </div>
        </details>
      </div>
    </div>
  );
}
