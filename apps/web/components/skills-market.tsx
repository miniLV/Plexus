"use client";

import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Download, ExternalLink, Loader2, Search, Star } from "lucide-react";
import { useEffect, useState } from "react";

interface MarketSkill {
  id: string;
  owner: string;
  repo: string;
  name: string;
  fullName: string;
  description: string | null;
  homepage: string | null;
  stars: number;
  language: string | null;
  topics: string[];
  defaultBranch: string;
  htmlUrl: string;
  ownerAvatar: string;
  updatedAt: string;
  installed: boolean;
}

const COPY = {
  en: {
    searchPlaceholder: "Search skills…",
    loading: "Loading market…",
    error: "Couldn't load the market",
    empty: "No skills found for this search.",
    install: "Install",
    installed: "Installed",
    installing: "Installing…",
    installFailed: "Install failed",
    installedToast: (name: string) => `${name} installed and synced`,
    ranking: "Community agent skills from GitHub, ranked by stars",
    retry: "Retry",
    prev: "Prev",
    next: "Next",
    results: (total: number) => `${total} skills`,
  },
  zh: {
    searchPlaceholder: "搜索技能…",
    loading: "正在加载市场…",
    error: "无法加载市场",
    empty: "没有找到匹配的技能。",
    install: "安装",
    installed: "已安装",
    installing: "安装中…",
    installFailed: "安装失败",
    installedToast: (name: string) => `${name} 已安装并同步`,
    ranking: "来自 GitHub 社区的 Agent Skills，按星标排行",
    retry: "重试",
    prev: "上一页",
    next: "下一页",
    results: (total: number) => `${total} 个技能`,
  },
};

function formatStars(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(value);
}

export function SkillsMarket() {
  const { locale } = useLanguage();
  const copy = COPY[locale];

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const [skills, setSkills] = useState<MarketSkill[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (submitted) params.set("query", submitted);
    fetch(`/api/market?${params.toString()}`)
      .then((res) => res.json())
      .then(
        (data: {
          skills?: MarketSkill[];
          total?: number;
          totalPages?: number;
          error?: string;
        }) => {
          if (cancelled) return;
          if (data.error) {
            setError(data.error);
            setSkills([]);
          } else {
            setSkills(data.skills ?? []);
            setTotal(data.total ?? 0);
            setTotalPages(data.totalPages ?? 1);
          }
        },
      )
      .catch(() => {
        if (!cancelled) setError(copy.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submitted, page, nonce, copy.error]);

  async function install(skill: MarketSkill) {
    setInstalling(skill.id);
    setMsg(null);
    try {
      const res = await fetch("/api/market/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo: skill.fullName }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        name?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setMsg(`${copy.installFailed}: ${data.error ?? "unknown error"}`);
        return;
      }
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, installed: true } : s)));
      setMsg(copy.installedToast(data.name ?? skill.name));
    } catch (err) {
      setMsg(`${copy.installFailed}: ${String(err)}`);
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSubmitted(query.trim());
            }}
          >
            <Search
              className="-translate-y-1/2 absolute top-1/2 left-2.5 h-3.5 w-3.5 text-plexus-text-mute"
              strokeWidth={1.5}
            />
            <input
              className="h-8 w-64 rounded border border-plexus-border bg-plexus-surface-2 pr-3 pl-8 text-xs placeholder:text-plexus-text-mute focus:border-plexus-accent focus:outline-none"
              placeholder={copy.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          <div className="flex items-center gap-1.5 text-xs text-plexus-text-3">
            <Star className="h-3.5 w-3.5" strokeWidth={1.5} />
            {copy.ranking}
          </div>
          {msg && <span className="text-xs text-plexus-accent">{msg}</span>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-plexus-text-3">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          {copy.loading}
        </div>
      ) : error ? (
        <Card className="space-y-3 px-4 py-8 text-center">
          <div className="text-sm text-plexus-err">{copy.error}</div>
          <div className="text-xs text-plexus-text-3">{error}</div>
          <Button variant="secondary" size="sm" onClick={() => setNonce((n) => n + 1)}>
            {copy.retry}
          </Button>
        </Card>
      ) : skills.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-plexus-text-3">{copy.empty}</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {skills.map((skill) => {
            const busy = installing === skill.id;
            return (
              <Card
                key={skill.id}
                className="flex flex-col gap-3 border-l-[3px] border-l-transparent p-4 hover:border-plexus-border-strong"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={skill.ownerAvatar}
                    alt=""
                    className="mt-0.5 h-8 w-8 shrink-0 rounded-sm border border-plexus-border"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={skill.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-[13px] font-medium text-plexus-text hover:text-plexus-accent"
                        title={skill.fullName}
                      >
                        {skill.fullName}
                      </a>
                      <ExternalLink
                        className="h-3 w-3 shrink-0 text-plexus-text-3"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-plexus-text-3">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-plexus-warn" strokeWidth={1.5} />
                        {formatStars(skill.stars)}
                      </span>
                      {skill.language && <span>{skill.language}</span>}
                    </div>
                  </div>
                </div>

                {skill.description && (
                  <p className="line-clamp-3 text-xs leading-relaxed text-plexus-text-2">
                    {skill.description}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {skill.topics.slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline" className="font-mono">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  {skill.installed ? (
                    <Badge variant="synced" className="gap-1">
                      <Check className="h-3 w-3" strokeWidth={1.7} />
                      {copy.installed}
                    </Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="border-plexus-accent/35 text-plexus-text hover:border-plexus-accent/60"
                      onClick={() => install(skill)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                      {busy ? copy.installing : copy.install}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !error && skills.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-plexus-border pt-4">
          <span className="text-xs text-plexus-text-3">{copy.results(total)}</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {copy.prev}
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={
                  page === n
                    ? "h-7 w-7 rounded-sm bg-plexus-accent/15 text-xs font-medium text-plexus-text shadow-[inset_0_0_0_1px_var(--plexus-accent)]"
                    : "h-7 w-7 rounded-sm text-xs text-plexus-text-2 hover:bg-plexus-surface-2 hover:text-plexus-text"
                }
              >
                {n}
              </button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {copy.next}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
