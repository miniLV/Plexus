import { DebugPanel } from "@/components/debug-panel";
import { collectDebugSnapshot, formatDebugSnapshot } from "@plexus/core";
import pkg from "../../package.json";

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  const snap = await collectDebugSnapshot();
  const text = formatDebugSnapshot(snap, pkg.version);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">Debug</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">
          One-shot snapshot of every path Plexus touches: the canonical store, every agent's MCP
          file, instruction file, and skill folders — with size, mtime, and symlink targets. Copy
          the dump and share it when something looks off so we can diagnose without round-trips. No
          file contents are read, so secrets stay where they are.
        </p>
      </header>
      <DebugPanel initialText={text} />
    </div>
  );
}
