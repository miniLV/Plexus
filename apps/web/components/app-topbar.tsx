"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/mcp": "MCP Servers",
  "/skills": "Skills",
  "/mirror": "Mirror",
  "/backups": "Backups",
  "/team": "Team",
  "/settings": "Settings",
};

function deriveCrumb(pathname: string): { group: string; label: string } {
  if (pathname === "/") return { group: "Workspace", label: "Dashboard" };
  if (pathname.startsWith("/agents/")) {
    return { group: "Workspace / Dashboard", label: "Agent detail" };
  }
  const top = `/${pathname.split("/")[1]}`;
  const label = ROUTE_LABELS[top] ?? "Plexus";
  const group =
    top === "/backups" || top === "/team" || top === "/settings" ? "Configuration" : "Workspace";
  return { group, label };
}

export function AppTopbar() {
  const pathname = usePathname();
  const { group, label } = deriveCrumb(pathname);

  return (
    <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-plexus-border px-10">
      <div className="flex items-center gap-3 text-[12px] tracking-[0.02em] text-plexus-text-3">
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded border border-transparent px-3 text-plexus-text-2 hover:bg-plexus-surface-2 hover:text-plexus-text"
          title="Search (coming soon)"
          disabled
        >
          <Search className="h-4 w-4" strokeWidth={1.5} />
          <span className="text-[12px] tracking-[0.02em] text-plexus-text-3">Search…</span>
          <span className="ml-2 rounded border border-plexus-border bg-plexus-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-plexus-text-mute">
            ⌘K
          </span>
        </button>
        <ThemeToggle />
        <div className="grid h-8 w-8 place-items-center rounded-full bg-plexus-accent-faint font-semibold text-plexus-accent">
          M
        </div>
      </div>
    </header>
  );
}
