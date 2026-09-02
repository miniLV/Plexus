import { describe, expect, it } from "vitest";

import {
  installAttempts,
  isRegistrySpec,
  registrySmokeSpec,
  shouldRetryInstall,
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
