"use client";

import { useLanguage } from "@/components/language-provider";
import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Database, ExternalLink, FileText, Loader2, Mail, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

const AGENT_PRIMER_URL = "https://github.com/miniLV/agent-primer.git";

type Status = {
  subscribed: boolean;
  repoUrl?: string;
  hasUpstreamUpdate?: boolean;
  ahead?: number;
  behind?: number;
  summary?: {
    mcp: number;
    skills: number;
    rules: boolean;
  };
};

const COPY = {
  en: {
    betaTitle: "Team workflow is in beta",
    betaBody:
      "Team subscription, shared baselines, and pull-based updates are already wired. PR proposal and conflict UX are still being refined.",
    starterLink: "View agent-primer starter repo",
    subscribedTo: "Subscribed to",
    upToDate: "Up-to-date",
    updateAvailable: (count?: number) => `${count ?? 0} update${count === 1 ? "" : "s"} available`,
    pullUpdates: "Pull updates",
    pulling: "Pulling…",
    refresh: "Refresh",
    noSubscription: "No team subscription yet",
    noSubscriptionBody:
      "Paste a GitHub repo with Plexus team config. Plexus clones it into ~/.config/plexus/team/ and merges it below your personal layer at sync time.",
    starterTitle: "Recommended starter",
    starterBody:
      "agent-primer is a compact baseline for rules, MCP servers, and reusable skills. Use it as the first team repo, then customize through pull requests.",
    useStarter: "Use agent-primer",
    placeholder: AGENT_PRIMER_URL,
    join: "Join",
    joining: "Joining…",
    rules: "Rules",
    rulesPresent: "present",
    rulesMissing: "missing",
    mcp: "MCP",
    skills: "Skills",
    proposeTitle: "Propose to team",
    proposeBody:
      "To share a personal MCP server, rule, or skill with the rest of the team, copy it into the team repo and open a pull request.",
    steps: [
      "Branch the team repo.",
      "Copy files from ~/.config/plexus/personal/ into the same path under the team repo.",
      "Open a pull request for review.",
      "After merge, pull updates here and sync agents.",
    ],
  },
  zh: {
    betaTitle: "Team 工作流仍处于 beta",
    betaBody: "Team 订阅、共享基线和 pull 更新已经接好。PR proposal 和冲突处理体验还在打磨。",
    starterLink: "查看 agent-primer starter repo",
    subscribedTo: "当前订阅",
    upToDate: "已是最新",
    updateAvailable: (count?: number) => `有 ${count ?? 0} 个更新可拉取`,
    pullUpdates: "拉取更新",
    pulling: "拉取中…",
    refresh: "刷新",
    noSubscription: "还没有订阅 Team repo",
    noSubscriptionBody:
      "填入一个 Plexus team config GitHub repo。Plexus 会 clone 到 ~/.config/plexus/team/，同步时在你的 personal layer 下面合并它。",
    starterTitle: "推荐 starter",
    starterBody:
      "agent-primer 是一套轻量基线，包含 rules、MCP servers 和可复用 skills。可以先用它作为第一个 team repo，再通过 PR 慢慢定制。",
    useStarter: "使用 agent-primer",
    placeholder: AGENT_PRIMER_URL,
    join: "加入",
    joining: "加入中…",
    rules: "Rules",
    rulesPresent: "已提供",
    rulesMissing: "未提供",
    mcp: "MCP",
    skills: "Skills",
    proposeTitle: "提交给团队",
    proposeBody:
      "如果想把个人 MCP、规则或 skill 分享给团队，把它复制进 team repo 并发起 pull request。",
    steps: [
      "在 team repo 建一个 branch。",
      "把 ~/.config/plexus/personal/ 里的文件复制到 team repo 的相同路径。",
      "发起 pull request 等团队 review。",
      "合并后回到这里拉取更新，再同步到各个 agent。",
    ],
  },
};

export function TeamPanel({ status: initial }: { status: Status }) {
  const { locale } = useLanguage();
  const copy = COPY[locale];
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
            <div className="text-sm font-semibold text-plexus-text">{copy.betaTitle}</div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-plexus-text-3">
              {copy.betaBody}
            </p>
            <a
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-plexus-accent hover:underline"
              href="https://github.com/miniLV/agent-primer"
              rel="noreferrer"
              target="_blank"
            >
              {copy.starterLink}
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </Card>

      {/* Subscription */}
      <Card className="p-5">
        {status.subscribed ? (
          <>
            <div className="plexus-eyebrow">{copy.subscribedTo}</div>
            <div className="mt-1 font-mono text-sm text-plexus-text">{status.repoUrl}</div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              {status.hasUpstreamUpdate ? (
                <>
                  <StatusDot tone="warn" />
                  <span className="text-plexus-warn">{copy.updateAvailable(status.behind)}</span>
                </>
              ) : (
                <>
                  <StatusDot tone="ok" />
                  <span className="text-plexus-ok">{copy.upToDate}</span>
                </>
              )}
            </div>
            {status.summary && (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <SummaryItem
                  icon={<FileText className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  label={copy.rules}
                  value={status.summary.rules ? copy.rulesPresent : copy.rulesMissing}
                />
                <SummaryItem
                  icon={<Database className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  label={copy.mcp}
                  value={String(status.summary.mcp)}
                />
                <SummaryItem
                  icon={<BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  label={copy.skills}
                  value={String(status.summary.skills)}
                />
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button variant="primary" size="sm" onClick={pull} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                {busy ? copy.pulling : copy.pullUpdates}
              </Button>
              <Button variant="ghost" size="sm" onClick={refresh} disabled={busy}>
                {copy.refresh}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="plexus-eyebrow">{copy.noSubscription}</div>
            <p className="mt-1 max-w-xl text-xs text-plexus-text-3">{copy.noSubscriptionBody}</p>
            <div className="mt-4 rounded border border-plexus-border bg-plexus-surface-2 p-3">
              <div className="text-xs font-semibold text-plexus-text">{copy.starterTitle}</div>
              <p className="mt-1 text-xs leading-relaxed text-plexus-text-3">{copy.starterBody}</p>
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                onClick={() => setUrl(AGENT_PRIMER_URL)}
              >
                {copy.useStarter}
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={copy.placeholder}
                className="h-9 flex-1 rounded border border-plexus-border bg-plexus-bg px-3 text-sm placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
              />
              <Button variant="primary" onClick={join} disabled={busy || !url}>
                {busy ? copy.joining : copy.join}
              </Button>
            </div>
          </>
        )}
        {msg && <div className="mt-3 text-xs text-plexus-text-3">{msg}</div>}
      </Card>

      {/* Propose to team */}
      <Card className="p-5">
        <div className="text-sm font-semibold text-plexus-text">{copy.proposeTitle}</div>
        <p className="mt-1 text-xs leading-relaxed text-plexus-text-3">{copy.proposeBody}</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-plexus-text-3">
          {copy.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-plexus-border bg-plexus-bg px-3 py-2">
      <span className="text-plexus-text-3">{icon}</span>
      <span className="text-xs text-plexus-text-3">{label}</span>
      <span className="ml-auto text-xs font-semibold text-plexus-text">{value}</span>
    </div>
  );
}
