import { RulesPanel, type RulesStatus } from "@/components/rules-panel";
import { getServerLocale } from "@/lib/i18n-server";
import { normalizeRulesStatus } from "@/lib/rules";
import * as core from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Rules",
    descriptionPrefix: "One editable rules baseline for Claude Code's",
    descriptionMiddle: "and each other agent's",
    descriptionSuffix: "Save it once, then apply it to every AI tool Plexus manages.",
  },
  zh: {
    title: "规则",
    descriptionPrefix: "一份可编辑的规则基线，会写入 Claude Code 的",
    descriptionMiddle: "以及其他 Agent 的",
    descriptionSuffix: "保存一次，就可以应用到 Plexus 管理的所有 AI 工具。",
  },
};

type RulesCore = typeof core & {
  getRulesStatus?: () => Promise<unknown> | unknown;
};

async function loadRulesStatus(): Promise<RulesStatus> {
  const getRulesStatus = (core as RulesCore).getRulesStatus;
  if (!getRulesStatus) {
    return {
      content: "",
      canonicalPath: "~/.config/plexus/personal/rules/global.md",
      agents: [],
      unavailableReason: "Rules core API is not available in this workspace yet.",
    };
  }

  return normalizeRulesStatus(await getRulesStatus());
}

export default async function RulesPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];
  const status = await loadRulesStatus();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">{copy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">
          {copy.descriptionPrefix} <span className="font-mono text-plexus-text">CLAUDE.md</span>{" "}
          {copy.descriptionMiddle} <span className="font-mono text-plexus-text">AGENTS.md</span>.{" "}
          {copy.descriptionSuffix}
        </p>
      </header>

      <RulesPanel initial={status} />
    </div>
  );
}
