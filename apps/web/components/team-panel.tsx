"use client";

import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink, Loader2, Mail, RefreshCw } from "lucide-react";
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
      {/* Beta callout */}
      <Card className="border-l-[3px] border-l-plexus-accent p-5">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-plexus-accent" strokeWidth={1.5} />
          <div>
            <div className="text-sm font-semibold text-plexus-text">
              Team workflow is shipping in 1.1
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-plexus-text-3">
              The 1.0 release ships with a stable single-machine sync. Team subscription, PR
              proposals, and conflict resolution are landing in the 1.1 beta. The skeleton below is
              wired up — you can already attach a repo, but expect rough edges.
            </p>
            <a
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-plexus-accent hover:underline"
              href="https://github.com/miniLV/Plexus/discussions"
            >
              Join the 1.1 beta waitlist
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </Card>

      {/* Subscription */}
      <Card className="p-5">
        {status.subscribed ? (
          <>
            <div className="plexus-eyebrow">Subscribed to</div>
            <div className="mt-1 font-mono text-sm text-plexus-text">{status.repoUrl}</div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              {status.hasUpstreamUpdate ? (
                <>
                  <StatusDot tone="warn" />
                  <span className="text-plexus-warn">
                    {status.behind} update{status.behind === 1 ? "" : "s"} available
                  </span>
                </>
              ) : (
                <>
                  <StatusDot tone="ok" />
                  <span className="text-plexus-ok">Up-to-date</span>
                </>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="primary" size="sm" onClick={pull} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                {busy ? "Pulling…" : "Pull updates"}
              </Button>
              <Button variant="ghost" size="sm" onClick={refresh} disabled={busy}>
                Refresh
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="plexus-eyebrow">No team subscription yet</div>
            <p className="mt-1 max-w-xl text-xs text-plexus-text-3">
              Paste a public GitHub URL with a <code className="font-mono">team-plexus-config</code>{" "}
              layout. Plexus clones it into{" "}
              <code className="font-mono">~/.config/plexus/team/</code> and merges it under your
              personal layer at sync time.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/your-org/team-plexus-config.git"
                className="h-9 flex-1 rounded border border-plexus-border bg-plexus-bg px-3 text-sm placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
              />
              <Button variant="primary" onClick={join} disabled={busy || !url}>
                {busy ? "Joining…" : "Join"}
              </Button>
            </div>
          </>
        )}
        {msg && <div className="mt-3 text-xs text-plexus-text-3">{msg}</div>}
      </Card>

      {/* Propose to team */}
      <Card className="p-5">
        <div className="text-sm font-semibold text-plexus-text">Propose to team</div>
        <p className="mt-1 text-xs leading-relaxed text-plexus-text-3">
          To share a personal MCP server or skill with the rest of the team, push it to the team
          repo via a pull request. The 1.0 release keeps this manual; a one-click PR helper is on
          the 1.1 roadmap.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-plexus-text-3">
          <li>Fork or branch the team repo (the URL above).</li>
          <li>
            Copy the file from{" "}
            <code className="rounded bg-plexus-surface-2 px-1 py-0.5 font-mono text-[11px]">
              ~/.config/plexus/personal/
            </code>{" "}
            into the same path under the team repo.
          </li>
          <li>Open a pull request — your team lead reviews and merges.</li>
          <li>
            Run <code className="font-mono text-plexus-text">Pull updates</code> here to receive the
            merged version.
          </li>
        </ol>
      </Card>
    </div>
  );
}
