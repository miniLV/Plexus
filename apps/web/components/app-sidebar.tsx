"use client";

import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLEXUS_VERSION } from "@/lib/version";
import {
  Bug,
  History,
  LayoutGrid,
  type LucideIcon,
  Plug,
  Repeat,
  ScrollText,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Copy = (typeof COPY)["en"];

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  beta?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const COPY = {
  en: {
    tagline: "team agent config",
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
    poweredBy: "Powered by",
    idle: "Idle",
    runSync: "Run sync to see status",
  },
  zh: {
    tagline: "团队 AI Agent 配置",
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
    poweredBy: "Powered by",
    idle: "空闲",
    runSync: "运行同步后查看状态",
  },
};

function nav(copy: Copy): NavGroup[] {
  return [
    {
      group: copy.workspace,
      items: [
        { href: "/", label: copy.dashboard, icon: LayoutGrid },
        { href: "/rules", label: copy.rules, icon: ScrollText },
        { href: "/mcp", label: copy.mcp, icon: Plug },
        { href: "/skills", label: copy.skills, icon: Sparkles },
        { href: "/mirror", label: copy.mirror, icon: Repeat },
      ],
    },
    {
      group: copy.configuration,
      items: [
        { href: "/backups", label: copy.backups, icon: History },
        { href: "/debug", label: copy.debug, icon: Bug },
        { href: "/team", label: copy.team, icon: Users, beta: true },
        { href: "/settings", label: copy.settings, icon: Settings },
      ],
    },
  ];
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className} fill="currentColor">
      <title>GitHub</title>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.14c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.75 0c2.19-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.14v3.16c0 .31.21.67.79.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { locale } = useLanguage();
  const copy = COPY[locale];
  return (
    <aside className="flex w-full shrink-0 flex-col border-plexus-border border-b bg-plexus-surface px-3 py-5 lg:sticky lg:top-0 lg:h-screen lg:w-[240px] lg:border-r lg:border-b-0">
      {/* Logo */}
      <div className="mb-6 px-2">
        <div className="flex items-baseline gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-plexus-accent" />
          <span className="plexus-title">Plexus</span>
          <span className="font-mono text-[11px] text-plexus-text-3">v{PLEXUS_VERSION}</span>
        </div>
        <div className="mt-1 px-3 text-[12px] tracking-[0.02em] text-plexus-text-3">
          {copy.tagline}
        </div>
      </div>

      {/* Nav groups */}
      {nav(copy).map((group, i) => (
        <div key={group.group} className={cn("px-1", i === 0 ? "mb-2" : "")}>
          {i > 0 && <div className="my-3.5 h-px bg-plexus-border" />}
          <div className="plexus-eyebrow mb-2 px-2">{group.group}</div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px]",
                    "transition-colors duration-plexus-fast ease-plexus-out",
                    active
                      ? "bg-plexus-surface-2 text-plexus-text shadow-[inset_2px_0_0_var(--plexus-accent)]"
                      : "text-plexus-text-2 hover:bg-plexus-surface-2 hover:text-plexus-text",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>{item.label}</span>
                  {item.beta && (
                    <Badge variant="beta" className="ml-auto">
                      beta
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer status pill */}
      <div className="mt-auto border-t border-plexus-border px-3 pt-4">
        <a
          href="https://github.com/miniLV/Plexus"
          target="_blank"
          rel="noreferrer"
          className="group mb-4 flex items-center gap-2.5 rounded-md border border-plexus-border bg-plexus-surface-2/70 px-2.5 py-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.035)] transition-colors duration-plexus-fast ease-plexus-out hover:border-plexus-accent/45 hover:bg-plexus-surface-2"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm border border-plexus-border bg-plexus-bg text-plexus-text-2 transition-colors duration-plexus-fast ease-plexus-out group-hover:border-plexus-accent/40 group-hover:text-plexus-accent">
            <GitHubMark className="h-4 w-4" />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block text-[9px] font-medium uppercase tracking-[0.14em] text-plexus-text-mute">
              {copy.poweredBy}
            </span>
            <span className="mt-1 block text-[13px] font-semibold tracking-[0.01em] text-plexus-text">
              miniLV
            </span>
          </span>
        </a>
        <div className="mb-1 flex items-center gap-2">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-plexus-ok opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-plexus-ok" />
          </span>
          <span className="text-sm font-medium text-plexus-text">{copy.idle}</span>
        </div>
        <div className="text-[12px] tracking-[0.02em] text-plexus-text-3">{copy.runSync}</div>
      </div>
    </aside>
  );
}
