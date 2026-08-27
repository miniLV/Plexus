import { readSkills } from "../store/skills.js";
import { githubGet } from "./github.js";
import { repoToSkillId } from "./install.js";

export interface MarketSkill {
  /** Full repo reference, "owner/repo". */
  id: string;
  owner: string;
  repo: string;
  /** Repo name (also the default local skill id). */
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
  /** Whether this repo's skill is already in the Plexus personal store. */
  installed: boolean;
}

export interface SearchMarketOptions {
  /** Optional single topic to restrict to. Omit to search all default topics. */
  topic?: string;
  query?: string;
  /** 1-based page number. */
  page?: number;
  perPage?: number;
}

export interface MarketSearchResult {
  skills: MarketSkill[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * GitHub topics that commonly tag a single agent-skill repo. We query each one
 * and merge into a single star-ranked list, so the marketplace reads as one
 * list instead of exposing raw GitHub topic labels to the user.
 */
export const DEFAULT_MARKET_TOPICS = ["claude-skills", "claude-skill", "agent-skills", "ai-skills"];

const DEFAULT_PER_PAGE = 30;
/** Cap the merged list at 150 so the marketplace shows at most 5 pages. */
const MAX_RESULTS = 150;
/** GitHub's search API caps per_page at 100. */
const TOPIC_PAGE_SIZE = 100;

interface SearchRepoItem {
  full_name: string;
  name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  homepage: string | null;
  stargazers_count: number;
  language: string | null;
  topics?: string[];
  default_branch: string;
  html_url: string;
  updated_at: string;
}

interface SearchResponse {
  items: SearchRepoItem[];
}

const cache = new Map<string, { at: number; skills: MarketSkill[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function mapItem(item: SearchRepoItem): MarketSkill {
  return {
    id: item.full_name,
    owner: item.owner.login,
    repo: item.name,
    name: item.name,
    fullName: item.full_name,
    description: item.description,
    homepage: item.homepage,
    stars: item.stargazers_count,
    language: item.language,
    topics: item.topics ?? [],
    defaultBranch: item.default_branch,
    htmlUrl: item.html_url,
    ownerAvatar: item.owner.avatar_url,
    updatedAt: item.updated_at,
    installed: false,
  };
}

async function searchTopic(topic: string, query: string): Promise<MarketSkill[]> {
  const q = `topic:${topic}${query ? ` ${query} in:name,description,readme` : ""}`;
  const params = new URLSearchParams({
    q,
    sort: "stars",
    order: "desc",
    per_page: String(TOPIC_PAGE_SIZE),
  });
  const data = await githubGet<SearchResponse>(`/search/repositories?${params.toString()}`);
  return data.items.map(mapItem);
}

/** Fetch + merge the full ranked list (deduped, capped) for a query. */
async function loadRankedSkills(topics: string[], query: string): Promise<MarketSkill[]> {
  const settled = await Promise.allSettled(topics.map((topic) => searchTopic(topic, query)));

  const fulfilled = settled.filter(
    (result): result is PromiseFulfilledResult<MarketSkill[]> => result.status === "fulfilled",
  );
  if (fulfilled.length === 0) {
    const first = settled.find((result) => result.status === "rejected");
    throw (first as PromiseRejectedResult | undefined)?.reason ?? new Error("GitHub search failed");
  }

  const byId = new Map<string, MarketSkill>();
  for (const result of fulfilled) {
    for (const skill of result.value) {
      if (!byId.has(skill.id)) byId.set(skill.id, skill);
    }
  }

  const personalIds = new Set((await readSkills("personal")).map((s) => s.id));
  return [...byId.values()]
    .map((skill) => ({ ...skill, installed: personalIds.has(repoToSkillId(skill.repo)) }))
    .sort((a, b) => b.stars - a.stars)
    .slice(0, MAX_RESULTS);
}

/**
 * Search GitHub for community skill repos, ranked by star count (descending),
 * with pagination (at most 5 pages).
 *
 * GitHub's `OR` operator only applies to text terms, not `topic:` qualifiers,
 * so we query each topic in parallel, dedupe by repo, then sort the union by
 * stars. The full ranked list is cached in-memory for a short window to stay
 * friendly to the search API's rate limit; pagination happens in memory.
 */
export async function searchMarketSkills(
  options: SearchMarketOptions = {},
): Promise<MarketSearchResult> {
  const topics = options.topic?.trim() ? [options.topic.trim()] : DEFAULT_MARKET_TOPICS;
  const query = options.query?.trim() || "";
  const perPage = Math.min(Math.max(options.perPage ?? DEFAULT_PER_PAGE, 1), MAX_RESULTS);
  const page = Math.max(options.page ?? 1, 1);

  const cacheKey = `${topics.join(",")}\u0000${query}`;
  const hit = cache.get(cacheKey);
  let ranked: MarketSkill[];
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    ranked = hit.skills;
  } else {
    ranked = await loadRankedSkills(topics, query);
    cache.set(cacheKey, { at: Date.now(), skills: ranked });
  }

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;

  return {
    skills: ranked.slice(start, start + perPage),
    total,
    page: safePage,
    perPage,
    totalPages,
  };
}
