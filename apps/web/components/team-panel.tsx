"use client";

import { useState } from "react";

type Status = {
  subscribed: boolean;
  repoUrl?: string;
  hasUpstreamUpdate?: boolean;
  ahead?: number;
  behind?: number;
};

export function TeamPanel({ status: initial }: { status: Status }) {
  const [status, setStatus] = useState<Status>(initial);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/team");
    setStatus(await res.json());
  }

  async function join() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "join", repoUrl: url }),
      });
      const data = await res.json();
      setMsg(data.message);
      if (data.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function pull() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pull" }),
      });
      const data = await res.json();
      setMsg(data.message);
      if (data.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded border border-plexus-border bg-plexus-panel p-5">
        {status.subscribed ? (
          <>
            <div className="text-sm text-plexus-mute">Subscribed to</div>
            <div className="mt-1 font-mono text-plexus-text">{status.repoUrl}</div>
            <div className="mt-3 text-sm">
              {status.hasUpstreamUpdate ? (
                <span className="text-plexus-warn">⟳ {status.behind} update(s) available</span>
              ) : (
                <span className="text-plexus-ok">● Up-to-date</span>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={pull}
                disabled={busy}
                className="rounded bg-plexus-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Pulling..." : "Pull updates"}
              </button>
              <button
                onClick={refresh}
                disabled={busy}
                className="rounded border border-plexus-border px-3 py-1.5 text-sm hover:bg-plexus-bg"
              >
                Refresh
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-plexus-mute">No team subscription yet.</div>
            <div className="mt-3 flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/your-org/team-plexus-config.git"
                className="flex-1 rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm"
              />
              <button
                onClick={join}
                disabled={busy || !url}
                className="rounded bg-plexus-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Joining..." : "Join"}
              </button>
            </div>
          </>
        )}
        {msg && <div className="mt-3 text-xs text-plexus-mute">{msg}</div>}
      </div>

      <div className="rounded border border-plexus-border bg-plexus-panel p-5">
        <div className="text-sm font-medium">Propose to team</div>
        <p className="mt-1 text-xs text-plexus-mute">
          To share a personal MCP server or skill with the rest of the team, push it to the team
          repo via a pull request. The MVP keeps this manual; a one-click PR helper is on the
          roadmap.
        </p>
        <ol className="mt-3 list-decimal pl-5 text-xs text-plexus-mute">
          <li>Fork or branch the team repo (the URL above).</li>
          <li>
            Copy the file from <code className="font-mono">~/.config/plexus/personal/</code> into
            the same path under the team repo.
          </li>
          <li>Open a pull request — your team lead reviews and merges.</li>
          <li>
            Run <code className="font-mono">Pull updates</code> here to receive the merged version.
          </li>
        </ol>
      </div>
    </div>
  );
}
