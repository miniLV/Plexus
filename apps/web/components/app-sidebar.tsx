"use client";

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
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

const NAV: NavGroup[] = [
  {
    group: "Workspace",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutGrid },
      { href: "/mcp", label: "MCP Servers", icon: Plug },
      { href: "/skills", label: "Skills", icon: Sparkles },
      { href: "/mirror", label: "Mirror", icon: Repeat },
    ],
  },
  {
    group: "Configuration",
    items: [
      { href: "/backups", label: "Backups", icon: History },
      { href: "/debug", label: "Debug", icon: Bug },
      { href: "/team", label: "Team", icon: Users, beta: true },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-plexus-border bg-plexus-surface px-3 py-5">
      {/* Logo */}
      <div className="mb-6 px-2">
        <div className="flex items-baseline gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-plexus-accent" />
          <span className="plexus-title">Plexus</span>
          <span className="font-mono text-[11px] text-plexus-text-3">v{PLEXUS_VERSION}</span>
        </div>
        <div className="mt-1 px-3 text-[12px] tracking-[0.02em] text-plexus-text-3">
          team agent config
        </div>
      </div>

      {/* Nav groups */}
      {NAV.map((group, i) => (
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
                      1.1 beta
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
        <div className="mb-1 flex items-center gap-2">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-plexus-ok opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-plexus-ok" />
          </span>
          <span className="text-sm font-medium text-plexus-text">Idle</span>
        </div>
        <div className="text-[12px] tracking-[0.02em] text-plexus-text-3">
          Run sync to see status
        </div>
      </div>
    </aside>
  );
}
