import { describe, expect, it } from "vitest";

import {
  describeRegistryStatus,
  installAttempts,
  isLatestDistTag,
  isRegistrySpec,
  isRegistryVersionReady,
  isVersionPublished,
  nextRegistryPollDelay,
  registryPackageUrl,
  registrySmokeSpec,
  shouldRetryInstall,
  shouldSkipPublish,
} from "./release-npm-lib.mjs";

describe("registrySmokeSpec", () => {
  it("pins the registry smoke install to the exact version, never @latest", () => {
    expect(registrySmokeSpec("plexus-agent-config", "0.0.17")).toBe("plexus-agent-config@0.0.17");
  });
});

describe("isRegistrySpec", () => {
  it("distinguishes a registry spec from a local tarball", () => {
    expect(isRegistrySpec("plexus-agent-config@0.0.17")).toBe(true);
    expect(isRegistrySpec("plexus-agent-config@latest")).toBe(true);
    expect(isRegistrySpec("/tmp/plexus-agent-config-0.0.17.tgz")).toBe(false);
  });
});

describe("installAttempts", () => {
  it("retries registry installs (CDN race) but not local tarballs", () => {
    expect(installAttempts("plexus-agent-config@0.0.17")).toBe(5);
    expect(installAttempts("/tmp/plexus-agent-config-0.0.17.tgz")).toBe(1);
  });
});

describe("shouldRetryInstall", () => {
  it("retries only on version mismatch with attempts left", () => {
    expect(shouldRetryInstall("0.0.16", "0.0.17", 1, 5)).toBe(true);
    expect(shouldRetryInstall("0.0.17", "0.0.17", 1, 5)).toBe(false);
    expect(shouldRetryInstall("0.0.16", "0.0.17", 5, 5)).toBe(false);
  });
});

describe("shouldSkipPublish", () => {
  it("skips republish when the target version is already on the registry", () => {
    expect(shouldSkipPublish("0.0.19", "0.0.19")).toBe(true);
    expect(shouldSkipPublish("0.0.18", "0.0.19")).toBe(false);
    expect(shouldSkipPublish(null, "0.0.19")).toBe(false);
  });
});

describe("registryPackageUrl", () => {
  it("builds unscoped and scoped packument URLs", () => {
    expect(registryPackageUrl("plexus-agent-config")).toBe(
      "https://registry.npmjs.org/plexus-agent-config",
    );
    expect(registryPackageUrl("@scope/pkg", "https://registry.npmjs.org")).toBe(
      "https://registry.npmjs.org/@scope%2Fpkg",
    );
  });
});

describe("registry readiness", () => {
  const manifest = {
    "dist-tags": { latest: "0.0.18" },
    versions: {
      "0.0.18": { version: "0.0.18" },
      "0.0.19": { version: "0.0.19", dist: { unpackedSize: 1, fileCount: 2 } },
    },
  };

  it("treats an exact version body as ready even when latest lags", () => {
    expect(isVersionPublished(manifest, "0.0.19")).toBe(true);
    expect(isLatestDistTag(manifest, "0.0.19")).toBe(false);
    expect(isRegistryVersionReady(manifest, "0.0.19")).toBe(true);
    expect(isRegistryVersionReady(manifest, "0.0.20")).toBe(false);
    expect(isRegistryVersionReady(null, "0.0.19")).toBe(false);
  });

  it("describes status for logs", () => {
    expect(describeRegistryStatus(manifest, "0.0.19")).toBe("latest=0.0.18, hasVersion=true");
    expect(describeRegistryStatus(null, "0.0.19")).toBe("manifest=<missing>");
  });

  it("backs off poll delay linearly up to the cap", () => {
    expect(nextRegistryPollDelay(1, 5_000, 30_000)).toBe(5_000);
    expect(nextRegistryPollDelay(2, 5_000, 30_000)).toBe(10_000);
    expect(nextRegistryPollDelay(10, 5_000, 30_000)).toBe(30_000);
  });
});
