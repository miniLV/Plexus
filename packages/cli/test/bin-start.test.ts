/**
 * Issue #9 reproduction test: on Windows, `plexus start` crashed with
 * `spawn npm ENOENT` because npm is an npm.cmd shim there, and the
 * positional port in `plexus start 7778` was silently ignored.
 *
 * This test drives the real bin.ts entry with argv and captures what it
 * spawns. It must always hold that:
 *   1. the spawned command is the current Node binary, never "npm";
 *   2. a positional port is honored.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const { spawnMock, coreMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  coreMock: {
    ALL_AGENTS: [],
    detectAgents: vi.fn(() => []),
    ensureStoreScaffolding: vi.fn(async () => undefined),
    joinTeam: vi.fn(),
    pullTeam: vi.fn(),
    runShareAll: vi.fn(),
    teamStatus: vi.fn(),
  },
}));

vi.mock("node:child_process", () => ({ spawn: spawnMock }));
vi.mock("plexus-agent-config-core", () => coreMock);

describe("plexus start (issue #9)", () => {
  afterEach(() => {
    spawnMock.mockReset();
    spawnMock.mockReturnValue({ on: vi.fn() });
    process.argv = [...process.argv.slice(0, 2), "start"];
  });

  it("spawns the Node binary with next, never npm, and honors the positional port", async () => {
    spawnMock.mockReturnValue({ on: vi.fn() });
    process.argv = [process.execPath, "/path/to/plexus", "start", "7778"];

    await import("../src/bin.js");
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalled());

    const [command, args] = spawnMock.mock.calls[0];

    expect(command).toBe(process.execPath);
    expect(command).not.toBe("npm");
    expect(args).toContain("-p");
    expect(args[args.indexOf("-p") + 1]).toBe("7778");
  });
});
