"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Database,
  FileText,
  GitBranch,
  Plug,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { type ReactNode, useState } from "react";

type FocusKey = "overview" | "rules" | "skills" | "mcp" | "safety";

const COPY = {
  en: {
    badge: "local-first architecture",
    title: "One source, native files everywhere.",
    description:
      "Plexus keeps a canonical store under ~/.config/plexus, then projects rules, skills, and MCP servers back into each agent using the least invasive reversible mechanism.",
    openDoc: "Open static design",
    source: "Native import",
    store: "Canonical store",
    projection: "Native projection",
    team: "team",
    personal: "personal",
    effective: "effective merge",
    agentFiles: "agent files",
    conflict: "primary source resolves conflicts",
    backups: "snapshots before writes",
    tabs: {
      overview: "Overview",
      rules: "Rules",
      skills: "Skills",
      mcp: "MCP",
      safety: "Safety",
    },
    detail: {
      overview: {
        title: "Why this is the best default",
        body: "The design optimizes for local safety: keep one canonical store, preserve each agent's native format, and use symlinks only where the whole target can safely point at Plexus.",
        bullets: [
          "Team and personal layers merge into one effective view.",
          "Personal entries override team entries with the same ID.",
          "Every enabled agent keeps reading its official native path.",
        ],
      },
      rules: {
        title: "Rules use file-level symlinks",
        body: "Claude.md, AGENTS.md, and GEMINI.md are instruction files. Plexus stores a single baseline at rules/global.md and links agent-native filenames to it.",
        bullets: [
          "Canonical: ~/.config/plexus/personal/rules/global.md",
          "Targets: ~/.claude/CLAUDE.md, ~/.codex/AGENTS.md, ~/.gemini/GEMINI.md",
          "Fallback: copy when symlinks are unavailable.",
        ],
      },
      skills: {
        title: "Skills use directory-level symlinks",
        body: "A skill is already a folder with SKILL.md inside, so Plexus can share the same directory across agents without translating the content.",
        bullets: [
          "Canonical: skills/<id>/SKILL.md with Plexus frontmatter.",
          "Targets: ~/.claude/skills/<id>, ~/.codex/skills/<id>, ~/.factory/skills/<id>.",
          "Per-agent enablement lives in plexus_enabled_agents.",
        ],
      },
      mcp: {
        title: "MCP uses a hybrid adapter",
        body: "Some MCP files are single-purpose and can be owned by Plexus. Others contain auth, profiles, history, or UI state, so Plexus rewrites only the MCP section.",
        bullets: [
          "Shared files: partial-write mcpServers or mcp_servers only.",
          "Exclusive files: native MCP path links to ~/.config/plexus/.cache/mcp/<agent>.json.",
          "Formats stay native: JSON for most agents, TOML for Codex.",
        ],
      },
      safety: {
        title: "Safety is built into every write",
        body: "The sync layer snapshots native files before mutation and quarantines real files or directories that block Plexus-managed symlinks.",
        bullets: [
          "Snapshots live under ~/.config/plexus/backups.",
          "Collisions move to backups/_collisions instead of being overwritten.",
          "Detach can turn a Plexus-owned instruction symlink back into a local file.",
        ],
      },
    },
  },
  zh: {
    badge: "本地优先架构",
    title: "一个源，投射到所有 Agent 原生文件。",
    description:
      "Plexus 把配置统一放在 ~/.config/plexus，再用最少侵入、可回滚的方式同步到每个 Agent 原本会读取的位置。",
    openDoc: "打开静态设计图",
    source: "原生导入",
    store: "统一配置源",
    projection: "原生投射",
    team: "团队层",
    personal: "个人层",
    effective: "合并后的生效视图",
    agentFiles: "Agent 原生文件",
    conflict: "Primary source 解决冲突",
    backups: "写入前自动备份",
    tabs: {
      overview: "总览",
      rules: "规则",
      skills: "Skills",
      mcp: "MCP",
      safety: "安全回滚",
    },
    detail: {
      overview: {
        title: "为什么这是当前最好的默认解",
        body: "这个方案优先保证本地安全：统一配置源只放在 Plexus store，每个 Agent 仍读取自己的官方路径，只在能完整托管的地方使用软链接。",
        bullets: [
          "Team 和 personal 两层会合并成一个 effective view。",
          "同 ID 时个人配置覆盖团队配置。",
          "每个启用的 Agent 仍然读取它自己的原生路径。",
        ],
      },
      rules: {
        title: "Rules 使用文件级软链接",
        body: "CLAUDE.md、AGENTS.md、GEMINI.md 这类 instruction file 会共享同一个 global.md，但每个 Agent 看到的仍是自己的官方文件名。",
        bullets: [
          "统一源：~/.config/plexus/personal/rules/global.md",
          "目标：~/.claude/CLAUDE.md、~/.codex/AGENTS.md、~/.gemini/GEMINI.md",
          "如果系统不支持软链接，会 fallback 到 copy。",
        ],
      },
      skills: {
        title: "Skills 使用目录级软链接",
        body: "Skill 本身就是一个包含 SKILL.md 的目录，所以最干净的方式是让多个 Agent 的 skill 目录指向同一个 Plexus 目录。",
        bullets: [
          "统一源：skills/<id>/SKILL.md，带 Plexus frontmatter。",
          "目标：~/.claude/skills/<id>、~/.codex/skills/<id>、~/.factory/skills/<id>。",
          "是否同步给某个 Agent 由 plexus_enabled_agents 控制。",
        ],
      },
      mcp: {
        title: "MCP 使用 hybrid adapter",
        body: "有些 MCP 文件是专用文件，可以完全由 Plexus 托管；有些文件还包含 auth、profile、历史记录或 UI 状态，只能局部写入。",
        bullets: [
          "shared 文件：只局部改写 mcpServers 或 mcp_servers。",
          "exclusive 文件：Agent 的 MCP 路径软链接到 ~/.config/plexus/.cache/mcp/<agent>.json。",
          "格式保持原生：大多数是 JSON，Codex 是 TOML。",
        ],
      },
      safety: {
        title: "每次写入都先保护现场",
        body: "同步层在修改原生路径前会做 snapshot；如果目标位置已有真实文件或目录，会先移动到 collision 备份区。",
        bullets: [
          "快照在 ~/.config/plexus/backups。",
          "冲突文件进入 backups/_collisions，不会原地覆盖。",
          "Detach 可以把 Plexus 管理的 instruction symlink 还原成本地文件。",
        ],
      },
    },
  },
};

