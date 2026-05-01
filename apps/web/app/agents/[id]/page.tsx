import { AgentDetail } from "@/components/agent-detail";
import { getServerLocale } from "@/lib/i18n-server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_AGENTS, type AgentId, inspectAgent } from "plexus-agent-config-core";

export const dynamic = "force-dynamic";

const VALID = new Set<string>(ALL_AGENTS);
const COPY = {
  en: {
    dashboard: "Dashboard",
    description:
      "Inspect this agent's files and see what Plexus owns vs what's still local-only. Rules are managed from the central Rules page.",
  },
  zh: {
    dashboard: "仪表盘",
    description:
      "查看这个 Agent 的文件，并确认哪些由 Plexus 管理、哪些仍是本地独有。Rules 统一在中心规则页管理。",
  },
};

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getServerLocale();
  const copy = COPY[locale];
  const { id } = await params;
  if (!VALID.has(id)) notFound();
  const data = await inspectAgent(id as AgentId);

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs tracking-[0.02em] text-plexus-text-3 hover:text-plexus-text"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> {copy.dashboard}
        </Link>
        <h1 className="plexus-display mt-3 mb-2">{data.displayName}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">{copy.description}</p>
      </header>
      <AgentDetail data={data} />
    </div>
  );
}
