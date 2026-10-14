/**
 * scripts/release-npm-lib.mjs — pure helpers for scripts/release-npm.mjs.
 *
 * Kept in a separate module (no side effects) so the release logic can be
 * unit-tested without importing the release script itself.
 */

/** How long to wait for npm CDN/metadata after a successful publish. */
export const REGISTRY_READY_TIMEOUT_MS = 10 * 60 * 1000;

/** Base poll interval; grows with attempt via nextRegistryPollDelay. */
export const REGISTRY_POLL_BASE_MS = 5_000;

export const REGISTRY_POLL_MAX_MS = 30_000;

/**
 * The registry smoke test must install a pinned version, not `@latest`.
 * `@latest` is a dist-tag that npm's CDN can serve stale for a while after a
 * publish, so the smoke install can pull the previous version and fail the
 * gate. Pinning the exact version avoids that race.
 */
export function registrySmokeSpec(packageName, version) {
  return `${packageName}@${version}`;
}

/** A spec is a registry spec unless it points at a local tarball. */
export function isRegistrySpec(spec) {
  return !spec.endsWith(".tgz");
}

/**
 * Registry installs race the CDN and are worth retrying; a local tarball
 * install is deterministic and gets a single attempt.
 */
export function installAttempts(spec, maxRegistryAttempts = 5) {
  return isRegistrySpec(spec) ? maxRegistryAttempts : 1;
}

/** Retry only when the installed version is wrong and attempts remain. */
export function shouldRetryInstall(installedVersion, expectedVersion, attempt, maxAttempts) {
  return installedVersion !== expectedVersion && attempt < maxAttempts;
}

/**
 * If this version is already on npm, skip `npm publish` and continue with
 * registry verify + smoke. That makes a re-run after a successful publish /
 * failed post-publish gate safe (no 403 "cannot publish over").
 */
export function shouldSkipPublish(remoteVersion, targetVersion) {
  return remoteVersion === targetVersion;
}

export function registryPackageUrl(packageName, registry = "https://registry.npmjs.org/") {
  const base = registry.endsWith("/") ? registry.slice(0, -1) : registry;
  // Scoped packages: /@scope%2Fname ; unscoped: /name
  const path = packageName.startsWith("@") ? packageName.replace("/", "%2F") : packageName;
  return `${base}/${path}`;
}

/** Exact version document is visible in the packument (not merely dist-tags). */
export function isVersionPublished(manifest, version) {
  return Boolean(manifest?.versions?.[version]);
}

export function isLatestDistTag(manifest, version) {
  return manifest?.["dist-tags"]?.latest === version;
}

/**
 * Ready for post-publish smoke when the exact version packument entry exists.
 * Do not require `dist-tags.latest` — that tag can lag on the CDN even after
 * the version body is installable (same class of race as @latest installs).
 */
export function isRegistryVersionReady(manifest, version) {
  return isVersionPublished(manifest, version);
}

/** Linear backoff capped at maxMs: attempt 1 → base, 2 → 2*base, ... */
export function nextRegistryPollDelay(
  attempt,
  baseMs = REGISTRY_POLL_BASE_MS,
  maxMs = REGISTRY_POLL_MAX_MS,
) {
  const n = Math.max(1, Number(attempt) || 1);
  return Math.min(baseMs * n, maxMs);
}

export function describeRegistryStatus(manifest, version) {
  if (!manifest) return "manifest=<missing>";
  const latest = manifest["dist-tags"]?.latest ?? "<missing>";
  const hasVersion = isVersionPublished(manifest, version);
  return `latest=${latest}, hasVersion=${hasVersion}`;
}
