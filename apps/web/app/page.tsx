import {
  detectAgents,
  getEffectiveMcp,
  getEffectiveSkills,
  teamStatus,
} from "@plexus/core";
import Link from "next/link";
import { ImportBanner } from "@/components/import-banner";
import { SyncButton } from "@/components/sync-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const agents = detectAgents();
  const mcp = await getEffectiveMcp();
  const skills = await getEffectiveSkills();
  const team = await teamStatus();

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-plexus-mute">
            One source of truth for MCP servers and skills, synced across every AI agent on your machine.
          </p>
        </div>
        <SyncButton />
      </header>

      <ImportBanner />

      {team.subscribed ? (
        team.hasUpstreamUpdate ? (
          <div className="rounded border border-plexus-warn/40 bg-plexus-warn/10 px-4 py-3 text-sm">
            <span className="font-medium text-plexus-warn">⟳ Team updates available</span>{" "}
            <span className="text-plexus-mute">
              {team.behind} new commit(s) on {team.repoUrl}.
            </span>{" "}
            <Link href="/team" className="text-plexus-accent hover:underline">
              Pull now →
            </Link>
          </div>
        ) : (
          <div className="rounded border border-plexus-border bg-plexus-panel px-4 py-3 text-sm">
            <span className="text-plexus-ok">●</span> Subscribed to{" "}
            <span className="font-mono text-plexus-text">{team.repoUrl}</span>{" "}
            <span className="text-plexus-mute">— up-to-date.</span>
          </div>
        )
      ) : (
        <div className="rounded border border-plexus-border bg-plexus-panel px-4 py-3 text-sm">
          <span className="text-plexus-mute">No team subscription. </span>
          <Link href="/team" className="text-plexus-accent hover:underline">
            Join a team →
          </Link>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-plexus-mute">
          Detected Agents
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {agents.map((a) => (
            <div
              key={a.id}
              className="rounded border border-plexus-border bg-plexus-panel px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{a.displayName}</div>
                {a.installed ? (
                  <span className="rounded bg-plexus-ok/15 px-2 py-0.5 text-xs text-plexus-ok">
                    installed
                  </span>
                ) : (
                  <span className="rounded bg-plexus-border px-2 py-0.5 text-xs text-plexus-mute">
                    missing
                  </span>
                )}
              </div>
              <div className="mt-2 font-mono text-xs text-plexus-mute">{a.rootDir}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-6">
        <Link
          href="/mcp"
          className="rounded border border-plexus-border bg-plexus-panel px-5 py-4 transition hover:border-plexus-accent/60"
        >
          <div className="text-sm uppercase tracking-wider text-plexus-mute">MCP Servers</div>
          <div className="mt-1 text-3xl font-semibold">{mcp.length}</div>
          <div className="mt-1 text-xs text-plexus-mute">
            {mcp.filter((m) => m.authority === "team").length} team ·{" "}
            {mcp.filter((m) => m.authority === "personal").length} personal ·{" "}
            {mcp.filter((m) => m.authority === "native").length} native-only
          </div>
        </Link>
        <Link
          href="/skills"
          className="rounded border border-plexus-border bg-plexus-panel px-5 py-4 transition hover:border-plexus-accent/60"
        >
          <div className="text-sm uppercase tracking-wider text-plexus-mute">Skills</div>
          <div className="mt-1 text-3xl font-semibold">{skills.length}</div>
          <div className="mt-1 text-xs text-plexus-mute">
            {skills.filter((s) => s.authority === "team").length} team ·{" "}
            {skills.filter((s) => s.authority === "personal").length} personal ·{" "}
            {skills.filter((s) => s.authority === "native").length} native-only
          </div>
        </Link>
      </section>
    </div>
  );
}
