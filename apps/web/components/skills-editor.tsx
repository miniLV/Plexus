"use client";

import { useState } from "react";

type SkillLite = {
  id: string;
  name: string;
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

export function SkillsEditor({
  initial,
  agents,
}: {
  initial: SkillLite[];
  agents: string[];
}) {
  const [skills, setSkills] = useState<SkillLite[]>(initial);
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

  async function reload() {
    const res = await fetch("/api/skills");
    const data = await res.json();
    setSkills(data.skills ?? []);
  }

  async function toggleAgent(s: SkillLite, agent: string) {
    const enabledAgents = s.enabledAgents.includes(agent)
      ? s.enabledAgents.filter((a) => a !== agent)
      : [...s.enabledAgents, agent];
    await fetch(`/api/skills/${encodeURIComponent(s.id)}?layer=${s.layer}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabledAgents }),
    });
    await reload();
  }

  async function removeSkill(s: SkillLite) {
    if (s.layer === "team") return;
    if (!confirm(`Delete skill "${s.id}"?`)) return;
    await fetch(`/api/skills/${encodeURIComponent(s.id)}?layer=${s.layer}`, {
      method: "DELETE",
    });
    await reload();
  }

  async function addSkill() {
    if (!draft.id || !draft.name) {
      setMsg("id and name are required");
      return;
    }
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) {
      setMsg(await res.text());
      return;
    }
    setDraft({ id: "", name: "", description: "", body: "", layer: "personal", enabledAgents: agents });
    setAdding(false);
    setMsg(null);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-plexus-mute">{skills.length} skill(s)</div>
        <div className="flex items-center gap-3">
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
              onChange={(e) => setDraft({ ...draft, id: e.target.value.replace(/[^a-z0-9-_]/gi, "-") })}
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
            <th className="border-b border-plexus-border py-2 pr-4">Name</th>
            <th className="border-b border-plexus-border py-2 pr-4">Layer</th>
            {agents.map((a) => (
              <th key={a} className="border-b border-plexus-border px-2 py-2 text-center">
                {AGENT_LABELS[a] ?? a}
              </th>
            ))}
            <th className="border-b border-plexus-border py-2"></th>
          </tr>
        </thead>
        <tbody>
          {skills.length === 0 && (
            <tr>
              <td colSpan={5 + agents.length} className="py-6 text-center text-plexus-mute">
                No skills yet. Click <span className="text-plexus-text">+ Add Skill</span> to create one.
              </td>
            </tr>
          )}
          {skills.map((s) => (
            <tr key={`${s.layer}:${s.id}`} className="border-b border-plexus-border/60">
              <td className="py-3 pr-4 font-mono">{s.id}</td>
              <td className="py-3 pr-4">{s.name}</td>
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
              {agents.map((a) => (
                <td key={a} className="text-center">
                  <input
                    type="checkbox"
                    checked={s.enabledAgents.includes(a)}
                    onChange={() => toggleAgent(s, a)}
                    disabled={s.layer === "team"}
                    className="h-4 w-4 accent-plexus-accent"
                  />
                </td>
              ))}
              <td className="py-3 text-right">
                {s.layer === "personal" && (
                  <button
                    onClick={() => removeSkill(s)}
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
    </div>
  );
}
