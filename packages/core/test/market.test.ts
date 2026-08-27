import { describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("market");
const { installMarketSkill, repoToSkillId } = await import("../src/market/index.js");

describe("market install id handling", () => {
  it("derives a folder-safe skill id from a repo name", () => {
    expect(repoToSkillId("Code-Review")).toBe("code-review");
    expect(repoToSkillId("My.Skill_2")).toBe("my.skill_2");
    expect(repoToSkillId("already-safe")).toBe("already-safe");
  });

  it("rejects an invalid repo reference without touching the network", async () => {
    const result = await installMarketSkill("not-a-repo");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Invalid repo reference/);
  });

  it("rejects an empty repo reference", async () => {
    const result = await installMarketSkill("   ");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Invalid repo reference/);
  });
});
