import { BackupsPanel } from "@/components/backups-panel";
import { listBackups } from "@plexus/core";

export const dynamic = "force-dynamic";

export default async function BackupsPage() {
  const snapshots = await listBackups();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="plexus-display mb-2">Backups</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-plexus-text-2">
          Plexus snapshots every agent's MCP file before any sync, plus the exact file you edit when
          you save an instruction file. Restore rewrites the original path with the snapshotted
          bytes — you can revert to any point in this list with one click.
        </p>
      </header>
      <BackupsPanel initial={snapshots} />
    </div>
  );
}
