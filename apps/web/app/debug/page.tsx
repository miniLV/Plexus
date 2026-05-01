import { DebugPanel } from "@/components/debug-panel";
import { getServerLocale } from "@/lib/i18n-server";
import { collectDebugSnapshot, formatDebugSnapshot } from "plexus-agent-config-core";
import pkg from "../../package.json";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Debug",
    description:
      "One-shot snapshot of every path Plexus touches: the canonical store, every agent's MCP file, instruction file, and skill folders — with size, mtime, and symlink targets. Copy the dump and share it when something looks off so we can diagnose without round-trips. No file contents are read, so secrets stay where they are.",
  },
  zh: {
    title: "调试",
    description:
      "这里会生成 Plexus 触达路径的一次性快照：canonical store、各 Agent 的 MCP 文件、指令文件和 skill 文件夹，并包含大小、mtime 和软链接目标。它不读取文件内容，因此 secrets 仍留在原处。",
  },
};

export default async function DebugPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];
  const snap = await collectDebugSnapshot();
  const text = formatDebugSnapshot(snap, pkg.version);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">{copy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
      </header>
      <DebugPanel initialText={text} />
    </div>
  );
}
