"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, Trash2, X } from "lucide-react";
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
  "gemini-cli": "Gemini",
  "qwen-code": "Qwen",
  "factory-droid": "Droid",
};

function authorityVariant(a: Row["authority"]): "personal" | "team" | "native" {
  if (a === "team") return "team";
  if (a === "personal") return "personal";
  return "native";
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
    if (row.authority === "team") return;
    if (!confirm(`Delete skill "${row.id}"?`)) return;
    setBusy(row.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMsg(`Error: ${data.message ?? data.error ?? "failed to delete skill"}`);
        return;
      }
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
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs tracking-[0.02em] text-plexus-text-3">
          {rows.length} unique skill{rows.length === 1 ? "" : "s"} ·{" "}
          {rows.filter((r) => r.authority === "personal").length} in personal store ·{" "}
          {rows.filter((r) => r.authority === "native").length} native-only
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              className="-translate-y-1/2 absolute top-1/2 left-2.5 h-3.5 w-3.5 text-plexus-text-mute"
              strokeWidth={1.5}
            />
            <input
              className="h-8 w-52 rounded border border-plexus-border bg-plexus-surface-2 pr-3 pl-8 text-xs placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
              placeholder="Filter skill…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
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
            {adding ? "Cancel" : "Add Skill"}
          </Button>
        </div>
      </div>

      {adding && (
        <Card className="space-y-3 border-l-[3px] border-l-plexus-accent p-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="h-9 rounded border border-plexus-border bg-plexus-bg px-3 text-sm placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
              placeholder="id (folder-safe, e.g. code-review)"
              value={draft.id}
              onChange={(e) =>
                setDraft({ ...draft, id: e.target.value.replace(/[^a-z0-9-_]/gi, "-") })
              }
            />
            <input
              className="h-9 rounded border border-plexus-border bg-plexus-bg px-3 text-sm placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
              placeholder="name (display)"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <input
            className="h-9 w-full rounded border border-plexus-border bg-plexus-bg px-3 text-sm placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
            placeholder="description (optional)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <textarea
            className="h-48 w-full rounded border border-plexus-border bg-plexus-bg px-3 py-2 font-mono text-xs placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
            placeholder="SKILL.md body (markdown). Frontmatter is generated automatically."
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <Button variant="primary" size="sm" onClick={addSkill} disabled={busy === "__new__"}>
            Save and sync
          </Button>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-plexus-border text-left text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
              <th className="px-4 py-3 font-medium">Skill</th>
              <th className="px-4 py-3 font-medium">Layer</th>
              {agents.map((a) => (
                <th
                  key={a}
                  className="px-2 py-3 text-center font-medium"
                  title={displayNames[a] ?? a}
                >
                  {AGENT_LABELS[a] ?? displayNames[a] ?? a}
                </th>
              ))}
              <th className="sticky right-0 z-10 bg-plexus-surface px-3 py-3 text-center font-medium shadow-[-10px_0_14px_-14px_rgb(0_0_0/0.45)]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={3 + agents.length}
                  className="px-4 py-10 text-center text-sm text-plexus-text-3"
                >
                  {rows.length === 0
                    ? "No skills found in any agent or in your store."
                    : "No skills match your filter."}
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const showFolderId = r.name !== r.id;
              return (
                <tr
                  key={r.id}
                  className="group border-b border-plexus-border/60 last:border-0 hover:bg-plexus-surface-2/40"
                >
                  <td className="min-w-[260px] px-4 py-3">
                    <div
                      className={
                        showFolderId
                          ? "truncate text-sm font-medium text-plexus-text"
                          : "truncate font-mono text-[13px] text-plexus-text"
                      }
                      title={r.name}
                    >
                      {r.name}
                    </div>
                    {showFolderId && (
                      <code className="mt-1 block truncate font-mono text-xs text-plexus-text-3">
                        {r.id}
                      </code>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={authorityVariant(r.authority)}>{r.authority}</Badge>
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
                  <td className="sticky right-0 z-10 bg-plexus-surface px-3 py-3 text-center shadow-[-10px_0_14px_-14px_rgb(0_0_0/0.45)] group-hover:bg-plexus-surface-2">
                    {r.authority !== "team" && (
                      <Button
                        variant="danger"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeRow(r)}
                        disabled={busy === r.id}
                        title="Delete skill"
                        aria-label={`Delete skill ${r.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="space-y-2 px-4 py-3 text-xs leading-relaxed text-plexus-text-3">
        <div>
          <Badge variant="native">native</Badge> skills are still only in the agent's own folder.
          Toggling promotes them into your personal Plexus store. <Badge variant="team">team</Badge>{" "}
          skills are read-only here — propose changes via PR.
        </div>
        <details>
          <summary className="cursor-pointer text-plexus-text-2 hover:text-plexus-text">
            How does checking a box change the file system?
          </summary>
          <div className="mt-2 space-y-2 leading-relaxed">
            <p>
              The skill folder is written into{" "}
              <code className="rounded bg-plexus-surface-2 px-1 py-0.5 font-mono text-[11px]">
                ~/.config/plexus/personal/skills/&lt;id&gt;/
              </code>{" "}
              (the canonical Plexus copy). Each enabled agent gets a symlink from its own skills
              directory to that folder, so all agents read the same SKILL.md.
            </p>
            <p>
              Toggling a skill off removes the symlink from that agent only; the Plexus copy stays.
              Other agents still see it.
            </p>
            <p>Every toggle takes a backup snapshot first.</p>
          </div>
        </details>
      </Card>
    </div>
  );
}