const flow = [
  {
    id: "rules",
    label: "Rules",
    icon: FileText,
    color: "text-plexus-ok",
    line: "rules/global.md -> CLAUDE.md / AGENTS.md / GEMINI.md",
  },
  {
    id: "skills",
    label: "Skills",
    icon: Sparkles,
    color: "text-plexus-info",
    line: "skills/<id>/ -> agent skills or commands directory",
  },
  {
    id: "mcp",
    label: "MCP",
    icon: Plug,
    color: "text-plexus-accent",
    line: "servers.yaml -> partial-write or cache symlink",
  },
];

export function ArchitecturePanel({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  const [focus, setFocus] = useState<FocusKey>("overview");
  const detail = copy.detail[focus];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="border-b border-plexus-border bg-plexus-surface-2/35 px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Badge variant="beta">{copy.badge}</Badge>
            <Button asChild variant="ghost" size="sm">
              <a href="/architecture/config-sharing-map.html" target="_blank" rel="noreferrer">
                {copy.openDoc}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </a>
            </Button>
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-plexus-text">
            {copy.title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-plexus-text-2">
            {copy.description}
          </p>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="rounded-md border border-plexus-border bg-plexus-bg p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr_1fr]">
              <DiagramColumn
                title={copy.source}
                items={[copy.agentFiles, copy.conflict, copy.backups]}
                icon={<GitBranch className="h-4 w-4" strokeWidth={1.5} />}
              />

              <div className="relative rounded-md border border-plexus-accent/35 bg-plexus-surface p-4 shadow-[0_20px_60px_rgb(var(--plexus-accent)/0.10)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="plexus-eyebrow">{copy.store}</div>
                    <div className="mt-1 font-mono text-xs text-plexus-text-3">
                      ~/.config/plexus
                    </div>
                  </div>
                  <Database className="h-5 w-5 text-plexus-accent" strokeWidth={1.5} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded border border-plexus-border bg-plexus-bg p-3">
                    <div className="text-sm font-semibold text-plexus-text">{copy.team}</div>
                    <div className="mt-1 font-mono text-[11px] text-plexus-text-3">
                      team/rules, team/skills, team/mcp
                    </div>
                  </div>
                  <div className="rounded border border-plexus-border bg-plexus-bg p-3">
                    <div className="text-sm font-semibold text-plexus-text">{copy.personal}</div>
                    <div className="mt-1 font-mono text-[11px] text-plexus-text-3">
                      personal overrides team
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded border border-plexus-border bg-plexus-surface-2 px-3 py-2 text-xs text-plexus-text-2">
                  {copy.effective}
                </div>
                <div className="mt-4 grid gap-3">
                  {flow.map((item) => {
                    const Icon = item.icon;
                    const active = focus === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFocus(item.id as FocusKey)}
                        className={cn(
                          "flex items-start gap-3 rounded border px-3 py-2 text-left transition-colors",
                          active
                            ? "border-plexus-accent bg-plexus-accent/10"
                            : "border-plexus-border bg-plexus-bg hover:border-plexus-border-strong",
                        )}
                      >
                        <Icon
                          className={cn("mt-0.5 h-4 w-4 shrink-0", item.color)}
                          strokeWidth={1.5}
                        />
                        <span>
                          <span className="block text-sm font-semibold text-plexus-text">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block font-mono text-[11px] text-plexus-text-3">
                            {item.line}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <DiagramColumn
                title={copy.projection}
                items={["~/.claude/CLAUDE.md", "~/.codex/skills/<id>", "~/.cursor/mcp.json"]}
                icon={<ArrowRight className="h-4 w-4" strokeWidth={1.5} />}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(copy.tabs) as FocusKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFocus(key)}
                  className={cn(
                    "h-9 rounded border px-3 text-sm transition-colors",
                    focus === key
                      ? "border-plexus-accent bg-plexus-accent text-[#1a1a17]"
                      : "border-plexus-border bg-plexus-surface-2 text-plexus-text-2 hover:text-plexus-text",
                  )}
                >
                  {copy.tabs[key]}
                </button>
              ))}
            </div>

            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                {focus === "safety" ? (
                  <ShieldCheck className="h-4 w-4 text-plexus-ok" strokeWidth={1.5} />
                ) : (
                  <RotateCcw className="h-4 w-4 text-plexus-accent" strokeWidth={1.5} />
                )}
                <h3 className="text-lg font-semibold tracking-[-0.015em] text-plexus-text">
                  {detail.title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-plexus-text-2">{detail.body}</p>
              <ul className="mt-4 space-y-2">
                {detail.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-2 text-sm leading-relaxed text-plexus-text-2"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-plexus-accent" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DiagramColumn({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border border-plexus-border bg-plexus-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="plexus-eyebrow">{title}</div>
        <span className="text-plexus-text-3">{icon}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="rounded border border-plexus-border bg-plexus-bg px-3 py-2 font-mono text-[11px] leading-relaxed text-plexus-text-3"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
