"use client";

import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plug,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type FileStatus = {
  path: string;
  exists: boolean;
  isSymlink: boolean;
  linkTarget?: string;
  size?: number;
  mtime?: string;
};

type SkillEntry = {
  id: string;
  path: string;
  isSymlink: boolean;
  linkTarget?: string;
  managedByPlexus?: boolean;
  hasSkillMd: boolean;
};

type McpRow = {
  id: string;
  type?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  httpUrl?: string;
  headers?: Record<string, string>;
  authority: "personal" | "team" | "native";
  effectiveAgents: string[];
  nativeAgents: string[];
  enabledAgents?: string[];
};

type InstructionFile = {
  label: string;
  filename: string;
  status: FileStatus;
};

type AgentInspection = {
  id: string;
  displayName: string;
  rootDir: string;
  installed: boolean;
  mcpFile: FileStatus;
  mcpFileMode: "exclusive" | "shared";
  skillsDir: FileStatus;
  skills: SkillEntry[];
  instructionFiles: InstructionFile[];
};

function fmtSize(n?: number) {
  if (n == null) return "—";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function fmtMtime(t?: string) {
  if (!t) return "—";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function truncMid(p: string, max = 60): string {
  if (p.length <= max) return p;
  const left = Math.floor(max / 2 - 2);
  const right = Math.floor(max / 2 - 2);
  return `${p.slice(0, left)}…${p.slice(p.length - right)}`;
}

function isMarkdownPath(p: string): boolean {
  return /\.(md|markdown)$/i.test(p);
}

function mcpCommand(row: McpRow): string {
  const value = `${row.command} ${(row.args ?? []).join(" ")}`.trim();
  return value || row.url || row.httpUrl || "remote URL server";
}

function compactRecord(
  value: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!value || Object.keys(value).length === 0) return undefined;
  return value;
}

function mcpConfigForDisplay(row: McpRow): Record<string, unknown> {
  return {
    id: row.id,
    ...(row.type ? { type: row.type } : {}),
    ...(row.command.trim() ? { command: row.command } : {}),
    ...(row.args && row.args.length > 0 ? { args: row.args } : {}),
    ...(compactRecord(row.env) ? { env: row.env } : {}),
    ...(row.url ? { url: row.url } : {}),
    ...(row.httpUrl ? { httpUrl: row.httpUrl } : {}),
    ...(compactRecord(row.headers) ? { headers: row.headers } : {}),
    enabledAgents: row.enabledAgents ?? row.effectiveAgents,
  };
}

function stringifyMcp(row: McpRow): string {
  return JSON.stringify(mcpConfigForDisplay(row), null, 2);
}

type ParsedMcpConfig =
  | {
      ok: true;
      server: {
        id: string;
        type?: string;
        command: string;
        args?: string[];
        env?: Record<string, string>;
        url?: string;
        httpUrl?: string;
        headers?: Record<string, string>;
        enabledAgents: string[];
      };
    }
  | { ok: false; message: string };

function optionalJsonString(value: unknown, label: string): string | undefined | Error {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") return new Error(`${label} must be a string`);
  return value.trim() ? value : undefined;
}

function jsonStringRecord(
  value: unknown,
  label: string,
): Record<string, string> | undefined | Error {
  if (value == null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    return new Error(`${label} must be an object with string values`);
  }
  const entries = Object.entries(value);
  const invalid = entries.find(([, child]) => typeof child !== "string");
  if (invalid) return new Error(`${label}.${invalid[0]} must be a string`);
  return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, string>) : undefined;
}

function jsonStringArray(value: unknown, label: string): string[] | undefined | Error {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return new Error(`${label} must be an array`);
  const invalid = value.find((child) => typeof child !== "string");
  if (invalid != null) return new Error(`${label} must contain only strings`);
  const next = value.map(String).filter(Boolean);
  return next.length > 0 ? next : undefined;
}

