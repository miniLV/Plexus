import { BackupsPanel } from "@/components/backups-panel";
import { listBackups } from "@plexus/core";

export const dynamic = "force-dynamic";

export default async function BackupsPage() {
  const snapshots = await listBackups();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Backups</h1>
        <p className="text-sm text-plexus-mute">
          Plexus snapshots every agent's MCP file before any sync, plus the exact file you edit when
          you save an instruction file. Restore rewrites the original path with the snapshotted
          bytes — you can revert to any point in this list with one click.
        </p>
      </div>
      <BackupsPanel initial={snapshots} />
    </div>
  );
}
