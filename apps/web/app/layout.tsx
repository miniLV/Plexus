import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode } from "react";
import { PLEXUS_VERSION } from "@/lib/version";

export const metadata: Metadata = {
  title: "Plexus",
  description: "Team-shared AI agent config",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/mcp", label: "MCP Servers" },
  { href: "/skills", label: "Skills" },
  { href: "/mirror", label: "Mirror" },
  { href: "/team", label: "Team" },
  { href: "/backups", label: "Backups" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <div className="flex min-h-screen">
          <aside className="w-56 border-r border-plexus-border bg-plexus-panel px-4 py-6">
            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <div className="text-lg font-semibold tracking-tight text-plexus-text">
                  <span className="text-plexus-accent">●</span> Plexus
                </div>
                <span className="font-mono text-[10px] text-plexus-mute">
                  v{PLEXUS_VERSION}
                </span>
              </div>
              <div className="text-xs text-plexus-mute">team agent config</div>
            </div>
            <nav className="flex flex-col gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-3 py-2 text-plexus-text hover:bg-plexus-bg"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 px-10 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
