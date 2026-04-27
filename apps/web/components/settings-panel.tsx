"use client";

import { useState } from "react";

type Config = {
  teamRepo?: string;
  agents: Record<string, boolean>;
  syncStrategy: "symlink" | "copy";
};

export function SettingsPanel({
  config: initial,
  agents,
  displayNames,
}: {
  config: Config;
  agents: string[];
  displayNames: Record<string, string>;
}) {
  const [config, setConfig] = useState<Config>(initial);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(next: Config) {
    setConfig(next);
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (res.ok) {
      setMsg("Saved");
      setTimeout(() => setMsg(null), 1200);
    } else {
      setMsg(`Error: ${await res.text()}`);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded border border-plexus-border bg-plexus-panel p-5">
        <div className="text-sm font-medium">Enabled agents</div>
        <p className="mt-1 text-xs text-plexus-mute">
          Disable an agent to skip it during sync, even if it is installed.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {agents.map((id) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-3 rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={config.agents[id] !== false}
                onChange={(e) =>
                  save({ ...config, agents: { ...config.agents, [id]: e.target.checked } })
                }
                className="h-4 w-4 accent-plexus-accent"
              />
              <span>{displayNames[id] ?? id}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded border border-plexus-border bg-plexus-panel p-5">
        <div className="text-sm font-medium">Sync strategy</div>
        <p className="mt-1 text-xs text-plexus-mute">
          Symlinks are preferred (changes propagate instantly). Copy fallback is more portable
          across operating systems.
        </p>
        <div className="mt-4 flex gap-3">
          {(["symlink", "copy"] as const).map((strategy) => (
            <button
              key={strategy}
              onClick={() => save({ ...config, syncStrategy: strategy })}
              className={`rounded border px-3 py-1.5 text-xs ${
                config.syncStrategy === strategy
                  ? "border-plexus-accent bg-plexus-accent/15 text-plexus-accent"
                  : "border-plexus-border text-plexus-mute hover:bg-plexus-bg"
              }`}
            >
              {strategy}
            </button>
          ))}
        </div>
      </section>

      {msg && <div className="text-xs text-plexus-mute">{msg}</div>}
    </div>
  );
}
