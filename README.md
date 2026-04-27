# Plexus

> Team-shared AI agent config — one source of truth for MCP servers and skills,
> synced to Claude Code, Cursor, Codex, and Factory Droid.

Plexus is a local-only web dashboard that lets a team curate their AI agent
configuration in one place (a Git repo) and push it to every team member's
installed agents with one click.

## Why

If you use more than one AI coding agent (Claude Code + Cursor + Codex …) you
quickly hit the same chore in every project: install the same MCP servers four
times, paste the same review skill four times, then keep them in sync forever.

Plexus solves that by:

1. Keeping a **single store** under `~/.config/plexus/` (`team/` + `personal/`).
2. **Detecting** the agents installed on your machine.
3. **Syncing** the store to each agent's native config (`claude_desktop_config.json`,
   `~/.cursor/mcp.json`, `~/.codex/config.toml`, `~/.factory/mcp.json`, plus each
   agent's skills directory) — preferring symlinks so future edits flow through
   automatically.
4. Letting a **team** subscribe to a shared Git repo as the team layer.
   Members get team-blessed MCPs + skills automatically; they can also keep
   their own additions in the personal layer.

## Status

**Alpha — MVP**. Sync of MCP + skills works for all four supported agents on
macOS / Linux. Team subscription is implemented as `git clone` + `git pull`.
Open-a-PR-from-the-dashboard is on the roadmap; for now contributors push
through the normal GitHub review flow.

## Quick start

Requires **Node ≥ 18.17**.

```bash
# Clone and install
git clone https://github.com/miniLV/Plexus.git
cd Plexus
npm install

# Build the workspace packages
npm run build

# Launch the dashboard
node packages/cli/dist/bin.js
# → opens http://localhost:7777
```

Or, in development:

```bash
npm run dev   # Next.js dev server on :7777
```

### CLI commands

```
plexus              start the dashboard (default)
plexus detect       list detected AI agents on this machine
plexus join <url>   subscribe to a team config repo
plexus pull         refresh the team layer from upstream
plexus sync         apply current store to all enabled agents
plexus status       show subscription / sync status
```

## Supported agents

| Agent | MCP location | Skills location |
| ---- | ---- | ---- |
| Claude Code | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) | `~/.claude/skills/` |
| Cursor | `~/.cursor/mcp.json` | `~/.cursor/commands/` |
| Codex | `~/.codex/config.toml` (TOML, auto-converted) | `~/.codex/prompts/` |
| Factory Droid | `~/.factory/mcp.json` | `~/.factory/skills/` |

## Architecture

```
plexus/
├── apps/
│   └── web/                     # Next.js dashboard (local only)
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── types.ts
│   │       ├── store/           # ~/.config/plexus/ store: paths, config, mcp, skills, merge
│   │       ├── agents/          # detection + per-agent adapters
│   │       │   └── adapters/
│   │       ├── sync/            # sync engine
│   │       └── team/            # git-backed team layer
│   └── cli/                     # `plexus` CLI entry
└── examples/
    └── team-config-template/    # starter layout for a team repo
```

Per-agent integration lives under `packages/core/src/agents/adapters/`. Adding
a new agent means writing a new adapter (≤ 80 lines for the JSON-MCP flavor)
and registering it in `agents/adapters/index.ts`.

## License

[Apache-2.0](./LICENSE)
