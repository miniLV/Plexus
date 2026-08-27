"use client";

import { useLanguage } from "@/components/language-provider";
import { SkillsEditor } from "@/components/skills-editor";
import { SkillsMarket } from "@/components/skills-market";
import { useState } from "react";

type Row = {
  id: string;
  name: string;
  description?: string;
  authority: "personal" | "team" | "native";
  effectiveAgents: string[];
  nativeAgents: string[];
  enabledAgents?: string[];
};

const COPY = {
  en: { installed: "Installed", market: "Market" },
  zh: { installed: "已安装", market: "市场" },
};

export function SkillsView({
  initial,
  agents,
  displayNames,
  installed,
}: {
  initial: Row[];
  agents: string[];
  displayNames: Record<string, string>;
  installed: Record<string, boolean>;
}) {
  const { locale } = useLanguage();
  const copy = COPY[locale];
  const [tab, setTab] = useState<"installed" | "market">("installed");
  const [reloadToken, setReloadToken] = useState(0);

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded border border-plexus-border bg-plexus-surface p-0.5">
        {(["installed", "market"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "rounded-[3px] bg-plexus-surface-2 px-3 py-1.5 text-xs font-medium text-plexus-text shadow-[inset_0_0_0_1px_var(--plexus-border)]"
                : "rounded-[3px] px-3 py-1.5 text-xs text-plexus-text-2 hover:text-plexus-text"
            }
          >
            {t === "installed" ? copy.installed : copy.market}
          </button>
        ))}
      </div>

      {tab === "installed" ? (
        <SkillsEditor
          initial={initial}
          agents={agents}
          displayNames={displayNames}
          installed={installed}
          reloadToken={reloadToken}
        />
      ) : (
        <SkillsMarket onInstalled={() => setReloadToken((n) => n + 1)} />
      )}
    </div>
  );
}
