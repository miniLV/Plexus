import { TeamPanel } from "@/components/team-panel";
import { teamStatus } from "@plexus/core";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const status = await teamStatus();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-plexus-mute">
          Subscribe to a shared team config repo. Members pull updates with one click; everyone
          publishes new skills and MCPs through pull requests.
        </p>
      </div>
      <TeamPanel status={status} />
    </div>
  );
}
