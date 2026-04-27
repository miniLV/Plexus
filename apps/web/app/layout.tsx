import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--plexus-font-sans-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plexus",
  description:
    "Team-shared AI agent config — sync MCPs, skills, and CLAUDE.md across every coding agent on your machine.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body>
        <ThemeProvider>
          <TooltipProvider delayDuration={250}>
            <div className="flex min-h-screen">
              <AppSidebar />
              <main className="flex min-w-0 flex-1 flex-col">
                <AppTopbar />
                <div className="mx-auto w-full max-w-[1180px] px-10 py-8">{children}</div>
              </main>
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
