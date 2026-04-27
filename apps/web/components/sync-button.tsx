"use client";

import { useState } from "react";

export function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  async function run() {
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      setReport(data);
    } catch (e) {
      setReport({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="rounded bg-plexus-accent px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-plexus-accent/90 disabled:opacity-50"
      >
        {loading ? "Syncing..." : "Sync All Agents"}
      </button>
      {report && (
        <div className="w-80 rounded border border-plexus-border bg-plexus-panel p-3 text-xs">
          {report.error ? (
            <div className="text-plexus-err">{report.error}</div>
          ) : (
            <div className="space-y-1">
              {report.results?.map((r: any) => (
                <div key={r.agent} className="flex items-center justify-between">
                  <span>{r.agent}</span>
                  <span className={r.errors.length > 0 ? "text-plexus-err" : "text-plexus-ok"}>
                    {r.errors.length > 0
                      ? `${r.errors.length} error`
                      : `mcp ${r.applied.mcp} · skills ${r.applied.skills}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
