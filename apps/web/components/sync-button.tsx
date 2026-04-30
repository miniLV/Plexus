"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

interface SyncReport {
  mode?: "share-all";
  targetAgents?: string[];
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
  const [report, setReport] = useState<SyncReport | null>(null);

  async function run() {
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = (await res.json()) as SyncReport;
      setReport(data);
      if (!data.error) {
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (e) {
      setReport({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
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
