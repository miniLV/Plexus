import { TeamPanel } from "@/components/team-panel";
import { teamStatus } from "@plexus/core";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const status = await teamStatus();
  return (
    <div className="space-y-8">
      <header>
        <div className="mb-2 flex items-center gap-3">
          <h1 className="plexus-display">Team</h1>
          <span className="inline-flex h-6 items-center rounded-sm border border-plexus-accent/30 bg-plexus-accent/12 px-2 text-[11px] font-medium text-plexus-accent">
            1.1 beta
          </span>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">
          Subscribe to a shared team config repo. Members pull updates with one click; everyone
          publishes new skills and MCPs through pull requests. The full team workflow is shipping in
          the 1.1 beta — opt into the waitlist below.
        </p>
      </header>
      <TeamPanel status={status} />
    </div>
  );
}
