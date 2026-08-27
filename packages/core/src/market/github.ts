import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export const GITHUB_API = "https://api.github.com";

const DEFAULT_USER_AGENT = "plexus-agent-config";

let tokenCache: string | null | undefined;

/**
 * Resolve a GitHub access token, best-effort:
 *
 * 1. `GITHUB_TOKEN` / `GH_TOKEN` env vars.
 * 2. `gh auth token` (GitHub CLI), if installed and authenticated.
 *
 * Falls back to `null` (unauthenticated) when nothing is available. A token
 * is optional: it only raises the API rate limit.
 */
export async function githubToken(): Promise<string | null> {
  if (tokenCache !== undefined) return tokenCache;

  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnv) {
    tokenCache = fromEnv;
    return tokenCache;
  }

  try {
    const { stdout } = await exec("gh", ["auth", "token"]);
    tokenCache = stdout.trim() || null;
  } catch {
    tokenCache = null;
  }
  return tokenCache;
}

export async function githubGet<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await githubToken();
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": DEFAULT_USER_AGENT,
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${GITHUB_API}${path}`, { ...init, headers });

  if (res.status === 403) {
    throw new Error(
      "GitHub API rate limit exceeded. Set GITHUB_TOKEN to raise the limit, or try again later.",
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub request failed (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}
