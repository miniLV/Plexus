/**
 * Test sandbox helper.
 *
 * Plexus path constants (`PLEXUS_PATHS`, `AGENT_PATHS`) are computed from
 * `os.homedir()` at module load. Each test file therefore runs in its own
 * fork (see vitest.config.ts `pool: "forks"`) and stubs `HOME` to a fresh
 * tmpdir BEFORE importing any plexus module.
 *
 * Usage in a test file:
 *
 * ```ts
 * import { setupSandbox } from "./_setup.js";
 * const { home } = await setupSandbox("my-test");
 * const { snapshotAgentConfigs } = await import("../src/backup/index.js");
 * ```
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface Sandbox {
  home: string;
  cleanup: () => Promise<void>;
}

export async function setupSandbox(label: string): Promise<Sandbox> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `plexus-${label}-`));
  process.env.HOME = home;
  // Some libs read USERPROFILE on Windows; mirror it in case a contributor
  // runs the suite there even though we don't claim Windows support.
  process.env.USERPROFILE = home;
  return {
    home,
    cleanup: async () => {
      await fs.rm(home, { recursive: true, force: true });
    },
  };
}
