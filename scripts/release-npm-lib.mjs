/**
 * scripts/release-npm-lib.mjs — pure helpers for scripts/release-npm.mjs.
 *
 * Kept in a separate module (no side effects) so the release logic can be
 * unit-tested without importing the release script itself.
 */

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
