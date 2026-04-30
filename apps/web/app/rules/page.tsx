import { RulesPanel, type RulesStatus } from "@/components/rules-panel";
import { normalizeRulesStatus } from "@/lib/rules";
import * as core from "@plexus/core";

export const dynamic = "force-dynamic";

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
  const status = await loadRulesStatus();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">Rules</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">
          One editable rules baseline for Claude Code's{" "}
          <span className="font-mono text-plexus-text">CLAUDE.md</span> and each other agent's{" "}
          <span className="font-mono text-plexus-text">AGENTS.md</span>. Save it once, then apply it
          to every AI tool Plexus manages.
        </p>
      </header>

      <RulesPanel initial={status} />
    </div>
  );
}
