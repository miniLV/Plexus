import { inspectAgent } from "@plexus/core";
import type { AgentId } from "@plexus/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentDetail } from "@/components/agent-detail";

export const dynamic = "force-dynamic";

const VALID: AgentId[] = ["claude-code", "cursor", "codex", "factory-droid"];

export default async function AgentPage({ params }: { params: { id: string } }) {
  if (!(VALID as string[]).includes(params.id)) notFound();
  const data = await inspectAgent(params.id as AgentId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-xs text-plexus-mute hover:text-plexus-text">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {data.displayName}
        </h1>
        <p className="text-sm text-plexus-mute">
          Inspect this agent's files, see what Plexus owns vs what's still
          local-only, and edit the instruction files directly.
        </p>
      </div>
      <AgentDetail data={data} />
    </div>
  );
}
