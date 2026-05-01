import { BackupsPanel } from "@/components/backups-panel";
import { getServerLocale } from "@/lib/i18n-server";
import { listBackups } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Backups",
    description:
      "Plexus snapshots every agent's MCP file before any sync, plus the exact file you edit when you save an instruction file. Restore rewrites the original path with the snapshotted bytes — you can revert to any point in this list with one click.",
  },
  zh: {
    title: "备份",
    description:
      "每次同步前，Plexus 都会快照各 Agent 的 MCP 文件；保存指令文件时，也会快照被编辑的那个文件。恢复会把快照内容写回原路径，你可以一键回到列表中的任意状态。",
  },
};

export default async function BackupsPage() {
  const locale = await getServerLocale();
  const copy = COPY[locale];
  const snapshots = await listBackups();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">{copy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
      </header>
      <BackupsPanel initial={snapshots} />
    </div>
  );
}
