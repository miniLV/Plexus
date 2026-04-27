"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
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
    <div className="space-y-6">
      {/* Privacy pledge */}
      <Card className="border-l-[3px] border-l-plexus-ok px-5 py-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-plexus-ok" strokeWidth={1.5} />
          <div className="text-xs leading-relaxed text-plexus-text-2">
            <span className="font-semibold text-plexus-text">Privacy pledge.</span> Plexus runs
            entirely on your machine. No data is sent anywhere — not even crash reports. The only
            outbound traffic is the optional <code className="font-mono">git pull</code> when you
            subscribe to a team config repo.
          </div>
        </div>
      </Card>

      {/* Enabled agents */}
      <Card className="p-5">
        <div className="plexus-eyebrow mb-1">Enabled agents</div>
        <p className="text-xs text-plexus-text-3">
          Disable an agent to skip it during sync, even if it is installed.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {agents.map((id) => {
            const enabled = config.agents[id] !== false;
            return (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-3 rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm hover:border-plexus-border-strong"
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) =>
                    save({ ...config, agents: { ...config.agents, [id]: e.target.checked } })
                  }
                  className="h-4 w-4 cursor-pointer accent-plexus-accent"
                />
                <span className={enabled ? "text-plexus-text" : "text-plexus-text-3"}>
                  {displayNames[id] ?? id}
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      {/* Sync strategy */}
      <Card className="p-5">
        <div className="plexus-eyebrow mb-1">Sync strategy</div>
        <p className="text-xs text-plexus-text-3">
          Symlinks are preferred — changes propagate instantly without re-running sync. Copy
          fallback is more portable across operating systems but requires sync to refresh files.
        </p>
        <div className="mt-4 flex gap-2">
          {(["symlink", "copy"] as const).map((strategy) => {
            const active = config.syncStrategy === strategy;
            return (
              <Button
                key={strategy}
                variant={active ? "primary" : "secondary"}
                size="sm"
                onClick={() => save({ ...config, syncStrategy: strategy })}
              >
                {strategy}
              </Button>
            );
          })}
        </div>
      </Card>

      {msg && <div className="text-xs text-plexus-text-3">{msg}</div>}
    </div>
  );
}
