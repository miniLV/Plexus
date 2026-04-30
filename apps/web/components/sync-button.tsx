"use client";

import { AgentName } from "@/components/agent-icon";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { agentDisplayName } from "@/lib/agent-metadata";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(true);
  const [plan, setPlan] = useState<SharePlan | null>(null);
  const [preferredAgent, setPreferredAgent] = useState("");
  const [report, setReport] = useState<SyncReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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
      setReportOpen(true);
      if (data.plan) setPlan(data.plan);
      if (!data.error) {
        router.refresh();
        void refreshPlan(preferredAgent || undefined);
      }
    } catch (e) {
      setReport({ error: String(e) });
      setReportOpen(true);
    } finally {
      setLoading(false);
    }
  }

  const activeSources = plan?.sources.filter((source) => source.total > 0) ?? [];
  const showPrimaryPicker = activeSources.length > 1 || (plan?.conflictCount ?? 0) > 0;
  const safeCount = (plan?.mcp.safe ?? 0) + (plan?.skills.safe ?? 0);
  const preferredLabel = preferredAgent ? agentDisplayName(preferredAgent) : "Choose source";

  return (
    <div className="flex flex-col items-end gap-2">
      {(planLoading || plan) && (
        <div className="flex max-w-[30rem] flex-wrap items-center justify-end gap-2 text-xs text-plexus-text-3">
          {planLoading ? (
            <span className="inline-flex h-8 items-center rounded border border-plexus-border bg-plexus-surface px-2.5">
              Analyzing local agents…
            </span>
          ) : plan && showPrimaryPicker ? (
            <>
              <span className="inline-flex h-8 items-center gap-2 rounded border border-plexus-border bg-plexus-surface px-2.5">
                <StatusDot tone={plan.conflictCount > 0 ? "warn" : "ok"} />
                Smart merge: {safeCount} safe · {plan.conflictCount} conflicts
              </span>
              <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-2 rounded border border-plexus-border bg-plexus-surface px-2.5 text-xs text-plexus-text-2 shadow-sm outline-none transition-colors hover:border-plexus-border-strong hover:bg-plexus-surface-2 focus-visible:ring-2 focus-visible:ring-plexus-accent/45"
                  >
                    <span className="text-plexus-text-3">Primary</span>
                    {preferredAgent ? (
                      <AgentName
                        agentId={preferredAgent}
                        label={preferredLabel}
                        iconSize="xs"
                        labelClassName="font-medium text-plexus-text"
                      />
                    ) : (
                      <span className="font-medium text-plexus-text">{preferredLabel}</span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 text-plexus-text-3" strokeWidth={1.5} />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="end"
                    sideOffset={6}
                    className="z-50 w-64 overflow-hidden rounded-md border border-plexus-border bg-plexus-surface p-1 shadow-lg outline-none animate-in fade-in-0 zoom-in-95"
                  >
                    {activeSources.map((source) => {
                      const selected = source.agent === preferredAgent;
                      return (
                        <button
                          type="button"
                          key={source.agent}
                          className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm text-plexus-text transition-colors hover:bg-plexus-surface-2 focus:bg-plexus-surface-2 focus:outline-none"
                          onClick={() => {
                            setPreferredAgent(source.agent);
                            setPickerOpen(false);
                            void refreshPlan(source.agent);
                          }}
                        >
                          <span>
                            <AgentName
                              agentId={source.agent}
                              iconSize="xs"
                              labelClassName="font-medium"
                            />
                            <span className="mt-0.5 block font-mono text-[11px] text-plexus-text-3">
                              {source.mcp} MCP · {source.skills} skills
                              {source.rules ? " · rules" : ""}
                            </span>
                          </span>
                          {selected ? (
                            <Check className="h-4 w-4 text-plexus-ok" strokeWidth={1.7} />
                          ) : null}
                        </button>
                      );
                    })}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </>
          ) : plan && activeSources[0] ? (
            <span className="inline-flex h-8 items-center gap-2 rounded border border-plexus-border bg-plexus-surface px-2.5">
              <span>Source:</span>
              <AgentName agentId={activeSources[0].agent} iconSize="xs" />
            </span>
          ) : (
            <span className="inline-flex h-8 items-center rounded border border-plexus-border bg-plexus-surface px-2.5">
              No local source config yet
            </span>
          )}
        </div>
      )}
      <Button
        variant="secondary"
        className="border-plexus-accent/35 bg-plexus-accent/10 text-plexus-text shadow-sm hover:border-plexus-accent/55 hover:bg-plexus-accent/15"
        onClick={run}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
        )}
        {loading ? "Sharing…" : "Share config everywhere"}
      </Button>

      {reportOpen && report ? (
        <div
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-black/55 p-6"
          onClick={() => setReportOpen(false)}
        >
          <dialog
            open
            aria-modal="true"
            className="w-full max-w-lg cursor-default overflow-hidden rounded-md border border-plexus-border bg-plexus-surface text-left shadow-lg"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-plexus-border px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-plexus-text">
                  <StatusDot tone={report.error ? "err" : "ok"} />
                  {report.error ? "Share failed" : "Config shared"}
                </div>
                {!report.error ? (
                  <div className="mt-1 text-xs text-plexus-text-3">
                    Synced with {report.targetAgents?.length ?? report.results?.length ?? 0} agents.
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close"
                className="rounded-sm p-1 text-plexus-text-3 hover:bg-plexus-surface-2 hover:text-plexus-text"
                onClick={() => setReportOpen(false)}
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4 text-sm">
              {report.error ? (
                <div className="rounded border border-plexus-err/30 bg-plexus-err/10 px-3 py-2 text-xs text-plexus-err">
                  {report.error}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {report.imported ? (
                      <div className="rounded border border-plexus-border bg-plexus-surface-2/50 px-3 py-2">
                        <div className="plexus-eyebrow mb-1">Imported</div>
                        <div className="text-sm font-medium text-plexus-text">
                          {report.imported.mcpWritten + report.imported.mcpExtended} MCP ·{" "}
                          {report.imported.skillsWritten + report.imported.skillsExtended} skills
                        </div>
                      </div>
                    ) : null}
                    {report.shared ? (
                      <div className="rounded border border-plexus-border bg-plexus-surface-2/50 px-3 py-2">
                        <div className="plexus-eyebrow mb-1">Enabled</div>
                        <div className="text-sm font-medium text-plexus-text">
                          {report.shared.mcp} MCP · {report.shared.skills} skills
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {report.preferredAgent && (report.conflictsResolved ?? 0) > 0 ? (
                      <div className="text-xs text-plexus-text-3">
                        Resolved {report.conflictsResolved} conflicts with{" "}
                        <span className="text-plexus-text">
                          {agentDisplayName(report.preferredAgent)}
                        </span>
                        .
                      </div>
                    ) : null}
                    {report.rules?.skipped ? (
                      <div className="text-xs text-plexus-warn">{report.rules.skipped}</div>
                    ) : (
                      <div className="text-xs text-plexus-text-3">
                        Rules applied to{" "}
                        {report.rules?.applied.filter((result) => result.applied).length ?? 0}{" "}
                        targets.
                      </div>
                    )}
                  </div>

                  {report.results && report.results.length > 0 ? (
                    <div className="overflow-hidden rounded border border-plexus-border">
                      {report.results.map((result) => (
                        <div
                          key={result.agent}
                          className="flex items-center justify-between gap-3 border-b border-plexus-border/60 px-3 py-2 text-xs last:border-0"
                        >
                          <AgentName
                            agentId={result.agent}
                            iconSize="xs"
                            labelClassName="text-plexus-text-2"
                          />
                          {result.errors.length > 0 ? (
                            <Badge variant="danger">{result.errors.length} error</Badge>
                          ) : (
                            <span className="font-mono text-plexus-ok">
                              mcp {result.applied.mcp} · skills {result.applied.skills}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex items-center justify-end border-t border-plexus-border bg-plexus-surface-2/35 px-5 py-3">
              <Button variant="secondary" size="sm" onClick={() => setReportOpen(false)}>
                Done
              </Button>
            </div>
          </dialog>
        </div>
      ) : null}
    </div>
  );
}
