/**
 * ADR-008 / CLAUDE.md §4.3: quarantineCollision must move a real file or dir
 * into the central _collisions/ tree, leaving the original path absent so a
 * symlink can replace it.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("quarantine");
const { quarantineCollision, COLLISION_BACKUP_ROOT } = await import("../src/backup/index.js");

afterAll(() => sandbox.cleanup());

describe("quarantineCollision", () => {
  it("evicts a real folder to _collisions/ and removes the original", async () => {
    const dir = path.join(sandbox.home, ".cursor", "collide-folder");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "inner.txt"), "x");

    const dest = await quarantineCollision({ agent: "cursor", sourcePath: dir });

    expect(dest).toBeTruthy();
    expect(dest).toContain(path.join("_collisions"));
    // Original is gone.
    await expect(fs.lstat(dir)).rejects.toThrow();
    // Quarantined content survived.
    expect(await fs.readFile(path.join(dest!, "inner.txt"), "utf8")).toBe("x");
    // Lives under the expected root.
    expect(dest!.startsWith(COLLISION_BACKUP_ROOT)).toBe(true);
  });

  it("handles a regular file collision the same way", async () => {
    const file = path.join(sandbox.home, ".cursor", "collide.json");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{"hello":"world"}');

    const dest = await quarantineCollision({ agent: "cursor", sourcePath: file });

    expect(dest).toBeTruthy();
    await expect(fs.lstat(file)).rejects.toThrow();
    expect(await fs.readFile(dest!, "utf8")).toBe('{"hello":"world"}');
  });

  it("returns null when the source path doesn't exist", async () => {
    const dest = await quarantineCollision({
      agent: "cursor",
      sourcePath: path.join(sandbox.home, "does-not-exist"),
    });
    expect(dest).toBeNull();
  });
});
