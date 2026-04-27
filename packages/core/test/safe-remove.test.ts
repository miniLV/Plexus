/**
 * ADR-003: symlink-safe removal must never follow the link.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { setupSandbox } from "./_setup.js";

const sandbox = await setupSandbox("safe-remove");
const { safeRemove } = await import("../src/store/fs-utils.js");

afterAll(() => sandbox.cleanup());

describe("safeRemove", () => {
  it("removes only the symlink itself, not its target", async () => {
    const target = path.join(sandbox.home, "real");
    const link = path.join(sandbox.home, "link");
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, "important.txt"), "do not delete");
    await fs.symlink(target, link, "dir");

    const removed = await safeRemove(link);

    expect(removed).toBe(true);
    // Link gone, target intact.
    await expect(fs.lstat(link)).rejects.toThrow();
    await expect(fs.readFile(path.join(target, "important.txt"), "utf8")).resolves.toBe(
      "do not delete",
    );
  });

  it("recursively removes a real directory", async () => {
    const dir = path.join(sandbox.home, "real-dir");
    await fs.mkdir(path.join(dir, "nested"), { recursive: true });
    await fs.writeFile(path.join(dir, "nested", "a.txt"), "x");

    const removed = await safeRemove(dir);

    expect(removed).toBe(true);
    await expect(fs.lstat(dir)).rejects.toThrow();
  });

  it("returns false when the path is absent", async () => {
    const removed = await safeRemove(path.join(sandbox.home, "nope"));
    expect(removed).toBe(false);
  });

  it("removes a regular file", async () => {
    const file = path.join(sandbox.home, "file.txt");
    await fs.writeFile(file, "hi");
    expect(await safeRemove(file)).toBe(true);
    await expect(fs.lstat(file)).rejects.toThrow();
  });
});
