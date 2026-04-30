"use client";

import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

type CustomAgent = {
  id: string;
  displayName: string;
  instructionFile: string;
  note?: string;
  createdAt: string;
};

type CatalogAgent = {
  id: string;
  displayName: string;
  support: "full" | "instructions-only" | "manual";
  managed: boolean;
  installed: boolean;
  rootDir?: string;
  instructionFile?: string;
  mcpPath?: string;
  skillsDir?: string;
  note: string;
};

const COPY = {
  en: {
    catalog: "Agent catalog",
    catalogHelp:
      "Built-in agents sync Rules, MCP, and Skills. Other popular tools are listed as manual presets so users can quickly track an instruction file without waiting for a native adapter.",
    addAgent: "Add agent",
    agent: "Agent",
    status: "Status",
    support: "Support",
    action: "Action",
    installed: "installed",
    missing: "missing",
    fullSync: "full sync",
    manual: "manual",
    builtIn: "built-in",
    tracked: "tracked",
    trackFile: "Track file",
    agentId: "Agent id",
    displayName: "Display name",
    instructionFilePath: "Instruction file path",
    pathHelp:
      "Absolute or ~/ relative. Plexus will create or read the file when you click View / Edit.",
    note: "Note",
    optional: "optional",
    notePlaceholder: "Anything to remember about this agent...",
    cancel: "Cancel",
    adding: "Adding...",
    loading: "Loading custom agents...",
    noCustom: "No custom agents yet. Click Add agent to register one.",
    lite: "Lite",
    instructionsOnly: "instructions only",
    remove: "Remove",
    edit: "Edit",
    close: "Close",
    save: "Save",
    saving: "Saving...",
    editing: "editing",
    newFile: "new file",
    snapshotNotice:
      "Plexus snapshots the current file before save. Missing files are created on first save.",
    removeConfirm: (id: string) =>
      `Remove custom agent '${id}'? The instruction file on disk is not deleted.`,
    addFailed: "Failed to add custom agent",
    readFailed: "Failed to read file",
    saveFailed: "Failed to save file",
    saved: "Saved.",
    savedBackup: (backup: string) => `Saved. Backup: ${backup}`,
  },
  zh: {
    catalog: "Agent 目录",
    catalogHelp:
      "内置 Agent 支持 Rules、MCP 和 Skills 的完整同步。其他常见工具会作为手动预设展示，用户可以先追踪一个指令文件，不必等原生适配器。",
    addAgent: "新增 Agent",
    agent: "Agent",
    status: "状态",
    support: "支持",
    action: "操作",
    installed: "已安装",
    missing: "未发现",
    fullSync: "完整同步",
    manual: "手动",
    builtIn: "内置",
    tracked: "已追踪",
    trackFile: "追踪文件",
    agentId: "Agent ID",
    displayName: "展示名称",
    instructionFilePath: "指令文件路径",
    pathHelp: "支持绝对路径或 ~/ 相对路径。点击查看/编辑时，Plexus 会读取或创建该文件。",
    note: "备注",
    optional: "可选",
    notePlaceholder: "记录这个 Agent 的用途或注意事项...",
    cancel: "取消",
    adding: "正在新增...",
    loading: "正在加载自定义 Agent...",
    noCustom: "还没有自定义 Agent。点击新增 Agent 登记一个。",
    lite: "轻量",
    instructionsOnly: "仅指令文件",
    remove: "移除",
    edit: "编辑",
    close: "关闭",
    save: "保存",
    saving: "保存中...",
    editing: "编辑中",
    newFile: "新文件",
    snapshotNotice: "Plexus 会在保存前快照当前文件。缺失文件会在第一次保存时创建。",
    removeConfirm: (id: string) => `移除自定义 Agent '${id}'？磁盘上的指令文件不会被删除。`,
    addFailed: "新增自定义 Agent 失败",
    readFailed: "读取文件失败",
    saveFailed: "保存文件失败",
    saved: "已保存。",
    savedBackup: (backup: string) => `已保存。备份：${backup}`,
  },
};

