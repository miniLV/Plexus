import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getServerLocale } from "@/lib/i18n-server";
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
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getServerLocale();

  return (
    <html
      lang={locale === "zh" ? "zh-CN" : "en"}
      suppressHydrationWarning
      className={inter.variable}
    >
      <body>
        <ThemeProvider>
          <LanguageProvider initialLocale={locale}>
            <TooltipProvider delayDuration={250}>
              <div className="flex min-h-screen flex-col lg:flex-row">
                <AppSidebar />
                <main className="flex min-w-0 flex-1 flex-col">
                  <AppTopbar />
                  <div className="mx-auto w-full max-w-[1180px] px-4 py-6 lg:px-10 lg:py-8">
                    {children}
                  </div>
                </main>
              </div>
            </TooltipProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
