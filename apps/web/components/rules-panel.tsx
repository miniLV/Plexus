"use client";

import { useLanguage } from "@/components/language-provider";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type RulesPanelStatus, normalizeRulesStatus } from "@/lib/rules";
import { cn } from "@/lib/utils";
import {
  ArrowDownToLine,
  CheckCircle2,
  FileText,
  Link2,
  Link2Off,
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
  if (status === "local only") return "info";
  if (status === "missing" || status === "disabled" || status === "not installed") return "mute";
  return "info";
}

function statusVariant(status: string): "synced" | "divergent" | "native" | "outline" {
  if (status === "linked" || status === "copied" || status === "in sync") return "synced";
  if (status === "drift") return "divergent";
  if (status === "local only") return "outline";
  if (status === "missing" || status === "disabled" || status === "not installed") return "native";
  return "outline";
}

const COPY = {
  en: {
    title: "Global Rules",
    unsaved: "unsaved",
    saved: "saved",
    refresh: "Refresh",
    save: "Save",
    apply: "Apply to detected agents",
    applyDirtyTitle: "Save the baseline before applying it.",
    placeholder: "Write the shared operating rules every agent should receive.",
    notSavedYet: "Not saved yet",
    refreshFailed: "Could not refresh rules status.",
    saveFailed: "Could not save rules.",
    savedMessage: "Saved to personal rules baseline.",
    applyFailed: "Could not apply rules.",
    appliedMessage: "Applied rules to detected agents.",
    importFailed: "Could not import rules.",
    importedMessage: "Imported agent rules into the personal baseline.",
    detachFailed: "Could not detach rules.",
    linkFailed: "Could not link rules.",
    targets: "Targets",
    targetsUsingBaseline: (synced: number, total: number) =>
      `${synced} of ${total} targets using baseline`,
    pendingSave: "pending save",
    baselineReady: "baseline ready",
    explanation:
      "Plexus writes the same baseline to Claude Code as CLAUDE.md and to other tools as AGENTS.md. Managed link means the agent file is a symlink to this baseline. Detach keeps a local copy for that agent; Re-link replaces that agent's file with the current baseline and keeps a backup.",
    lastUpdated: "Last updated:",
    agentTarget: "Agent target",
    status: "Status",
    noTargets: "Rules targets are waiting for the core rules API.",
    noApplyRecord: "no apply record",
    appliedAt: (value: string) => `applied ${value}`,
    import: "Import",
    detach: "Detach",
    link: "Link",
    relink: "Re-link",
    detachDirtyTitle: "Save or discard baseline edits before detaching.",
    relinkDirtyTitle: "Save the baseline before linking it.",
    privacy:
      "Rules are plain text and user-authored. This page does not read or reveal MCP command environment variables or tokens.",
    managedLink: "managed link",
    localCopy: "local copy",
    detachConfirm: (name: string) =>
      `Detach ${name} from Global Rules?\n\n${name} will keep the current rules as a local file. Future edits to Global Rules will not affect it until you re-link it.`,
    relinkConfirm: (name: string) =>
      `Re-link ${name} to Global Rules?\n\nThis replaces ${name}'s current instruction file with the saved Plexus baseline. Plexus snapshots the current file first, so you can restore it from Backups.`,
    detachedMessage: (name: string) => `Detached ${name}. It now has a local rules file.`,
    linkedMessage: (name: string) => `Linked ${name} to Global Rules.`,
  },
  zh: {
    title: "全局规则",
    unsaved: "未保存",
    saved: "已保存",
    refresh: "刷新",
    save: "保存",
    apply: "应用到已检测 Agent",
    applyDirtyTitle: "先保存基线，再应用到 Agent。",
    placeholder: "写下所有 Agent 都应该读取的共享规则。",
    notSavedYet: "尚未保存",
    refreshFailed: "无法刷新规则状态。",
    saveFailed: "无法保存规则。",
    savedMessage: "已保存到个人规则基线。",
    applyFailed: "无法应用规则。",
    appliedMessage: "已应用规则到已检测 Agent。",
    importFailed: "无法导入规则。",
    importedMessage: "已把该 Agent 的规则导入个人基线。",
    detachFailed: "无法解除规则同步。",
    linkFailed: "无法链接规则。",
    targets: "目标",
    targetsUsingBaseline: (synced: number, total: number) => `${synced}/${total} 个目标使用基线`,
    pendingSave: "待保存",
    baselineReady: "基线就绪",
    explanation:
      "Plexus 会把同一份基线写给 Claude Code 的 CLAUDE.md，也会写给其他工具的 AGENTS.md。托管链接表示 Agent 文件是指向这份基线的软链接。解除同步会为该 Agent 保留一份本地副本；重新链接会用当前基线替换该 Agent 文件，并先做备份。",
    lastUpdated: "最近更新：",
    agentTarget: "Agent 目标",
    status: "状态",
    noTargets: "规则目标正在等待核心规则 API。",
    noApplyRecord: "暂无应用记录",
    appliedAt: (value: string) => `已应用 ${value}`,
    import: "导入",
    detach: "解除同步",
    link: "链接",
    relink: "重新链接",
    detachDirtyTitle: "先保存或放弃基线改动，再解除同步。",
    relinkDirtyTitle: "先保存基线，再重新链接。",
    privacy: "Rules 是用户编写的纯文本。本页面不会读取或暴露 MCP 命令环境变量或 token。",
    managedLink: "托管链接",
    localCopy: "本地副本",
    detachConfirm: (name: string) =>
      `确定要让 ${name} 解除全局规则同步吗？\n\n${name} 会保留当前规则作为本地文件。之后全局规则的改动不会影响它，除非你重新链接。`,
    relinkConfirm: (name: string) =>
      `确定要把 ${name} 重新链接到全局规则吗？\n\n这会用已保存的 Plexus 基线替换 ${name} 当前的指令文件。Plexus 会先做快照，你可以在备份页恢复。`,
    detachedMessage: (name: string) => `${name} 已解除同步，现在使用本地规则文件。`,
    linkedMessage: (name: string) => `${name} 已链接到全局规则。`,
  },
};

