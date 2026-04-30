"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const AGENT_LABELS: Record<string, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  "factory-droid": "Factory Droid",
};

interface SharePlan {
  targetAgents: string[];
  sources: Array<{ agent: string; mcp: number; skills: number; rules: boolean; total: number }>;
  recommendedPrimaryAgent?: string;
  selectedPrimaryAgent?: string;
  conflictCount: number;
  mcp: {
    safe: number;
    conflicts: Array<{ id: string; sources: string[]; preferredAgent?: string }>;
  };
  skills: {
    safe: number;
    conflicts: Array<{ id: string; sources: string[]; preferredAgent?: string }>;
  };
  rules: { sources: string[]; conflict: boolean; preferredAgent?: string };
  error?: string;
}

interface SyncReport {
  mode?: "share-all";
  targetAgents?: string[];
  plan?: SharePlan;
  preferredAgent?: string;
  conflictsResolved?: number;
  imported?: {
    mcpWritten: number;
    mcpExtended: number;
    skillsWritten: number;
    skillsExtended: number;
  };
  shared?: { mcp: number; skills: number };
  rules?: {
    applied: Array<{ agent: string; applied: boolean; skipped?: boolean; error?: string }>;
    importedFrom?: string;
    skipped?: string;
  };
  results?: Array<{
    agent: string;
    applied: { mcp: number; skills: number };
    errors: string[];
  }>;
  error?: string;
}

export function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(true);
  const [plan, setPlan] = useState<SharePlan | null>(null);
  const [preferredAgent, setPreferredAgent] = useState("");
  const [report, setReport] = useState<SyncReport | null>(null);

  async function refreshPlan(nextPreferredAgent?: string) {
    setPlanLoading(true);
    try {
      const params = nextPreferredAgent ? `?preferredAgent=${nextPreferredAgent}` : "";
      const res = await fetch(`/api/sync${params}`);
      const data = (await res.json()) as SharePlan;
      setPlan(data.error ? null : data);
      const selected =
        data.selectedPrimaryAgent ??
        data.recommendedPrimaryAgent ??
        data.sources?.find((source) => source.total > 0)?.agent ??
        "";
      setPreferredAgent(selected);
    } catch {
      setPlan(null);
    } finally {
      setPlanLoading(false);
    }
  }

  useEffect(() => {
    void refreshPlan();
  }, []);

  async function run() {
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preferredAgent: preferredAgent || undefined }),
      });
      const data = (await res.json()) as SyncReport;
      setReport(data);
      if (data.plan) setPlan(data.plan);
      if (!data.error) {
        setTimeout(() => window.location.reload(), 1600);
      }
    } catch (e) {
      setReport({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  const activeSources = plan?.sources.filter((source) => source.total > 0) ?? [];
  const showPrimaryPicker = activeSources.length > 1 || (plan?.conflictCount ?? 0) > 0;
  const safeCount = (plan?.mcp.safe ?? 0) + (plan?.skills.safe ?? 0);

  return (
    <div className="flex flex-col items-end gap-2">
      {(planLoading || plan) && (
        <div className="flex max-w-[24rem] flex-wrap items-center justify-end gap-2 text-xs text-plexus-text-3">
          {planLoading ? (
            <span>Analyzing local agents…</span>
          ) : plan && showPrimaryPicker ? (
            <>
              <span>
                Smart merge: {safeCount} safe · {plan.conflictCount} conflicts
              </span>
              <label className="flex items-center gap-2">
                <span>Primary</span>
                <select
                  className="rounded-md border border-plexus-border bg-white px-2 py-1 text-plexus-text shadow-sm outline-none focus:border-plexus-accent"
                  value={preferredAgent}
                  onChange={(event) => {
                    const next = event.target.value;
                    setPreferredAgent(next);
                    void refreshPlan(next);
                  }}
                >
                  {activeSources.map((source) => (
                    <option key={source.agent} value={source.agent}>
                      {AGENT_LABELS[source.agent] ?? source.agent}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : plan && activeSources[0] ? (
            <span>Source: {AGENT_LABELS[activeSources[0].agent] ?? activeSources[0].agent}</span>
          ) : (
            <span>No local source config yet</span>
          )}
        </div>
      )}
      <Button variant="primary" onClick={run} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
        )}
        {loading ? "Sharing…" : "Share config everywhere"}
      </Button>
      {report && (
        <Card className="w-[22rem] px-4 py-3 text-xs shadow">
          {report.error ? (
            <div className="text-plexus-err">{report.error}</div>
          ) : (
            <div className="space-y-1">
              <div className="mb-2 font-medium text-plexus-text">
                Shared with {report.targetAgents?.length ?? report.results?.length ?? 0} agents
              </div>
              {report.imported && (
                <div className="text-plexus-text-3">
                  imported {report.imported.mcpWritten + report.imported.mcpExtended} MCP ·{" "}
                  {report.imported.skillsWritten + report.imported.skillsExtended} skills
                </div>
              )}
              {report.shared && (
                <div className="text-plexus-text-3">
                  enabled {report.shared.mcp} MCP · {report.shared.skills} skills everywhere
                </div>
              )}
              {report.preferredAgent && (report.conflictsResolved ?? 0) > 0 && (
                <div className="text-plexus-text-3">
                  resolved {report.conflictsResolved} conflicts with{" "}
                  {AGENT_LABELS[report.preferredAgent] ?? report.preferredAgent}
                </div>
              )}
              {report.rules?.skipped ? (
                <div className="text-plexus-warn">{report.rules.skipped}</div>
              ) : (
                <div className="text-plexus-text-3">
                  rules applied to {report.rules?.applied.filter((r) => r.applied).length ?? 0}{" "}
                  targets
                </div>
              )}
              {report.results?.map((r) => (
                <div key={r.agent} className="flex items-center justify-between">
                  <span className="text-plexus-text-2">{r.agent}</span>
                  <span className={r.errors.length > 0 ? "text-plexus-err" : "text-plexus-ok"}>
                    {r.errors.length > 0
                      ? `${r.errors.length} error`
                      : `mcp ${r.applied.mcp} · skills ${r.applied.skills}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
