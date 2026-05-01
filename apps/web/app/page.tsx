import { AgentName } from "@/components/agent-icon";
import { SyncButton } from "@/components/sync-button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Card, CardHover } from "@/components/ui/card";
import { getServerLocale } from "@/lib/i18n-server";
import { type RulesPanelStatus, normalizeRulesStatus } from "@/lib/rules";
import { Clock, ExternalLink, ExternalLink as LinkIcon, PanelsTopLeft } from "lucide-react";
import Link from "next/link";
import {
  detectAgents,
  getEffectiveMcp,
  getEffectiveSkills,
  teamStatus,
} from "plexus-agent-config-core";
import * as core from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Dashboard",
    description:
      "Click once to import existing agent config, make it shared, and apply it across every enabled AI agent on your machine.",
    agentsDetected: "agents detected",
    mcpServers: "MCP servers",
    skills: "skills",
    rulesPending: "rules pending",
    localInstructionFiles: "local instruction files",
    usingBaseline: "using baseline",
    autoSnapshot: "Auto-snapshot enabled",
    teamUpdatesAvailable: "Team updates available",
    newCommits: "new commit(s) on",
    pullNow: "Pull now",
    subscribedTo: "Subscribed to",
    upToDate: "up-to-date.",
    detectedAgents: "Detected agents",
    configuredTargets: "configured targets",
    detected: "detected",
    noAgents: "No configured AI agents detected yet.",
    rules: "Rules",
    coreApiPending: "core API pending",
    baseline: "baseline",
    localOnly: "local-only",
    drift: "drift",
    waitingForCore: "waiting for core",
    team: "team",
    personal: "personal",
    nativeOnly: "native-only",
    recentActivity: "Recent activity",
    viewAllBackups: "View all backups",
    activitySoon: "Activity timeline lands in 1.0 final.",
    backupHint: "Backup snapshots are already being recorded — see",
    backups: "Backups",
    localOnlyFooter: "Plexus is local-only and telemetry-free.",
    privacyPledge: "Privacy pledge",
  },
  zh: {
    title: "仪表盘",
    description: "一键导入已有 Agent 配置，整理成共享基线，并同步到这台机器上启用的 AI Agent。",
    agentsDetected: "个 Agent 已检测",
    mcpServers: "个 MCP 服务",
    skills: "个技能",
    rulesPending: "规则状态待检测",
    localInstructionFiles: "个本地指令文件",
    usingBaseline: "使用基线",
    autoSnapshot: "自动快照已启用",
    teamUpdatesAvailable: "有团队配置更新",
    newCommits: "个新提交来自",
    pullNow: "立即拉取",
    subscribedTo: "已订阅",
    upToDate: "已是最新。",
    detectedAgents: "已检测 Agent",
    configuredTargets: "个已配置目标",
    detected: "已检测",
    noAgents: "还没有检测到已配置的 AI Agent。",
    rules: "规则",
    coreApiPending: "核心 API 待接入",
    baseline: "基线",
    localOnly: "仅本地",
    drift: "漂移",
    waitingForCore: "等待核心能力",
    team: "团队",
    personal: "个人",
    nativeOnly: "原生独有",
    recentActivity: "最近活动",
    viewAllBackups: "查看全部备份",
    activitySoon: "活动时间线会在 1.0 final 中提供。",
    backupHint: "备份快照已经在记录，可以查看",
    backups: "备份",
    localOnlyFooter: "Plexus 只在本地运行，不发送遥测。",
    privacyPledge: "隐私承诺",
  },
};

const AGENT_DISPLAY: Record<
  string,
  { mode: "shared" | "exclusive"; instructionFile: string; mcpFile: string }
> = {
  "claude-code": {
    mode: "shared",
    instructionFile: "~/.claude/CLAUDE.md",
    mcpFile: "~/.claude.json",
  },
  cursor: {
    mode: "exclusive",
    instructionFile: "~/.cursor/AGENTS.md",
    mcpFile: "~/.cursor/mcp.json",
  },
  codex: {
    mode: "shared",
    instructionFile: "~/.codex/AGENTS.md",
    mcpFile: "~/.codex/config.toml",
  },
  "gemini-cli": {
    mode: "shared",
    instructionFile: "~/.gemini/GEMINI.md",
    mcpFile: "~/.gemini/settings.json",
  },
  "qwen-code": {
    mode: "shared",
    instructionFile: "~/.qwen/QWEN.md",
    mcpFile: "~/.qwen/settings.json",
  },
  "factory-droid": {
    mode: "exclusive",
    instructionFile: "~/.factory/AGENTS.md",
    mcpFile: "~/.factory/mcp.json",
  },
};