export function CustomAgentsPanel() {
  const { locale } = useLanguage();
  const copy = COPY[locale];
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [catalog, setCatalog] = useState<CatalogAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ id: "", displayName: "", instructionFile: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formIdInput = useId();
  const formNameInput = useId();
  const formFileInput = useId();
  const formNoteInput = useId();

  function closeAddForm() {
    setAdding(false);
    setError(null);
    setForm({ id: "", displayName: "", instructionFile: "", note: "" });
  }

  async function load() {
    setLoading(true);
    try {
      const [customRes, catalogRes] = await Promise.all([
        fetch("/api/custom-agents"),
        fetch("/api/agent-catalog"),
      ]);
      const customData = await customRes.json();
      const catalogData = await catalogRes.json();
      setAgents(customData.agents ?? []);
      setCatalog(catalogData.agents ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [customRes, catalogRes] = await Promise.all([
          fetch("/api/custom-agents"),
          fetch("/api/agent-catalog"),
        ]);
        const customData = await customRes.json();
        const catalogData = await catalogRes.json();
        if (!cancelled) {
          setAgents(customData.agents ?? []);
          setCatalog(catalogData.agents ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/custom-agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: form.id.trim(),
          displayName: form.displayName.trim(),
          instructionFile: form.instructionFile.trim(),
          note: form.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? copy.addFailed);
        return;
      }
      closeAddForm();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addPreset(agent: CatalogAgent) {
    if (!agent.instructionFile) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/custom-agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: agent.id,
          displayName: agent.displayName,
          instructionFile: agent.instructionFile,
          note: agent.note,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? copy.addFailed);
        return;
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm(copy.removeConfirm(id))) return;
    setBusy(true);
    try {
      await fetch(`/api/custom-agents/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const customIds = new Set(agents.map((agent) => agent.id));
  const sortedCatalog = [...catalog].sort(
    (a, b) =>
      Number(b.installed) - Number(a.installed) || a.displayName.localeCompare(b.displayName),
  );

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="plexus-eyebrow mb-1">{copy.catalog}</div>
          <p className="max-w-xl text-xs text-plexus-text-3">{copy.catalogHelp}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          {copy.addAgent}
        </Button>
      </div>

      {catalog.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded border border-plexus-border">
          <div className="grid min-w-[720px] grid-cols-[1fr_86px_92px_96px] gap-x-4 border-b border-plexus-border bg-plexus-surface-2/40 px-4 py-2.5 text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
            <div>{copy.agent}</div>
            <div className="text-right">{copy.status}</div>
            <div className="text-right">{copy.support}</div>
            <div className="text-right">{copy.action}</div>
          </div>
          {sortedCatalog.map((agent) => {
            const alreadyTracked = customIds.has(agent.id);
            return (
              <div
                key={agent.id}
                className={`grid min-w-[720px] grid-cols-[1fr_86px_92px_96px] gap-x-4 border-b border-plexus-border/60 px-4 py-3 text-sm last:border-0 ${
                  agent.installed ? "bg-plexus-bg" : "bg-plexus-surface text-plexus-text-3"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-plexus-text">{agent.displayName}</div>
                  <div className="font-mono text-[11px] text-plexus-text-3">{agent.id}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-plexus-text-2">
                    {agent.mcpPath ?? agent.instructionFile ?? agent.rootDir}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={agent.installed ? "synced" : "native"}>
                    {agent.installed ? copy.installed : copy.missing}
                  </Badge>
                </div>
                <div className="text-right">
                  <Badge variant={agent.managed ? "personal" : "outline"}>
                    {agent.support === "full" ? copy.fullSync : copy.manual}
                  </Badge>
                </div>
                <div className="text-right">
                  {agent.managed ? (
                    <Badge variant="synced">{copy.builtIn}</Badge>
                  ) : alreadyTracked ? (
                    <Badge variant="native">{copy.tracked}</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addPreset(agent)}
                      disabled={busy || !agent.instructionFile}
                    >
                      {copy.trackFile}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <dialog
          open
          aria-labelledby="custom-agent-form-title"
          className="fixed inset-0 z-50 m-0 h-full w-full max-w-none border-0 bg-transparent p-0"
        >
          <div
            role="presentation"
            className="flex h-full w-full cursor-default items-center justify-center bg-black/70 p-4"
            onClick={closeAddForm}
          >
            <form
              onSubmit={handleAdd}
              className="w-full max-w-2xl space-y-4 rounded-md border border-plexus-border bg-plexus-surface p-5 text-left shadow-lg"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-plexus-border pb-3">
                <div>
                  <div
                    id="custom-agent-form-title"
                    className="text-sm font-semibold text-plexus-text"
                  >
                    {copy.addAgent}
                  </div>
                  <p className="mt-1 text-xs text-plexus-text-3">{copy.pathHelp}</p>
                </div>
                <button
                  type="button"
                  aria-label={copy.close}
                  onClick={closeAddForm}
                  className="text-plexus-text-3 hover:text-plexus-text"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label
                    htmlFor={formIdInput}
                    className="mb-1 block text-[11px] uppercase tracking-[0.10em] text-plexus-text-3"
                  >
                    {copy.agentId}
                  </label>
                  <input
                    id={formIdInput}
                    type="text"
                    required
                    placeholder="e.g. copilot-cli"
                    value={form.id}
                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                    pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                    className="w-full rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm text-plexus-text outline-none focus:border-plexus-accent"
                  />
                </div>
                <div>
                  <label
                    htmlFor={formNameInput}
                    className="mb-1 block text-[11px] uppercase tracking-[0.10em] text-plexus-text-3"
                  >
                    {copy.displayName}
                  </label>
                  <input
                    id={formNameInput}
                    type="text"
                    required
                    placeholder="e.g. GitHub Copilot CLI"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    className="w-full rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm text-plexus-text outline-none focus:border-plexus-accent"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor={formFileInput}
                  className="mb-1 block text-[11px] uppercase tracking-[0.10em] text-plexus-text-3"
                >
                  {copy.instructionFilePath}
                </label>
                <input
                  id={formFileInput}
                  type="text"
                  required
                  placeholder="e.g. ~/.config/copilot/AGENTS.md"
                  value={form.instructionFile}
                  onChange={(e) => setForm({ ...form, instructionFile: e.target.value })}
                  className="w-full rounded border border-plexus-border bg-plexus-bg px-3 py-2 font-mono text-xs text-plexus-text outline-none focus:border-plexus-accent"
                />
              </div>
              <div>
                <label
                  htmlFor={formNoteInput}
                  className="mb-1 block text-[11px] uppercase tracking-[0.10em] text-plexus-text-3"
                >
                  {copy.note}{" "}
                  <span className="lowercase text-plexus-text-3">({copy.optional})</span>
                </label>
                <input
                  id={formNoteInput}
                  type="text"
                  maxLength={280}
                  placeholder={copy.notePlaceholder}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full rounded border border-plexus-border bg-plexus-bg px-3 py-2 text-sm text-plexus-text outline-none focus:border-plexus-accent"
                />
              </div>
              {error && (
                <div className="rounded border border-plexus-err/40 bg-plexus-err/10 px-3 py-2 text-xs text-plexus-err">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2 border-t border-plexus-border pt-3">
                <Button type="button" variant="ghost" size="sm" onClick={closeAddForm}>
                  {copy.cancel}
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={busy}>
                  {busy ? copy.adding : copy.addAgent}
                </Button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {/* List */}
      <div className="mt-5">
        {loading && <div className="text-xs text-plexus-text-3">{copy.loading}</div>}
        {!loading && agents.length === 0 && (
          <div className="rounded border border-dashed border-plexus-border bg-plexus-bg/40 px-4 py-6 text-center text-xs text-plexus-text-3">
            {copy.noCustom}
          </div>
        )}
        {agents.length > 0 && (
          <div className="overflow-x-auto rounded border border-plexus-border">
            <div className="grid min-w-[720px] grid-cols-[1fr_130px_180px] gap-x-4 border-b border-plexus-border bg-plexus-surface-2/40 px-4 py-2.5 text-[11px] uppercase tracking-[0.10em] text-plexus-text-3">
              <div>{copy.agent}</div>
              <div className="text-right">{copy.lite}</div>
              <div className="text-right">{copy.action}</div>
            </div>
            {agents.map((a) => (
              <div
                key={a.id}
                className="grid min-w-[720px] grid-cols-[1fr_130px_180px] gap-x-4 border-b border-plexus-border/60 px-4 py-3 text-sm last:border-0"
              >
                <div>
                  <div className="font-semibold text-plexus-text">{a.displayName}</div>
                  <div className="font-mono text-[11px] text-plexus-text-3">{a.id}</div>
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-plexus-text-2">
                    <FileText className="h-3 w-3" strokeWidth={1.5} />
                    {a.instructionFile}
                  </div>
                  {a.note && (
                    <div className="mt-1 text-[11px] italic text-plexus-text-3">{a.note}</div>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant="native">{copy.instructionsOnly}</Badge>
                </div>
                <div className="flex justify-end gap-2 text-right">
                  <CustomAgentFileButton agent={a} copy={copy} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(a.id)}
                    disabled={busy}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {copy.remove}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function CustomAgentFileButton({ agent, copy }: { agent: CustomAgent; copy: (typeof COPY)["en"] }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    setBusy(true);
    fetch(`/api/custom-agents/${encodeURIComponent(agent.id)}/file`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setMsg(data.message ?? copy.readFailed);
          return;
        }
        setContent(data.content ?? "");
        setExists(Boolean(data.exists));
      })
      .catch((err) => setMsg((err as Error).message))
      .finally(() => {
        setLoaded(true);
        setBusy(false);
      });
  }, [open, loaded, agent.id]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/custom-agents/${encodeURIComponent(agent.id)}/file`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message ?? copy.saveFailed);
        return;
      }
      setExists(true);
      setMsg(data.backup ? copy.savedBackup(data.backup) : copy.saved);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
        {copy.edit}
      </Button>
      {open && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[80vh] w-[80vw] max-w-5xl cursor-default flex-col overflow-hidden rounded-md border border-plexus-border bg-plexus-surface text-left shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-plexus-border px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={exists ? "synced" : "native"}>
                    {exists ? copy.editing : copy.newFile}
                  </Badge>
                  <span className="text-sm font-semibold text-plexus-text">
                    {agent.displayName}
                  </span>
                </div>
                <code className="mt-1 block truncate font-mono text-xs text-plexus-text-3">
                  {agent.instructionFile}
                </code>
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
            <div className="border-b border-plexus-border bg-plexus-surface-2/40 px-5 py-2 text-xs text-plexus-text-3">
              {copy.snapshotNotice}
            </div>
            {msg && (
              <div className="border-b border-plexus-border bg-plexus-surface-2 px-5 py-2 text-xs text-plexus-text-2">
                {msg}
              </div>
            )}
            <textarea
              className="flex-1 resize-none bg-plexus-bg p-4 font-mono text-xs text-plexus-text outline-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2 border-t border-plexus-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {copy.close}
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={busy}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />}
                {busy ? copy.saving : copy.save}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
