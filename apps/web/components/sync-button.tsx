"use client";

import { AgentName } from "@/components/agent-icon";
import { useLanguage } from "@/components/language-provider";
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

const COPY = {
  en: {
    chooseSource: "Choose source",
    analyzing: "Analyzing local agents...",
    smartMerge: (safe: number, conflicts: number) =>
      `Smart merge: ${safe} safe · ${conflicts} conflicts`,
    primary: "Primary",
    source: "Source:",
    noSource: "No local source config yet",
    sharing: "Sharing...",
    share: "Share config everywhere",
    shareFailed: "Share failed",
    configShared: "Config shared",
    syncedWith: (count: number) => `Synced with ${count} agents.`,
    close: "Close",
    imported: "Imported",
    enabled: "Enabled",
    skills: "skills",
    resolved: (count: number, agent: string) => `Resolved ${count} conflicts with ${agent}.`,
    rulesApplied: (count: number) => `Rules applied to ${count} targets.`,
    error: "error",
    done: "Done",
  },
  zh: {
    chooseSource: "选择来源",
    analyzing: "正在分析本地 Agent...",
    smartMerge: (safe: number, conflicts: number) =>
      `智能合并：${safe} 个安全 · ${conflicts} 个冲突`,
    primary: "主来源",
    source: "来源：",
    noSource: "还没有本地来源配置",
    sharing: "正在同步...",
    share: "同步到所有配置",
    shareFailed: "同步失败",
    configShared: "配置已同步",
    syncedWith: (count: number) => `已同步到 ${count} 个 Agent。`,
    close: "关闭",
    imported: "已导入",
    enabled: "已启用",
    skills: "技能",
    resolved: (count: number, agent: string) => `已使用 ${agent} 解决 ${count} 个冲突。`,
    rulesApplied: (count: number) => `规则已应用到 ${count} 个目标。`,
    error: "错误",
    done: "完成",
  },
};

export function SyncButton() {
  const { locale } = useLanguage();
  const copy = COPY[locale];
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
  const preferredLabel = preferredAgent ? agentDisplayName(preferredAgent) : copy.chooseSource;

  return (
    <div className="flex flex-col items-end gap-2">
      {(planLoading || plan) && (
        <div className="flex max-w-[30rem] flex-wrap items-center justify-end gap-2 text-xs text-plexus-text-3">
          {planLoading ? (
            <span className="inline-flex h-8 items-center rounded border border-plexus-border bg-plexus-surface px-2.5">
              {copy.analyzing}
            </span>
          ) : plan && showPrimaryPicker ? (
            <>
              <span className="inline-flex h-8 items-center gap-2 rounded border border-plexus-border bg-plexus-surface px-2.5">
                <StatusDot tone={plan.conflictCount > 0 ? "warn" : "ok"} />
                {copy.smartMerge(safeCount, plan.conflictCount)}
              </span>
              <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-2 rounded border border-plexus-border bg-plexus-surface px-2.5 text-xs text-plexus-text-2 shadow-sm outline-none transition-colors hover:border-plexus-border-strong hover:bg-plexus-surface-2 focus-visible:ring-2 focus-visible:ring-plexus-accent/45"
                  >
                    <span className="text-plexus-text-3">{copy.primary}</span>
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
              <span>{copy.source}</span>
              <AgentName agentId={activeSources[0].agent} iconSize="xs" />
            </span>
          ) : (
            <span className="inline-flex h-8 items-center rounded border border-plexus-border bg-plexus-surface px-2.5">
              {copy.noSource}
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
        {loading ? copy.sharing : copy.share}
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
                  {report.error ? copy.shareFailed : copy.configShared}
                </div>
                {!report.error ? (
                  <div className="mt-1 text-xs text-plexus-text-3">
                    {copy.syncedWith(report.targetAgents?.length ?? report.results?.length ?? 0)}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={copy.close}
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
                        <div className="plexus-eyebrow mb-1">{copy.imported}</div>
                        <div className="text-sm font-medium text-plexus-text">
                          {report.imported.mcpWritten + report.imported.mcpExtended} MCP ·{" "}
                          {report.imported.skillsWritten + report.imported.skillsExtended}{" "}
                          {copy.skills}
                        </div>
                      </div>
                    ) : null}
                    {report.shared ? (
                      <div className="rounded border border-plexus-border bg-plexus-surface-2/50 px-3 py-2">
                        <div className="plexus-eyebrow mb-1">{copy.enabled}</div>
                        <div className="text-sm font-medium text-plexus-text">
                          {report.shared.mcp} MCP · {report.shared.skills} {copy.skills}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {report.preferredAgent && (report.conflictsResolved ?? 0) > 0 ? (
                      <div className="text-xs text-plexus-text-3">
                        {copy.resolved(
                          report.conflictsResolved ?? 0,
                          agentDisplayName(report.preferredAgent),
                        )}
                      </div>
                    ) : null}
                    {report.rules?.skipped ? (
                      <div className="text-xs text-plexus-warn">{report.rules.skipped}</div>
                    ) : (
                      <div className="text-xs text-plexus-text-3">
                        {copy.rulesApplied(
                          report.rules?.applied.filter((result) => result.applied).length ?? 0,
                        )}
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
                            <Badge variant="danger">
                              {result.errors.length} {copy.error}
                            </Badge>
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
                {copy.done}
              </Button>
            </div>
          </dialog>
        </div>
      ) : null}
    </div>
  );
}
