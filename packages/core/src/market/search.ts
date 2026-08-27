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
  topic?: string;
  query?: string;
  limit?: number;
}

export const DEFAULT_MARKET_TOPIC = "claude-skills";

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

/**
 * Search GitHub for community skill repos, ranked by star count (descending).
 *
 * Defaults to `topic:claude-skills`. Results are cached in-memory for a short
 * window to stay friendly to GitHub's unauthenticated search rate limit.
 */
export async function searchMarketSkills(
  options: SearchMarketOptions = {},
): Promise<MarketSkill[]> {
  const topic = options.topic?.trim() || DEFAULT_MARKET_TOPIC;
  const query = options.query?.trim() || "";
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);

  const qParts = [`topic:${topic}`];
  if (query) qParts.push(`${query} in:name,description,readme`);
  const q = qParts.join(" ");

  const cacheKey = `${q}\u0000${limit}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.skills;

  const params = new URLSearchParams({
    q,
    sort: "stars",
    order: "desc",
    per_page: String(limit),
  });

  const data = await githubGet<SearchResponse>(`/search/repositories?${params.toString()}`);

  const personalIds = new Set((await readSkills("personal")).map((s) => s.id));

  const skills: MarketSkill[] = data.items
    .map((item) => ({
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
      installed: personalIds.has(repoToSkillId(item.name)),
    }))
    .sort((a, b) => b.stars - a.stars);

  cache.set(cacheKey, { at: Date.now(), skills });
  return skills;
}
