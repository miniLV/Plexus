import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("skill-bundle-resources");
const { toggleSkillAgent } = await import("../src/effective/index.js");
const { COLLISION_BACKUP_ROOT } = await import("../src/backup/index.js");
const { AGENT_PATHS, PLEXUS_PATHS } = await import("../src/store/paths.js");

afterAll(() => sandbox.cleanup());

beforeEach(async () => {
  await fs.rm(PLEXUS_PATHS.root, { recursive: true, force: true });
  for (const dir of [".claude", ".cursor", ".codex", ".gemini", ".qwen", ".factory"]) {
    await fs.rm(path.join(sandbox.home, dir), { recursive: true, force: true });
  }
  await fs.rm(path.join(sandbox.home, ".claude.json"), { force: true });
});

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(p)));
    else out.push(p);
  }
  return out;
}

describe("skill bundle resources survive promote/sync", () => {
  it("copies scripts/ and lib/ into the store, then quarantines the native dir", async () => {
    const nativeDir = path.join(AGENT_PATHS.cursor.skillsDir, "demo");
    await fs.mkdir(path.join(nativeDir, "scripts", "lib"), { recursive: true });
    await fs.writeFile(
      path.join(nativeDir, "SKILL.md"),
      "---\nname: demo\ndescription: demo skill\n---\nbody\n",
      "utf8",
    );
    await fs.writeFile(path.join(nativeDir, "scripts", "run.sh"), "#!/bin/bash\n", "utf8");
    await fs.writeFile(
      path.join(nativeDir, "scripts", "lib", "helper.sh"),
      "#!/bin/bash\n",
      "utf8",
    );

    await toggleSkillAgent({ id: "demo", agent: "codex", enabled: true });

    // The Plexus store keeps the full bundle, not just SKILL.md.
    const storeDir = path.join(PLEXUS_PATHS.personal, "skills", "demo");
    await expect(fs.readFile(path.join(storeDir, "scripts", "run.sh"), "utf8")).resolves.toBe(
      "#!/bin/bash\n",
    );
    await expect(
      fs.readFile(path.join(storeDir, "scripts", "lib", "helper.sh"), "utf8"),
    ).resolves.toBe("#!/bin/bash\n");

    // The native source dir is now a symlink into the store.
    expect((await fs.lstat(nativeDir)).isSymbolicLink()).toBe(true);

    // The original real bundle was quarantined, not silently deleted.
    const collisions = await listFiles(COLLISION_BACKUP_ROOT);
    expect(collisions.some((p) => p.endsWith("run.sh"))).toBe(true);
    expect(collisions.some((p) => p.endsWith("helper.sh"))).toBe(true);
  });
});