type RulesCore = typeof core & {
  getRulesStatus?: () => Promise<unknown> | unknown;
};

async function getDashboardRulesStatus(): Promise<RulesPanelStatus | null> {
  const getRulesStatus = (core as RulesCore).getRulesStatus;
  if (!getRulesStatus) return null;

  try {
    return normalizeRulesStatus(await getRulesStatus());
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];
  const agents = detectAgents();
  const mcp = await getEffectiveMcp();
  const skills = await getEffectiveSkills();
  const team = await teamStatus();
  const rules = await getDashboardRulesStatus();

  const detectedAgents = agents.filter((a) => a.installed);
  const teamCount = mcp.filter((m) => m.authority === "team").length;
  const personalCount = mcp.filter((m) => m.authority === "personal").length;
  const nativeOnlyCount = mcp.filter((m) => m.authority === "native").length;
  const skillTeamCount = skills.filter((s) => s.authority === "team").length;
  const skillPersonalCount = skills.filter((s) => s.authority === "personal").length;
  const skillNativeOnlyCount = skills.filter((s) => s.authority === "native").length;
  const rulesTargets =
    rules?.agents.filter((a) => a.installed !== false && a.enabled !== false) ?? [];
  const rulesLocalCount = rulesTargets.filter((a) =>
    ["linked", "copied", "in sync", "drift", "local only"].includes(a.status),
  ).length;
  const rulesSyncedCount = rulesTargets.filter((a) =>
    ["linked", "copied", "in sync"].includes(a.status),
  ).length;
  const rulesDriftCount = rulesTargets.filter((a) => a.status === "drift").length;
  const rulesLocalOnlyCount = rulesTargets.filter((a) => a.status === "local only").length;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <h1 className="plexus-display mb-2">{copy.title}</h1>
          <p className="max-w-xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
        </div>
        <SyncButton />
      </section>

      {/* Status pill row */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-plexus-ok opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-plexus-ok" />
          </span>
          <span className="text-sm font-medium">
            {detectedAgents.length} {copy.agentsDetected}
          </span>
        </div>
        <span className="text-plexus-text-mute">·</span>
        <span className="text-xs tracking-[0.02em] text-plexus-text-2">
          {mcp.length} {copy.mcpServers}
        </span>
        <span className="text-plexus-text-mute">·</span>
        <span className="text-xs tracking-[0.02em] text-plexus-text-2">
          {skills.length} {copy.skills}
        </span>
        <span className="text-plexus-text-mute">·</span>
        <span className="text-xs tracking-[0.02em] text-plexus-text-2">
          {rules
            ? `${rulesLocalCount} ${copy.localInstructionFiles} · ${rulesSyncedCount}/${rulesTargets.length} ${copy.usingBaseline}`
            : copy.rulesPending}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs tracking-[0.02em] text-plexus-text-3">
          <Clock className="h-4 w-4" strokeWidth={1.5} />
          {copy.autoSnapshot}
        </div>
      </Card>

      {/* Team subscription state */}
      {team.subscribed ? (
        team.hasUpstreamUpdate ? (
          <Card className="border-l-[3px] border-l-plexus-warn px-5 py-4 text-sm">
            <span className="font-medium text-plexus-warn">⟳ {copy.teamUpdatesAvailable}</span>{" "}
            <span className="text-plexus-text-3">
              {team.behind} {copy.newCommits} {team.repoUrl}.
            </span>{" "}
            <Link href="/team" className="text-plexus-accent hover:underline">
              {copy.pullNow} →
            </Link>
          </Card>
        ) : (
          <Card className="px-5 py-4 text-sm">
            <StatusDot tone="ok" /> {copy.subscribedTo}{" "}
            <span className="font-mono text-plexus-text">{team.repoUrl}</span>{" "}
            <span className="text-plexus-text-3">— {copy.upToDate}</span>
          </Card>
        )
      ) : null}

      {/* Detected agents */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="plexus-title">{copy.detectedAgents}</h2>
          <span className="text-xs text-plexus-text-3">
            {detectedAgents.length} {copy.configuredTargets}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {detectedAgents.length === 0 ? (
            <Card className="col-span-2 px-5 py-8 text-center text-sm text-plexus-text-3">
              {copy.noAgents}
            </Card>
          ) : null}
          {detectedAgents.map((a) => {
            const meta = AGENT_DISPLAY[a.id];
            return (
              <Link key={a.id} href={`/agents/${a.id}`} className="group">
                <CardHover className="cursor-pointer px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <AgentName
                          agentId={a.id}
                          label={a.displayName}
                          iconSize="md"
                          labelClassName="plexus-title"
                        />
                        <Badge variant="synced">
                          <StatusDot tone="ok" /> {copy.detected}
                        </Badge>
                        <ExternalLink
                          className="h-3.5 w-3.5 text-plexus-text-mute opacity-0 transition-opacity group-hover:opacity-100"
                          strokeWidth={1.5}
                        />
                      </div>
                      <div className="mt-1.5 truncate font-mono text-xs text-plexus-text-2">
                        {meta?.instructionFile ?? a.rootDir}
                      </div>
                      {meta?.mcpFile && (
                        <div className="truncate font-mono text-[11px] text-plexus-text-mute">
                          mcp · {meta.mcpFile}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-plexus-text-3">{meta?.mode}</span>
                  </div>
                </CardHover>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Link href="/rules">
          <CardHover className="cursor-pointer px-5 py-5">
            <div className="plexus-eyebrow mb-2">{copy.rules}</div>
            <div className="mb-2 flex items-end gap-2">
              <div className="plexus-display">{rules ? rulesLocalCount : "—"}</div>
              <div className="pb-1 text-xs text-plexus-text-3">
                {rules ? copy.localInstructionFiles : copy.coreApiPending}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {rules ? (
                <>
                  <Badge variant="synced">
                    {copy.baseline} {rulesSyncedCount}/{rulesTargets.length}
                  </Badge>
                  <Badge variant="outline">
                    {copy.localOnly} {rulesLocalOnlyCount}
                  </Badge>
                  <Badge variant={rulesDriftCount > 0 ? "divergent" : "native"}>
                    {copy.drift} {rulesDriftCount}
                  </Badge>
                </>
              ) : (
                <Badge variant="native">{copy.waitingForCore}</Badge>
              )}
            </div>
          </CardHover>
        </Link>
        <Link href="/mcp">
          <CardHover className="cursor-pointer px-5 py-5">
            <div className="plexus-eyebrow mb-2">{copy.mcpServers}</div>
            <div className="plexus-display mb-2">{mcp.length}</div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="team">
                {copy.team} {teamCount}
              </Badge>
              <Badge variant="personal">
                {copy.personal} {personalCount}
              </Badge>
              <Badge variant="native">
                {copy.nativeOnly} {nativeOnlyCount}
              </Badge>
            </div>
          </CardHover>
        </Link>
        <Link href="/skills">
          <CardHover className="cursor-pointer px-5 py-5">
            <div className="plexus-eyebrow mb-2">{copy.skills}</div>
            <div className="plexus-display mb-2">{skills.length}</div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="team">
                {copy.team} {skillTeamCount}
              </Badge>
              <Badge variant="personal">
                {copy.personal} {skillPersonalCount}
              </Badge>
              <Badge variant="native">
                {copy.nativeOnly} {skillNativeOnlyCount}
              </Badge>
            </div>
          </CardHover>
        </Link>
      </section>

      {/* Activity hint */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="plexus-title">{copy.recentActivity}</h2>
          <Link
            href="/backups"
            className="flex items-center gap-1 text-xs text-plexus-accent hover:underline"
          >
            {copy.viewAllBackups}
            <LinkIcon className="h-3 w-3" strokeWidth={1.5} />
          </Link>
        </div>
        <Card className="px-5 py-8 text-center">
          <PanelsTopLeft className="mx-auto mb-3 h-6 w-6 text-plexus-text-3" strokeWidth={1.5} />
          <div className="text-sm text-plexus-text-2">{copy.activitySoon}</div>
          <div className="mt-1 text-xs text-plexus-text-3">
            {copy.backupHint}{" "}
            <Link href="/backups" className="text-plexus-accent hover:underline">
              {copy.backups}
            </Link>
            .
          </div>
        </Card>
      </section>

      <footer className="flex items-center justify-between border-t border-plexus-border pt-6 text-xs text-plexus-text-mute">
        <div>{copy.localOnlyFooter}</div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/miniLV/Plexus" className="hover:text-plexus-text-2">
            GitHub
          </a>
          <Link href="/settings" className="hover:text-plexus-text-2">
            {copy.privacyPledge}
          </Link>
        </div>
      </footer>
    </div>
  );
}
