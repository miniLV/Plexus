"use client";

import { useLanguage } from "@/components/language-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

const COPY = {
  en: {
    workspace: "Workspace",
    configuration: "Configuration",
    dashboard: "Dashboard",
    rules: "Rules",
    mcp: "MCP Servers",
    skills: "Skills",
    mirror: "Mirror",
    backups: "Backups",
    debug: "Debug",
    team: "Team",
    settings: "Settings",
    agentDetail: "Agent detail",
    plexus: "Plexus",
    searchTitle: "Search (coming soon)",
    search: "Search...",
  },
  zh: {
    workspace: "工作区",
    configuration: "配置",
    dashboard: "仪表盘",
    rules: "规则",
    mcp: "MCP 服务",
    skills: "技能",
    mirror: "镜像同步",
    backups: "备份",
    debug: "调试",
    team: "团队",
    settings: "设置",
    agentDetail: "Agent 详情",
    plexus: "Plexus",
    searchTitle: "搜索（即将支持）",
    search: "搜索...",
  },
};

function deriveCrumb(
  pathname: string,
  copy: (typeof COPY)["en"],
): { group: string; label: string } {
  const routeLabels: Record<string, string> = {
    "/": copy.dashboard,
    "/rules": copy.rules,
    "/mcp": copy.mcp,
    "/skills": copy.skills,
    "/mirror": copy.mirror,
    "/backups": copy.backups,
    "/debug": copy.debug,
    "/team": copy.team,
    "/settings": copy.settings,
  };

  if (pathname === "/") return { group: copy.workspace, label: copy.dashboard };
  if (pathname.startsWith("/agents/")) {
    return { group: `${copy.workspace} / ${copy.dashboard}`, label: copy.agentDetail };
  }
  const top = `/${pathname.split("/")[1]}`;
  const label = routeLabels[top] ?? copy.plexus;
  const group =
    top === "/backups" || top === "/team" || top === "/settings" || top === "/debug"
      ? copy.configuration
      : copy.workspace;
  return { group, label };
}

export function AppTopbar() {
  const pathname = usePathname();
  const { locale } = useLanguage();
  const copy = COPY[locale];
  const { group, label } = deriveCrumb(pathname, copy);

  return (
    <header className="flex min-h-[64px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-plexus-border px-4 py-3 lg:px-10">
      <div className="flex min-w-0 flex-wrap items-center gap-3 text-[12px] tracking-[0.02em] text-plexus-text-3">
        {group.split(" / ").map((part, idx, arr) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static breadcrumb segments
          <span key={`${part}-${idx}`} className="flex items-center gap-3">
            <span>{part}</span>
            {idx < arr.length - 1 && <span>/</span>}
          </span>
        ))}
        <span>/</span>
        <span className="text-plexus-text-2">{label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded border border-transparent px-3 text-plexus-text-2 hover:bg-plexus-surface-2 hover:text-plexus-text"
          title={copy.searchTitle}
          disabled
        >
          <Search className="h-4 w-4" strokeWidth={1.5} />
          <span className="text-[12px] tracking-[0.02em] text-plexus-text-3">{copy.search}</span>
          <span className="ml-2 rounded border border-plexus-border bg-plexus-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-plexus-text-mute">
            ⌘K
          </span>
        </button>
        <LanguageToggle />
        <ThemeToggle />
        <div className="grid h-8 w-8 place-items-center rounded-full bg-plexus-accent-faint font-semibold text-plexus-accent">
          M
        </div>
      </div>
    </header>
  );
}
