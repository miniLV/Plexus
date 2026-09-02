/**
 * Regression tests for the `plexus start` dashboard bootstrap.
 *
 * Issue #9: `spawn("npm", ...)` crashes with ENOENT on Windows where npm is
 * an npm.cmd shim. The dashboard must always be started via the current Node
 * binary running the Next.js CLI entry directly, never via npm.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

const { findWebDir, parsePortArg, resolveDashboardCommand, startDashboard } = await import(
  "../src/start.js"
);

let tmpRoot: string;

async function makeWebDir(withProdBuild: boolean): Promise<string> {
  const dir = await fs.mkdtemp(path.join(tmpRoot, "web-"));
  await fs.writeFile(path.join(dir, "package.json"), "{}", "utf8");
  if (withProdBuild) {
    await fs.mkdir(path.join(dir, ".next"), { recursive: true });
  }
  return dir;
}

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "plexus-start-test-"));
});

beforeEach(() => {
  spawnMock.mockReset();
  spawnMock.mockReturnValue({
    on: vi.fn(),
  });
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
});

describe("parsePortArg", () => {
  it("honors a positional port (issue #9: 'plexus start 7778' used to be ignored)", () => {
    expect(parsePortArg(["7778"])).toBe(7778);
  });

  it("honors -p and --port flags", () => {
    expect(parsePortArg(["-p", "3000"])).toBe(3000);
    expect(parsePortArg(["--port", "3000"])).toBe(3000);
  });

  it("prefers the flag over a positional value", () => {
    expect(parsePortArg(["7778", "-p", "3000"])).toBe(3000);
  });

  it("falls back to 7777 for missing, garbage, or non-integer values", () => {
    expect(parsePortArg([])).toBe(7777);
    expect(parsePortArg(["abc"])).toBe(7777);
    expect(parsePortArg(["-p"])).toBe(7777);
    expect(parsePortArg(["-p", "abc"])).toBe(7777);
  });
});

describe("resolveDashboardCommand", () => {
  it("never spawns npm; always the current Node binary (issue #9)", async () => {
    const webDir = await makeWebDir(true);
    const spec = resolveDashboardCommand(webDir, 7777, () => "/fake/next/dist/bin/next");
    expect(spec).not.toBeNull();
    expect(spec?.command).not.toBe("npm");
    expect(spec?.command).toBe(process.execPath);
    expect(spec?.args.some((a) => a === "run")).toBe(false);
  });

  it("runs next start when a production build exists", async () => {
    const webDir = await makeWebDir(true);
    const spec = resolveDashboardCommand(webDir, 7777, () => "/fake/next");
    expect(spec?.args).toEqual(["/fake/next", "start", "-p", "7777"]);
  });

  it("runs next dev without a production build", async () => {
    const webDir = await makeWebDir(false);
    const spec = resolveDashboardCommand(webDir, 7778, () => "/fake/next");
    expect(spec?.args).toEqual(["/fake/next", "dev", "-p", "7778"]);
  });

  it("returns null when the Next.js CLI cannot be resolved", async () => {
    const webDir = await makeWebDir(true);
    expect(resolveDashboardCommand(webDir, 7777, () => null)).toBeNull();
  });

  it("resolves the real Next.js CLI from the monorepo web dir", () => {
    const repoWebDir = path.resolve(import.meta.dirname, "../../../apps/web");
    const spec = resolveDashboardCommand(repoWebDir, 7777);
    expect(spec).not.toBeNull();
    expect(spec?.args[0]).toContain(path.join("node_modules", "next", "dist", "bin", "next"));
    expect(spec?.command).toBe(process.execPath);
  });
});

describe("startDashboard", () => {
  it("spawns with inherited stdio, cwd, and env passthrough", () => {
    startDashboard({
      command: process.execPath,
      args: ["next", "start", "-p", "7777"],
      cwd: "/fake/web",
      env: { PORT: "7777", PLEXUS_PORT: "7777" },
    });
    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      ["next", "start", "-p", "7777"],
      expect.objectContaining({ cwd: "/fake/web", stdio: "inherit" }),
    );
    const options = spawnMock.mock.calls[0][2];
    expect(options.env.PORT).toBe("7777");
    expect(options.env.PLEXUS_PORT).toBe("7777");
  });

  it("registers an error handler so spawn failures do not crash with an unhandled 'error' event (issue #9 stack)", () => {
    const on = vi.fn();
    spawnMock.mockReturnValue({ on });
    startDashboard({
      command: process.execPath,
      args: ["next"],
      cwd: "/fake/web",
      env: {},
    });
    const registered = on.mock.calls.map((call) => call[0]);
    expect(registered).toContain("error");
    expect(registered).toContain("exit");
  });
});

describe("findWebDir", () => {
  it("finds a directory that has a package.json", () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../..");
    const webDir = findWebDir({ dirname: path.join(repoRoot, "nowhere"), cwd: repoRoot });
    expect(webDir).not.toBeNull();
    expect(webDir).toContain("apps");
  });
});
