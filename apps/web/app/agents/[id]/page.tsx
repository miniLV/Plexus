import { AgentDetail } from "@/components/agent-detail";
import type { AgentId } from "@plexus/core";
import { inspectAgent } from "@plexus/core";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const VALID: AgentId[] = ["claude-code", "cursor", "codex", "factory-droid"];

export default async function AgentPage({ params }: { params: { id: string } }) {
  if (!(VALID as string[]).includes(params.id)) notFound();
  const data = await inspectAgent(params.id as AgentId);

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs tracking-[0.02em] text-plexus-text-3 hover:text-plexus-text"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> Dashboard
        </Link>
        <h1 className="plexus-display mt-3 mb-2">{data.displayName}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">
          Inspect this agent's files and see what Plexus owns vs what's still local-only. Rules are
          managed from the central Rules page.
        </p>
      </header>
      <AgentDetail data={data} />
    </div>
  );
}
