"use client";

import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type RulesPanelStatus, normalizeRulesStatus } from "@/lib/rules";
import { cn } from "@/lib/utils";
import {
  ArrowDownToLine,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  SendHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";

export type RulesStatus = RulesPanelStatus;

type ApiResult = RulesStatus | { status?: unknown; ok?: boolean; error?: string; message?: string };

function normalizeStatus(data: ApiResult): RulesStatus {
  return normalizeRulesStatus(data);
}

function statusTone(status: string): "ok" | "warn" | "mute" | "info" {
  if (status === "linked" || status === "copied" || status === "in sync") return "ok";
  if (status === "drift") return "warn";
  if (status === "missing" || status === "disabled" || status === "not installed") return "mute";
  return "info";
}

function statusVariant(status: string): "synced" | "divergent" | "native" | "outline" {
  if (status === "linked" || status === "copied" || status === "in sync") return "synced";
  if (status === "drift") return "divergent";
  if (status === "missing" || status === "disabled" || status === "not installed") return "native";
  return "outline";
}

function fmtUpdatedAt(value?: string) {
  if (!value) return "Not saved yet";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function readError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    return data.error ?? data.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function RulesPanel({ initial }: { initial: RulesStatus }) {
  const [status, setStatus] = useState<RulesStatus>(initial);
  const [content, setContent] = useState(initial.content ?? "");
  const [busy, setBusy] = useState<"save" | "apply" | "refresh" | string | null>(null);
  const [message, setMessage] = useState<string | null>(initial.unavailableReason ?? null);

  const dirty = content !== (status.content ?? "");
  const syncedAgents = useMemo(
    () =>
      status.agents.filter((agent) => ["linked", "copied", "in sync"].includes(agent.status))
        .length,
    [status.agents],
  );

  async function refresh(nextMessage?: string) {
    setBusy("refresh");
    try {
      const res = await fetch("/api/rules");
      if (!res.ok) {
        setMessage(await readError(res, "Could not refresh rules status."));
        return;
      }
      const next = normalizeStatus((await res.json()) as ApiResult);
      setStatus(next);
      setContent(next.content ?? "");
      setMessage(nextMessage ?? next.unavailableReason ?? null);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setMessage(null);
    try {
      const res = await fetch("/api/rules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        setMessage(await readError(res, "Could not save rules."));
        return;
      }
      const next = normalizeStatus((await res.json()) as ApiResult);
      setStatus(next);
      setContent(next.content ?? content);
      setMessage("Saved to personal rules baseline.");
    } finally {
      setBusy(null);
    }
  }

  async function applyToAll() {
    setBusy("apply");
    setMessage(null);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "apply" }),
      });
      if (!res.ok) {
        setMessage(await readError(res, "Could not apply rules."));
        return;
      }
      const next = normalizeStatus((await res.json()) as ApiResult);
      setStatus(next);
      setContent(next.content ?? content);
      setMessage("Applied rules to all available agents.");
    } finally {
      setBusy(null);
    }
  }

  async function importFromAgent(agentId: string) {
    setBusy(`import:${agentId}`);
    setMessage(null);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "import", agentId }),
      });
      if (!res.ok) {
        setMessage(await readError(res, "Could not import rules."));
        return;
      }
      const next = normalizeStatus((await res.json()) as ApiResult);
      setStatus(next);
      setContent(next.content ?? "");
      setMessage("Imported agent rules into the personal baseline.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = Boolean(status.unavailableReason);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-plexus-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-plexus-accent" strokeWidth={1.5} />
              <h2 className="plexus-title">Global Rules</h2>
              {dirty ? (
                <Badge variant="divergent">unsaved</Badge>
              ) : (
                <Badge variant="synced">saved</Badge>
              )}
            </div>
            <code className="mt-1 block truncate font-mono text-xs text-plexus-text-3">
              {status.canonicalPath}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refresh()} disabled={busy != null}>
              {busy === "refresh" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={save}
              disabled={busy != null || disabled}
            >
              {busy === "save" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              Save
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={applyToAll}
              disabled={busy != null || dirty || disabled}
              title={dirty ? "Save the baseline before applying it." : undefined}
            >
              {busy === "apply" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <SendHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              Apply to all agents
            </Button>
          </div>
        </div>

        {message && (
          <div
            className={cn(
              "border-b border-plexus-border px-5 py-2 text-xs",
              status.unavailableReason
                ? "bg-plexus-warn/10 text-plexus-warn"
                : "bg-plexus-surface-2 text-plexus-text-2",
            )}
          >
            {message}
          </div>
        )}

        <textarea
          className="min-h-[520px] w-full resize-y bg-plexus-bg p-5 font-mono text-[13px] leading-6 text-plexus-text outline-none placeholder:text-plexus-text-mute focus:bg-plexus-bg"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={disabled}
          placeholder="Write the shared operating rules every agent should receive."
          spellCheck={false}
        />
      </Card>

      <div className="space-y-4">
        <Card className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="plexus-eyebrow mb-1">Targets</div>
              <div className="text-sm text-plexus-text-2">
                {syncedAgents} of {status.agents.length} agent files in sync
              </div>
            </div>
            <Badge variant={dirty ? "divergent" : "synced"}>
              <StatusDot tone={dirty ? "warn" : "ok"} />
              {dirty ? "pending save" : "baseline ready"}
            </Badge>
          </div>
          <div className="mt-4 text-xs leading-relaxed text-plexus-text-3">
            Plexus writes the same baseline to Claude Code as{" "}
            <span className="font-mono text-plexus-text-2">CLAUDE.md</span> and to other tools as{" "}
            <span className="font-mono text-plexus-text-2">AGENTS.md</span>. Import replaces the
            personal baseline with that agent's current rules.
          </div>
          <div className="mt-3 text-xs text-plexus-text-3">
            Last updated:{" "}
            <span className="text-plexus-text-2">{fmtUpdatedAt(status.updatedAt)}</span>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] border-b border-plexus-border px-4 py-3 text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
            <div>Agent target</div>
            <div>Status</div>
          </div>
          {status.agents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-plexus-text-3">
              Rules targets are waiting for the core rules API.
            </div>
          ) : (
            status.agents.map((agent) => {
              const importBusy = busy === `import:${agent.agentId}`;
              return (
                <div
                  key={agent.agentId}
                  className="border-b border-plexus-border/60 px-4 py-3 last:border-0 hover:bg-plexus-surface-2/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-plexus-text">
                        {agent.displayName ?? agent.agentId}
                      </div>
                      <code className="mt-1 block truncate font-mono text-xs text-plexus-text-3">
                        {agent.targetPath}
                      </code>
                    </div>
                    <Badge variant={statusVariant(agent.status)}>
                      <StatusDot tone={statusTone(agent.status)} />
                      {agent.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-plexus-text-mute">
                      {agent.lastAppliedAt
                        ? `applied ${fmtUpdatedAt(agent.lastAppliedAt)}`
                        : "no apply record"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => importFromAgent(agent.agentId)}
                      disabled={
                        busy != null ||
                        disabled ||
                        agent.status === "missing" ||
                        agent.status === "disabled" ||
                        agent.status === "not installed"
                      }
                    >
                      {importBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                      Import
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </Card>

        <Card className="flex items-start gap-3 px-5 py-4 text-sm text-plexus-text-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-plexus-ok" strokeWidth={1.5} />
          <div>
            Rules are plain text and user-authored. This page does not read or reveal MCP command
            environment variables or tokens.
          </div>
        </Card>
      </div>
    </div>
  );
}
