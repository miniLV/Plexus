import { describe, expect, it } from "vitest";

import { isBackdated } from "./verify-release.mjs";

describe("isBackdated", () => {
  it("detects a published_at before created_at (issue #9 follow-up: v0.0.16)", () => {
    expect(isBackdated("2026-04-30T11:08:09Z", "2026-09-02T12:10:18Z")).toBe(true);
  });

  it("accepts a published_at at or after created_at", () => {
    expect(isBackdated("2026-09-02T12:18:30Z", "2026-09-02T12:10:18Z")).toBe(false);
    expect(isBackdated("2026-09-02T12:10:18Z", "2026-09-02T12:10:18Z")).toBe(false);
  });

  it("returns false when either timestamp is missing", () => {
    expect(isBackdated("", "2026-09-02T12:10:18Z")).toBe(false);
    expect(isBackdated("2026-04-30T11:08:09Z", "")).toBe(false);
    expect(isBackdated(null, null)).toBe(false);
    expect(isBackdated(undefined, undefined)).toBe(false);
  });

  it("compares same-minute timestamps lexicographically (ISO 8601)", () => {
    expect(isBackdated("2026-09-02T12:09:59Z", "2026-09-02T12:10:00Z")).toBe(true);
    expect(isBackdated("2026-09-02T12:10:01Z", "2026-09-02T12:10:00Z")).toBe(false);
  });
});
