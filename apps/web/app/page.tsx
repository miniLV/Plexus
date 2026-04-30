import { ImportBanner } from "@/components/import-banner";
import { SyncButton } from "@/components/sync-button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Card, CardHover } from "@/components/ui/card";
import { type RulesPanelStatus, normalizeRulesStatus } from "@/lib/rules";
import { detectAgents, getEffectiveMcp, getEffectiveSkills, teamStatus } from "@plexus/core";
import * as core from "@plexus/core";
import { Clock, ExternalLink, ExternalLink as LinkIcon, PanelsTopLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

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
  const agents = detectAgents();
  const mcp = await getEffectiveMcp();
  const skills = await getEffectiveSkills();
  const team = await teamStatus();
  const rules = await getDashboardRulesStatus();

  const installedCount = agents.filter((a) => a.installed).length;
  const teamCount = mcp.filter((m) => m.authority === "team").length;
  const personalCount = mcp.filter((m) => m.authority === "personal").length;
  const nativeOnlyCount = mcp.filter((m) => m.authority === "native").length;
  const skillTeamCount = skills.filter((s) => s.authority === "team").length;
  const skillPersonalCount = skills.filter((s) => s.authority === "personal").length;
  const skillNativeOnlyCount = skills.filter((s) => s.authority === "native").length;
  const rulesSyncedCount =
    rules?.agents.filter((a) => ["linked", "copied", "in sync"].includes(a.status)).length ?? 0;
  const rulesDriftCount = rules?.agents.filter((a) => a.status === "drift").length ?? 0;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="flex items-end justify-between gap-6">
        <div>
          <h1 className="plexus-display mb-2">Dashboard</h1>
          <p className="max-w-xl text-sm leading-relaxed text-plexus-text-2">
            Click once to import existing agent config, make it shared, and apply it across every
            enabled AI agent on your machine.
          </p>
        </div>
        <SyncButton />
      </section>

      {/* Import banner */}
      <ImportBanner />

      {/* Status pill row */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-plexus-ok opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-plexus-ok" />
          </span>
          <span className="text-sm font-medium">
            {installedCount} of {agents.length} agents detected
          </span>
        </div>
        <span className="text-plexus-text-mute">·</span>
        <span className="text-xs tracking-[0.02em] text-plexus-text-2">
          {mcp.length} MCP servers
        </span>
        <span className="text-plexus-text-mute">·</span>
        <span className="text-xs tracking-[0.02em] text-plexus-text-2">{skills.length} skills</span>
        <span className="text-plexus-text-mute">·</span>
        <span className="text-xs tracking-[0.02em] text-plexus-text-2">
          {rules ? `${rulesSyncedCount}/${rules.agents.length} rules targets` : "rules pending"}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs tracking-[0.02em] text-plexus-text-3">
          <Clock className="h-4 w-4" strokeWidth={1.5} />
          Auto-snapshot enabled
        </div>
      </Card>

      {/* Team subscription state */}
      {team.subscribed ? (
        team.hasUpstreamUpdate ? (
          <Card className="border-l-[3px] border-l-plexus-warn px-5 py-4 text-sm">
            <span className="font-medium text-plexus-warn">⟳ Team updates available</span>{" "}
            <span className="text-plexus-text-3">
              {team.behind} new commit(s) on {team.repoUrl}.
            </span>{" "}
            <Link href="/team" className="text-plexus-accent hover:underline">
              Pull now →
            </Link>
          </Card>
        ) : (
          <Card className="px-5 py-4 text-sm">
            <StatusDot tone="ok" /> Subscribed to{" "}
            <span className="font-mono text-plexus-text">{team.repoUrl}</span>{" "}
            <span className="text-plexus-text-3">— up-to-date.</span>
          </Card>
        )
      ) : null}

      {/* Detected agents */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="plexus-title">Detected agents</h2>
          <span className="text-xs text-plexus-text-3">
            {installedCount} of {agents.length} supported
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {agents.map((a) => {
            const meta = AGENT_DISPLAY[a.id];
            if (!a.installed) {
              return (
                <Card key={a.id} className="px-5 py-4 opacity-70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="plexus-title text-plexus-text-3">{a.displayName}</span>
                        <Badge variant="native">missing</Badge>
                      </div>
                      <div className="mt-1.5 truncate font-mono text-xs text-plexus-text-3">
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
                </Card>
              );
            }
            return (
              <Link key={a.id} href={`/agents/${a.id}`} className="group">
                <CardHover className="cursor-pointer px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="plexus-title">{a.displayName}</span>
                        <Badge variant="synced">
                          <StatusDot tone="ok" /> in sync
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
            <div className="plexus-eyebrow mb-2">Rules</div>
            <div className="mb-2 flex items-end gap-2">
              <div className="plexus-display">{rules ? rulesSyncedCount : "—"}</div>
              <div className="pb-1 text-xs text-plexus-text-3">
                {rules ? `of ${rules.agents.length} in sync` : "core API pending"}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {rules ? (
                <>
                  <Badge variant="synced">synced {rulesSyncedCount}</Badge>
                  <Badge variant={rulesDriftCount > 0 ? "divergent" : "native"}>
                    drift {rulesDriftCount}
                  </Badge>
                </>
              ) : (
                <Badge variant="native">waiting for core</Badge>
              )}
            </div>
          </CardHover>
        </Link>
        <Link href="/mcp">
          <CardHover className="cursor-pointer px-5 py-5">
            <div className="plexus-eyebrow mb-2">MCP Servers</div>
            <div className="plexus-display mb-2">{mcp.length}</div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="team">team {teamCount}</Badge>
              <Badge variant="personal">personal {personalCount}</Badge>
              <Badge variant="native">native-only {nativeOnlyCount}</Badge>
            </div>
          </CardHover>
        </Link>
        <Link href="/skills">
          <CardHover className="cursor-pointer px-5 py-5">
            <div className="plexus-eyebrow mb-2">Skills</div>
            <div className="plexus-display mb-2">{skills.length}</div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="team">team {skillTeamCount}</Badge>
              <Badge variant="personal">personal {skillPersonalCount}</Badge>
              <Badge variant="native">native-only {skillNativeOnlyCount}</Badge>
            </div>
          </CardHover>
        </Link>
      </section>

      {/* Activity hint */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="plexus-title">Recent activity</h2>
          <Link
            href="/backups"
            className="flex items-center gap-1 text-xs text-plexus-accent hover:underline"
          >
            View all backups
            <LinkIcon className="h-3 w-3" strokeWidth={1.5} />
          </Link>
        </div>
        <Card className="px-5 py-8 text-center">
          <PanelsTopLeft className="mx-auto mb-3 h-6 w-6 text-plexus-text-3" strokeWidth={1.5} />
          <div className="text-sm text-plexus-text-2">Activity timeline lands in 1.0 final.</div>
          <div className="mt-1 text-xs text-plexus-text-3">
            Backup snapshots are already being recorded — see{" "}
            <Link href="/backups" className="text-plexus-accent hover:underline">
              Backups
            </Link>
            .
          </div>
        </Card>
      </section>

      <footer className="flex items-center justify-between border-t border-plexus-border pt-6 text-xs text-plexus-text-mute">
        <div>Plexus is local-only and telemetry-free.</div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/miniLV/Plexus" className="hover:text-plexus-text-2">
            GitHub
          </a>
          <Link href="/settings" className="hover:text-plexus-text-2">
            Privacy pledge
          </Link>
        </div>
      </footer>
    </div>
  );
}