type Copy = (typeof COPY)["en"];

function statusLabel(status: string, copy: Copy): string {
  if (status === "linked") return copy.managedLink;
  if (status === "copied" || status === "in sync") return copy.localCopy;
  return status;
}

function fmtUpdatedAt(value: string | undefined, copy: Copy, locale: "en" | "zh") {
  if (!value) return copy.notSavedYet;
  return new Date(value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
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
  const { locale } = useLanguage();
  const copy = COPY[locale];
  const [status, setStatus] = useState<RulesStatus>(initial);
  const [content, setContent] = useState(initial.content ?? "");
  const [busy, setBusy] = useState<"save" | "apply" | "refresh" | string | null>(null);
  const [message, setMessage] = useState<string | null>(initial.unavailableReason ?? null);

  const dirty = content !== (status.content ?? "");
  const targetAgents = useMemo(
    () => status.agents.filter((agent) => agent.installed !== false && agent.enabled !== false),
    [status.agents],
  );
  const syncedAgents = useMemo(
    () =>
      targetAgents.filter((agent) => ["linked", "copied", "in sync"].includes(agent.status)).length,
    [targetAgents],
  );

  async function refresh(nextMessage?: string) {
    setBusy("refresh");
    try {
      const res = await fetch("/api/rules");
      if (!res.ok) {
        setMessage(await readError(res, copy.refreshFailed));
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
        setMessage(await readError(res, copy.saveFailed));
        return;
      }
      const next = normalizeStatus((await res.json()) as ApiResult);
      setStatus(next);
      setContent(next.content ?? content);
      setMessage(copy.savedMessage);
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
        setMessage(await readError(res, copy.applyFailed));
        return;
      }
      const next = normalizeStatus((await res.json()) as ApiResult);
      setStatus(next);
      setContent(next.content ?? content);
      setMessage(copy.appliedMessage);
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
        setMessage(await readError(res, copy.importFailed));
        return;
      }
      const next = normalizeStatus((await res.json()) as ApiResult);
      setStatus(next);
      setContent(next.content ?? "");
      setMessage(copy.importedMessage);
    } finally {
      setBusy(null);
    }
  }

  async function detachAgent(agentId: string, displayName: string) {
    const ok = confirm(copy.detachConfirm(displayName));
    if (!ok) return;

    setBusy(`detach:${agentId}`);
    setMessage(null);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "detach", agentId }),
      });
      if (!res.ok) {
        setMessage(await readError(res, copy.detachFailed));
        return;
      }
      const next = normalizeStatus((await res.json()) as ApiResult);
      setStatus(next);
      setContent(next.content ?? content);
      setMessage(copy.detachedMessage(displayName));
    } finally {
      setBusy(null);
    }
  }

  async function relinkAgent(agentId: string, displayName: string, currentStatus: string) {
    if (currentStatus !== "missing" && !confirm(copy.relinkConfirm(displayName))) return;
    setBusy(`relink:${agentId}`);
    setMessage(null);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "relink", agentId }),
      });
      if (!res.ok) {
        setMessage(await readError(res, copy.linkFailed));
        return;
      }
      const next = normalizeStatus((await res.json()) as ApiResult);
      setStatus(next);
      setContent(next.content ?? content);
      setMessage(copy.linkedMessage(displayName));
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
              <h2 className="plexus-title">{copy.title}</h2>
              {dirty ? (
                <Badge variant="divergent">{copy.unsaved}</Badge>
              ) : (
                <Badge variant="synced">{copy.saved}</Badge>
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
              {copy.refresh}
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
              {copy.save}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={applyToAll}
              disabled={busy != null || dirty || disabled}
              title={dirty ? copy.applyDirtyTitle : undefined}
            >
              {busy === "apply" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <SendHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              {copy.apply}
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
          placeholder={copy.placeholder}
          spellCheck={false}
        />
      </Card>

      <div className="space-y-4">
        <Card className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="plexus-eyebrow mb-1">{copy.targets}</div>
              <div className="text-sm text-plexus-text-2">
                {copy.targetsUsingBaseline(syncedAgents, targetAgents.length)}
              </div>
            </div>
            <Badge variant={dirty ? "divergent" : "synced"}>
              <StatusDot tone={dirty ? "warn" : "ok"} />
              {dirty ? copy.pendingSave : copy.baselineReady}
            </Badge>
          </div>
          <div className="mt-4 text-xs leading-relaxed text-plexus-text-3">{copy.explanation}</div>
          <div className="mt-3 text-xs text-plexus-text-3">
            {copy.lastUpdated}{" "}
            <span className="text-plexus-text-2">
              {fmtUpdatedAt(status.updatedAt, copy, locale)}
            </span>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] border-b border-plexus-border px-4 py-3 text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
            <div>{copy.agentTarget}</div>
            <div>{copy.status}</div>
          </div>
          {targetAgents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-plexus-text-3">{copy.noTargets}</div>
          ) : (
            targetAgents.map((agent) => {
              const importBusy = busy === `import:${agent.agentId}`;
              const detachBusy = busy === `detach:${agent.agentId}`;
              const relinkBusy = busy === `relink:${agent.agentId}`;
              const displayName = agent.displayName ?? agent.agentId;
              const canEdit =
                busy == null &&
                !disabled &&
                agent.status !== "disabled" &&
                agent.status !== "not installed";
              const canLink = canEdit && !dirty;
              const isLinked = agent.status === "linked";
              const showRelink =
                !isLinked && agent.status !== "disabled" && agent.status !== "not installed";
              return (
                <div
                  key={agent.agentId}
                  className="border-b border-plexus-border/60 px-4 py-3 last:border-0 hover:bg-plexus-surface-2/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-plexus-text">{displayName}</div>
                      <code className="mt-1 block truncate font-mono text-xs text-plexus-text-3">
                        {agent.targetPath}
                      </code>
                    </div>
                    <Badge variant={statusVariant(agent.status)}>
                      <StatusDot tone={statusTone(agent.status)} />
                      {statusLabel(agent.status, copy)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-plexus-text-mute">
                      {agent.lastAppliedAt
                        ? copy.appliedAt(fmtUpdatedAt(agent.lastAppliedAt, copy, locale))
                        : copy.noApplyRecord}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {!isLinked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => importFromAgent(agent.agentId)}
                          disabled={busy != null || disabled || agent.status === "missing"}
                        >
                          {importBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={1.5} />
                          )}
                          {copy.import}
                        </Button>
                      ) : null}
                      {isLinked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => detachAgent(agent.agentId, displayName)}
                          disabled={busy != null || disabled || dirty}
                          title={dirty ? copy.detachDirtyTitle : undefined}
                        >
                          {detachBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <Link2Off className="h-3.5 w-3.5" strokeWidth={1.5} />
                          )}
                          {copy.detach}
                        </Button>
                      ) : null}
                      {showRelink ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => relinkAgent(agent.agentId, displayName, agent.status)}
                          disabled={!canLink}
                          title={dirty ? copy.relinkDirtyTitle : undefined}
                        >
                          {relinkBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          )}
                          {agent.status === "missing" ? copy.link : copy.relink}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </Card>

        <Card className="flex items-start gap-3 px-5 py-4 text-sm text-plexus-text-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-plexus-ok" strokeWidth={1.5} />
          <div>{copy.privacy}</div>
        </Card>
      </div>
    </div>
  );
}
