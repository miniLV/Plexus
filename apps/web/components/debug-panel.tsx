"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

export function DebugPanel({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/debug", { cache: "no-store" });
      const data = await res.json();
      if (typeof data.text === "string") setText(data.text);
      else setErr("Unexpected response shape from /api/debug");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const lineCount = text.split("\n").length;
  const byteCount = new Blob([text]).size;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs tracking-[0.02em] text-plexus-text-3">
          {lineCount} lines · {byteCount.toLocaleString()} bytes · paths only, no file contents
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={copy}>
            {copied ? (
              <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            {copied ? "Copied" : "Copy to clipboard"}
          </Button>
        </div>
      </div>

      {err && (
        <Card className="border-l-[3px] border-l-plexus-err px-4 py-2.5 text-xs text-plexus-text-2">
          {err}
        </Card>
      )}

      <Card className="p-0">
        <textarea
          readOnly
          value={text}
          spellCheck={false}
          className="w-full resize-y rounded-md bg-plexus-surface px-4 py-3 font-mono text-xs leading-relaxed text-plexus-text outline-none"
          style={{ minHeight: "60vh" }}
        />
      </Card>
    </div>
  );
}