function parseMcpConfigText(row: McpRow, text: string): ParsedMcpConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, message: `Invalid JSON: ${(err as Error).message}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, message: "MCP config must be a JSON object." };
  }
  const record = parsed as Record<string, unknown>;
  if (record.id != null && record.id !== row.id) {
    return { ok: false, message: "MCP id cannot be changed here." };
  }

  const type = optionalJsonString(record.type, "type");
  const args = jsonStringArray(record.args, "args");
  const env = jsonStringRecord(record.env, "env");
  const url = optionalJsonString(record.url, "url");
  const httpUrl = optionalJsonString(record.httpUrl, "httpUrl");
  const headers = jsonStringRecord(record.headers, "headers");
  if (type instanceof Error) return { ok: false, message: type.message };
  if (args instanceof Error) return { ok: false, message: args.message };
  if (env instanceof Error) return { ok: false, message: env.message };
  if (url instanceof Error) return { ok: false, message: url.message };
  if (httpUrl instanceof Error) return { ok: false, message: httpUrl.message };
  if (headers instanceof Error) return { ok: false, message: headers.message };
  if (record.command != null && typeof record.command !== "string") {
    return { ok: false, message: "command must be a string" };
  }
  if (record.enabledAgents != null && !Array.isArray(record.enabledAgents)) {
    return { ok: false, message: "enabledAgents must be an array" };
  }
  if (
    Array.isArray(record.enabledAgents) &&
    record.enabledAgents.some((agent) => typeof agent !== "string")
  ) {
    return { ok: false, message: "enabledAgents must contain only strings" };
  }

  const command = typeof record.command === "string" ? record.command : "";
  if (!command.trim() && !url?.trim() && !httpUrl?.trim()) {
    return { ok: false, message: "MCP needs either command, url, or httpUrl." };
  }

  return {
    ok: true,
    server: {
      id: row.id,
      type,
      command,
      args,
      env,
      url,
      httpUrl,
      headers,
      enabledAgents: Array.isArray(record.enabledAgents)
        ? record.enabledAgents
        : (row.enabledAgents ?? row.effectiveAgents),
    },
  };
}

export function AgentDetail({ data, mcpRows }: { data: AgentInspection; mcpRows: McpRow[] }) {
  const plexusOwnedSkills = data.skills.filter((s) => s.managedByPlexus).length;
  const localSkills = data.skills.length - plexusOwnedSkills;
  const [mcpItems, setMcpItems] = useState(mcpRows);
  const [deleteTarget, setDeleteTarget] = useState<McpRow | null>(null);
  const [configTarget, setConfigTarget] = useState<{
    row: McpRow;
    mode: "view" | "edit";
  } | null>(null);
  const [configText, setConfigText] = useState("");
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const [busyMcp, setBusyMcp] = useState<string | null>(null);
  const [mcpMsg, setMcpMsg] = useState<string | null>(null);
  const personalMcp = mcpItems.filter((row) => row.authority === "personal").length;
  const nativeMcp = mcpItems.filter((row) => row.authority === "native").length;

  async function reloadMcp() {
    const res = await fetch("/api/mcp/effective");
    const dataJson = await res.json();
    const rows = (dataJson.rows ?? []) as McpRow[];
    setMcpItems(rows.filter((row) => row.effectiveAgents.includes(data.id)));
  }

  async function confirmRemoveMcp() {
    if (!deleteTarget || deleteTarget.authority === "team") return;
    setBusyMcp(deleteTarget.id);
    setMcpMsg(null);
    try {
      const res = await fetch(`/api/mcp/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        setMcpMsg(`Error: ${result.message ?? "failed to remove MCP"}`);
        return;
      }
      setDeleteTarget(null);
      await reloadMcp();
    } finally {
      setBusyMcp(null);
    }
  }

  function openMcpConfig(row: McpRow, mode: "view" | "edit") {
    setConfigTarget({ row, mode });
    setConfigText(stringifyMcp(row));
    setConfigMsg(null);
  }

  async function saveMcpConfig() {
    if (!configTarget || configTarget.mode !== "edit") return;
    const parsed = parseMcpConfigText(configTarget.row, configText);
    if (!parsed.ok) {
      setConfigMsg(parsed.message);
      return;
    }

    setBusyMcp(configTarget.row.id);
    setConfigMsg(null);
    try {
      const res = await fetch(`/api/mcp/${encodeURIComponent(configTarget.row.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ server: parsed.server }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        setConfigMsg(`Error: ${result.message ?? "failed to save MCP"}`);
        return;
      }
      setConfigTarget(null);
      await reloadMcp();
    } finally {
      setBusyMcp(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Instruction files ─────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="plexus-eyebrow">Instruction Files</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/rules">
              Manage in Rules page <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
            </Link>
          </Button>
        </div>
        {data.instructionFiles.length === 0 && (
          <div className="text-sm text-plexus-text-3">
            No conventional instruction file for {data.displayName}.
          </div>
        )}
        {data.instructionFiles.length > 0 && (
          <Card className="overflow-hidden">
            {data.instructionFiles.map((f) => (
              <div
                key={f.status.path}
                className="border-b border-plexus-border/60 p-4 text-sm last:border-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-plexus-text">{f.label}</span>
                      {f.status.exists ? (
                        <Badge variant="synced">exists</Badge>
                      ) : (
                        <Badge variant="native">not yet created</Badge>
                      )}
                    </div>
                    <code className="mt-1 block truncate font-mono text-xs text-plexus-text-3">
                      {f.status.path}
                    </code>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {f.status.exists ? (
                      <>
                        <FileViewerButton
                          agentId={data.id}
                          filePath={f.status.path}
                          mode="view"
                          label="View"
                        />
                        <FileViewerButton
                          agentId={data.id}
                          filePath={f.status.path}
                          mode="edit"
                          label="Edit"
                        />
                      </>
                    ) : (
                      <FileViewerButton
                        agentId={data.id}
                        filePath={f.status.path}
                        mode="edit"
                        label="Create"
                        allowCreate
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="border-t border-plexus-border/60 bg-plexus-surface-2/40 px-4 py-3 text-xs text-plexus-text-3">
              Use Rules to edit the shared baseline, import from this agent, or apply the baseline
              across all tools.
            </div>
          </Card>
        )}
      </section>

      {/* MCP servers ──────────────────── */}
      <section className="space-y-3">
        <details className="group" open>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-plexus-border bg-plexus-surface px-4 py-3 transition-colors hover:bg-plexus-surface-2/60">
            <div className="flex items-center gap-3">
              <ChevronRight
                className="h-4 w-4 text-plexus-text-3 transition-transform group-open:rotate-90"
                strokeWidth={1.5}
              />
              <span className="plexus-eyebrow">MCP Servers</span>
              <span className="text-sm text-plexus-text-2">{mcpItems.length}</span>
              {personalMcp > 0 && <Badge variant="synced">{personalMcp} personal</Badge>}
              {nativeMcp > 0 && <Badge variant="divergent">{nativeMcp} native-only</Badge>}
            </div>
            <Link
              href="/mcp"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-plexus-accent hover:underline"
            >
              Manage in MCP page <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
            </Link>
          </summary>
          <Card className="mt-2 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-plexus-border px-4 py-3 text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
              <div>Server</div>
              <div className="text-right">Layer</div>
              <div className="text-right">Action</div>
            </div>
            {mcpItems.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-plexus-text-3">
                No MCP servers enabled for this agent.
              </div>
            )}
            {mcpItems.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-plexus-border/60 px-4 py-2.5 text-sm last:border-0 hover:bg-plexus-surface-2/40"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <Plug
                      className="h-3.5 w-3.5 flex-shrink-0 text-plexus-text-3"
                      strokeWidth={1.5}
                    />
                    <code className="truncate font-mono text-[13px] text-plexus-text">
                      {row.id}
                    </code>
                  </div>
                  <code
                    className="mt-0.5 block truncate font-mono text-[10px] text-plexus-text-3"
                    title={mcpCommand(row)}
                  >
                    {mcpCommand(row)}
                  </code>
                </div>
                <div className="text-right">
                  <Badge
                    variant={
                      row.authority === "team"
                        ? "team"
                        : row.authority === "personal"
                          ? "personal"
                          : "native"
                    }
                  >
                    {row.authority}
                  </Badge>
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openMcpConfig(row, "view")}
                    title="View MCP config"
                    aria-label={`View MCP ${row.id}`}
                  >
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Button>
                  {row.authority !== "team" && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openMcpConfig(row, "edit")}
                      disabled={busyMcp === row.id}
                      title="Edit MCP config"
                      aria-label={`Edit MCP ${row.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Button>
                  )}
                  {row.authority === "team" ? (
                    <span className="self-center text-xs text-plexus-text-3">read-only</span>
                  ) : (
                    <Button
                      variant="danger"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDeleteTarget(row)}
                      disabled={busyMcp === row.id}
                      title="Delete from Plexus and managed agent configs"
                      aria-label={`Delete MCP ${row.id}`}
                    >
                      {busyMcp === row.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {(mcpMsg || mcpItems.some((row) => row.authority === "team")) && (
              <div className="border-t border-plexus-border/60 bg-plexus-surface-2/40 px-4 py-3 text-xs text-plexus-text-3">
                {mcpMsg ? (
                  <span className="text-plexus-err">{mcpMsg}</span>
                ) : (
                  "Team-layer MCP servers are managed from the team config and cannot be deleted here."
                )}
              </div>
            )}
          </Card>
        </details>
      </section>

      {/* Skills ────────────────────────── */}
      <section className="space-y-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-plexus-border bg-plexus-surface px-4 py-3 transition-colors hover:bg-plexus-surface-2/60">
            <div className="flex items-center gap-3">
              <ChevronRight
                className="h-4 w-4 text-plexus-text-3 transition-transform group-open:rotate-90"
                strokeWidth={1.5}
              />
              <span className="plexus-eyebrow">Skills</span>
              <span className="text-sm text-plexus-text-2">{data.skills.length}</span>
              {plexusOwnedSkills > 0 && (
                <Badge variant="synced">{plexusOwnedSkills} Plexus-owned</Badge>
              )}
              {localSkills > 0 && <Badge variant="divergent">{localSkills} agent-local</Badge>}
            </div>
            <Link
              href="/skills"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-plexus-accent hover:underline"
            >
              Manage in Skills page <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
            </Link>
          </summary>
          <Card className="mt-2 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-plexus-border px-4 py-3 text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
              <div>ID</div>
              <div className="text-right">Owner</div>
              <div className="text-right">Action</div>
            </div>
            {data.skills.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-plexus-text-3">
                No skills installed for this agent.
              </div>
            )}
            {data.skills.slice(0, 50).map((s) => (
              <div
                key={s.path}
                className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-plexus-border/60 px-4 py-2.5 text-sm last:border-0 hover:bg-plexus-surface-2/40"
              >
                <div>
                  <div className="font-mono text-[13px] text-plexus-text">{s.id}</div>
                  <div className="mt-0.5 text-[10px] text-plexus-text-3">
                    {truncMid(s.path, 80)}
                  </div>
                  {s.isSymlink && s.linkTarget && (
                    <div className="mt-0.5 text-[10px] text-plexus-text-3">
                      → {truncMid(s.linkTarget, 80)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {s.managedByPlexus ? (
                    <Badge variant="synced">Plexus-owned</Badge>
                  ) : s.isSymlink ? (
                    <Badge variant="native">external symlink</Badge>
                  ) : (
                    <Badge variant="divergent">agent-local</Badge>
                  )}
                </div>
                <div className="text-right">
                  {s.hasSkillMd && (
                    <FileViewerButton
                      agentId={data.id}
                      filePath={`${s.path}/SKILL.md`}
                      mode="view"
                      label="View"
                    />
                  )}
                </div>
              </div>
            ))}
            {data.skills.length > 50 && (
              <div className="border-t border-plexus-border/60 px-4 py-2 text-center text-xs text-plexus-text-3">
                … and {data.skills.length - 50} more (manage on the Skills page)
              </div>
            )}
          </Card>
        </details>
      </section>

      {configTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close MCP config"
            className="absolute inset-0 cursor-default bg-black/65"
            onClick={() => {
              if (!busyMcp) setConfigTarget(null);
            }}
            disabled={Boolean(busyMcp)}
          />
          <dialog
            open
            aria-labelledby="agent-mcp-config-title"
            className="relative z-10 flex max-h-[82vh] w-full max-w-2xl cursor-default flex-col overflow-hidden rounded-md border border-plexus-border bg-plexus-surface text-left shadow-lg"
          >
            <div className="flex items-start gap-3 border-b border-plexus-border px-5 py-4">
              <div className="mt-0.5 rounded-md bg-plexus-accent-faint p-2 text-plexus-accent">
                {configTarget.mode === "edit" ? (
                  <Pencil className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.5} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div id="agent-mcp-config-title" className="text-sm font-semibold text-plexus-text">
                  {configTarget.mode === "edit" ? "Edit MCP config" : "View MCP config"}
                </div>
                <code className="mt-1 block truncate font-mono text-xs text-plexus-text-3">
                  {configTarget.row.id}
                </code>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setConfigTarget(null)}
                disabled={Boolean(busyMcp)}
                className="rounded-sm p-1 text-plexus-text-3 hover:bg-plexus-surface-2 hover:text-plexus-text disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4">
              <textarea
                className="min-h-[320px] w-full resize-y rounded border border-plexus-border bg-plexus-bg px-3 py-2 font-mono text-xs leading-relaxed text-plexus-text outline-none placeholder:text-plexus-text-mute focus:border-plexus-accent disabled:opacity-85"
                value={configText}
                onChange={(event) => setConfigText(event.target.value)}
                readOnly={configTarget.mode === "view"}
                spellCheck={false}
              />
              {configTarget.mode === "edit" && (
                <div className="rounded-md border border-plexus-border bg-plexus-surface-2/60 px-3 py-2 text-xs leading-relaxed text-plexus-text-3">
                  Edit the JSON directly. Save requires valid JSON and one MCP transport field:
                  command, url, or httpUrl. Unknown fields are ignored by this editor.
                </div>
              )}
              {configMsg && <div className="text-xs text-plexus-err">{configMsg}</div>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-plexus-border bg-plexus-surface-2/40 px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfigTarget(null)}
                disabled={Boolean(busyMcp)}
              >
                {configTarget.mode === "edit" ? "Cancel" : "Close"}
              </Button>
              {configTarget.mode === "edit" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={saveMcpConfig}
                  disabled={Boolean(busyMcp)}
                >
                  {busyMcp ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  {busyMcp ? "Saving" : "Save and sync"}
                </Button>
              )}
            </div>
          </dialog>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Cancel MCP removal"
            className="absolute inset-0 cursor-default bg-black/65"
            onClick={() => {
              if (!busyMcp) setDeleteTarget(null);
            }}
            disabled={Boolean(busyMcp)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="agent-mcp-remove-title"
            aria-describedby="agent-mcp-remove-description"
            className="relative z-10 w-full max-w-md cursor-default overflow-hidden rounded-md border border-plexus-border bg-plexus-surface text-left shadow-lg"
          >
            <div className="flex items-start gap-3 border-b border-plexus-border px-5 py-4">
              <div className="mt-0.5 rounded-md bg-plexus-err/10 p-2 text-plexus-err">
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div id="agent-mcp-remove-title" className="text-sm font-semibold text-plexus-text">
                  Remove MCP server?
                </div>
                <code className="mt-1 block truncate font-mono text-xs text-plexus-text-3">
                  {deleteTarget.id}
                </code>
              </div>
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(busyMcp)}
                className="rounded-sm p-1 text-plexus-text-3 hover:bg-plexus-surface-2 hover:text-plexus-text disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm text-plexus-text-2">
              <p id="agent-mcp-remove-description">
                This removes the server from Plexus and all managed agent configs after taking a
                backup snapshot.
              </p>
              <div className="rounded-md border border-plexus-border bg-plexus-surface-2/60 px-3 py-2">
                <div className="plexus-eyebrow mb-1">command</div>
                <code className="block truncate font-mono text-xs text-plexus-text-3">
                  {mcpCommand(deleteTarget)}
                </code>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-plexus-border bg-plexus-surface-2/40 px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(busyMcp)}
              >
                Cancel
              </Button>
              <Button
                variant="danger-solid"
                size="sm"
                onClick={confirmRemoveMcp}
                disabled={Boolean(busyMcp)}
              >
                {busyMcp ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                {busyMcp ? "Removing" : "Remove MCP"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MCP file (collapsed by default) ─ */}
      <section className="space-y-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-plexus-border bg-plexus-surface px-4 py-3 transition-colors hover:bg-plexus-surface-2/60">
            <div className="flex items-center gap-3">
              <ChevronRight
                className="h-4 w-4 text-plexus-text-3 transition-transform group-open:rotate-90"
                strokeWidth={1.5}
              />
              <span className="plexus-eyebrow">MCP File</span>
              <Badge
                variant={data.mcpFileMode === "exclusive" ? "synced" : "divergent"}
                title={
                  data.mcpFileMode === "exclusive"
                    ? "Plexus owns this file end-to-end via a symlink."
                    : "Shared file — Plexus only rewrites its own section."
                }
              >
                {data.mcpFileMode}
              </Badge>
              {data.mcpFile.exists ? (
                data.mcpFile.isSymlink ? (
                  <Badge variant="synced">symlink</Badge>
                ) : (
                  <Badge variant="native">regular file</Badge>
                )
              ) : (
                <Badge variant="native">missing</Badge>
              )}
            </div>
            <span className="text-xs text-plexus-text-3">{fmtSize(data.mcpFile.size)}</span>
          </summary>
          <Card className="mt-2 p-4 text-sm">
            <code className="font-mono text-plexus-text-2">{data.mcpFile.path}</code>
            {data.mcpFile.isSymlink && data.mcpFile.linkTarget && (
              <div className="mt-2 text-xs text-plexus-text-3">
                <span className="text-plexus-text">→</span>{" "}
                <code className="font-mono">{data.mcpFile.linkTarget}</code>
              </div>
            )}
            <div className="mt-3 flex gap-4 text-xs text-plexus-text-3">
              <span>size: {fmtSize(data.mcpFile.size)}</span>
              <span>mtime: {fmtMtime(data.mcpFile.mtime)}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/mcp">
                  Edit MCP servers <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Link>
              </Button>
              {data.mcpFile.exists && (
                <FileViewerButton
                  agentId={data.id}
                  filePath={data.mcpFile.path}
                  mode="view"
                  label="View raw"
                />
              )}
            </div>
          </Card>
        </details>
      </section>
    </div>
  );
}

function FileViewerButton({
  agentId,
  filePath,
  label,
  mode,
  allowCreate,
}: {
  agentId: string;
  filePath: string;
  label?: string;
  mode: "view" | "edit";
  allowCreate?: boolean;
}) {
  const isEdit = mode === "edit";
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const isMarkdown = isMarkdownPath(filePath);

  useEffect(() => {
    if (!open || loaded) return;
    if (allowCreate) {
      setContent("");
      setLoaded(true);
      return;
    }
    fetch(`/api/agent/${agentId}/file?path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setMsg(`Read failed: ${d.message}`);
        else setContent(d.content);
        setLoaded(true);
      });
  }, [open, agentId, filePath, loaded, allowCreate]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/agent/${agentId}/file`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: filePath, content }),
      });
      const data = await res.json();
      if (!data.ok) setMsg(`Save failed: ${data.message}`);
      else {
        setMsg(data.backup ? `Saved. Backup: ${data.backup}` : "Saved.");
        setTimeout(() => setOpen(false), 700);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleTriggerClick() {
    if (isEdit) {
      setConfirming(true);
    } else {
      setOpen(true);
    }
  }

  function confirmAndOpen() {
    setConfirming(false);
    setOpen(true);
  }

  const buttonLabel = label ?? (isEdit ? "Edit" : "View");

  return (
    <>
      <Button variant={isEdit ? "secondary" : "ghost"} size="sm" onClick={handleTriggerClick}>
        {isEdit ? (
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
        ) : (
          <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
        )}
        {buttonLabel}
      </Button>

      {/* Pre-edit confirmation dialog ─── */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close confirmation"
            className="absolute inset-0 cursor-default bg-black/70"
            onClick={() => setConfirming(false)}
          />
          <div className="relative z-10 w-full max-w-md cursor-default overflow-hidden rounded-md border border-plexus-border bg-plexus-surface text-left shadow-lg">
            <div className="flex items-start gap-3 border-b border-plexus-border px-5 py-4">
              <div className="mt-0.5 rounded-md bg-amber-500/10 p-2 text-amber-400">
                <ShieldAlert className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-plexus-text">
                  {allowCreate
                    ? "About to create a live agent file"
                    : "About to edit a live agent file"}
                </div>
                <code className="mt-1 block break-all font-mono text-xs text-plexus-text-3">
                  {filePath}
                </code>
              </div>
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setConfirming(false)}
                className="text-plexus-text-3 hover:text-plexus-text"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm text-plexus-text-2">
              <p>Changes save directly to the file the agent reads — there is no staging step.</p>
              <div className="flex items-start gap-2 rounded-md border border-plexus-border bg-plexus-surface-2/60 px-3 py-2 text-xs">
                <Sparkles
                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-plexus-accent"
                  strokeWidth={1.5}
                />
                <span>
                  Plexus will <span className="text-plexus-text">automatically snapshot</span> the
                  current contents before the first save. If anything goes wrong, restore it from
                  the{" "}
                  <Link href="/backups" className="text-plexus-accent hover:underline">
                    Backups
                  </Link>{" "}
                  page.
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-plexus-border bg-plexus-surface-2/40 px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={confirmAndOpen}>
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                {allowCreate ? "Create file" : "Yes, edit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Editor / viewer modal ─────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close file viewer"
            className="absolute inset-0 cursor-default bg-black/70"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex h-[80vh] w-[80vw] max-w-5xl cursor-default flex-col overflow-hidden rounded-md border border-plexus-border bg-plexus-surface text-left shadow-lg">
            <div className="flex items-center justify-between border-b border-plexus-border px-5 py-3">
              <div className="flex items-center gap-2">
                {isEdit ? (
                  <Badge variant="divergent">editing</Badge>
                ) : (
                  <Badge variant="synced">read only</Badge>
                )}
                <code className="font-mono text-xs text-plexus-text-3">{filePath}</code>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-plexus-text-3 hover:text-plexus-text"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            {isEdit && (
              <div className="flex items-center gap-2 border-b border-plexus-border bg-amber-500/5 px-5 py-2 text-xs text-amber-400/90">
                <Sparkles className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} />
                <span>
                  Auto-backup runs before save. Restore from{" "}
                  <Link href="/backups" className="underline">
                    /backups
                  </Link>{" "}
                  any time.
                </span>
              </div>
            )}
            {msg && (
              <div className="border-b border-plexus-border bg-plexus-surface-2 px-5 py-2 text-xs text-plexus-text-2">
                {msg}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-hidden bg-plexus-bg">
              {!loaded ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-plexus-text-3">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                  Loading file…
                </div>
              ) : isMarkdown ? (
                isEdit ? (
                  <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-2">
                    <div className="flex min-h-0 flex-col border-plexus-border border-b lg:border-r lg:border-b-0">
                      <div className="border-plexus-border border-b bg-plexus-surface px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-plexus-text-3">
                        Markdown
                      </div>
                      <textarea
                        className="min-h-[260px] flex-1 resize-none bg-plexus-bg p-4 font-mono text-xs leading-6 text-plexus-text outline-none"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        spellCheck={false}
                      />
                    </div>
                    <div className="flex min-h-0 flex-col">
                      <div className="border-plexus-border border-b bg-plexus-surface px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-plexus-text-3">
                        Preview
                      </div>
                      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
                        <MarkdownContent content={content} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full overflow-auto px-6 py-5">
                    <MarkdownContent content={content} />
                  </div>
                )
              ) : (
                <textarea
                  className="h-full w-full resize-none bg-plexus-bg p-4 font-mono text-xs leading-6 text-plexus-text outline-none"
                  value={content}
                  readOnly={!isEdit}
                  onChange={(e) => setContent(e.target.value)}
                  spellCheck={false}
                />
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-plexus-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
              {isEdit && (
                <Button variant="primary" size="sm" onClick={save} disabled={busy}>
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />}
                  {busy ? "Saving…" : "Save"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
