# Plexus

Local control panel for keeping AI agent configuration in sync across tools.

Plexus gives one human or one team a single local source of truth for:

- global agent rules (`CLAUDE.md` / `AGENTS.md`)
- MCP servers
- skills / prompt bundles
- backups and restore points before native files are changed

It is built for people who use more than one coding agent and do not want to
configure the same MCP server, skill, or operating instruction four times.

## Status

Alpha. The core local workflows are usable on macOS and Linux:

- detect Claude Code, Cursor, Codex, and Factory Droid
- import existing user-level MCP servers and skills
- save one global Rules baseline and apply it to built-in agents
- sync MCP servers and skills to each agent's native path
- mirror MCPs/skills from one agent to another
- snapshot native files before writes and restore from backups
- join/pull a team config repository as a read-only team layer

Windows and project-scoped MCP files are not verified yet.

## Quick Start

Requires Node 20.

```bash
git clone https://github.com/miniLV/Plexus.git
cd Plexus
npm ci
npm run dev
```

Open [http://localhost:7777](http://localhost:7777).

For a linked local CLI:

```bash
npm run link
plexus
```

To remove the linked CLI:

```bash
npm run unlink
```

## Supported Agents

| Agent | Rules target | MCP target | Skills target | MCP write mode |
| --- | --- | --- | --- | --- |
| Claude Code | `~/.claude/CLAUDE.md` | `~/.claude.json` | `~/.claude/skills/` | partial write |
| Cursor | `~/.cursor/AGENTS.md` | `~/.cursor/mcp.json` | `~/.cursor/commands/` | symlink or copy |
| Codex | `~/.codex/AGENTS.md` | `~/.codex/config.toml` | `~/.codex/prompts/` | partial write |
| Factory Droid | `~/.factory/AGENTS.md` | `~/.factory/mcp.json` | `~/.factory/skills/` | symlink or copy |

Partial write means Plexus rewrites only the MCP section and preserves the
agent-owned auth, history, profile, and settings data in the same file.

## What Plexus Stores

Plexus stores canonical config under `~/.config/plexus/`:

```text
~/.config/plexus/
├── config.yaml
├── team/
├── personal/
│   ├── mcp/servers.yaml
│   ├── rules/global.md
│   └── skills/<id>/SKILL.md
├── .cache/mcp/
└── backups/
```

The `team/` layer is intended to come from a shared Git repo. The `personal/`
layer belongs to the local user and overrides team entries with the same ID.

## Main Workflows

### Rules

Use `/rules` to edit one shared baseline. Plexus saves it to:

```text
~/.config/plexus/personal/rules/global.md
```

Then it can apply the same content to each supported agent's instruction file.
Existing native instruction files are snapshotted before replacement.

### Import

The dashboard import banner scans installed agents and offers to import
native MCP servers and skills into the personal layer.

Import does not mutate native files. It only writes to `~/.config/plexus/`.

### Sync

`Sync All Agents` and `plexus sync` apply the merged team + personal store to
all installed, enabled agents.

Before changing native files, Plexus snapshots the current state into
`~/.config/plexus/backups/`.

### Mirror

`/mirror` copies the effective MCP/skill set from one source agent to one or
more targets. This is useful when one agent is already configured and another
is empty.

### Backups

`/backups` lists snapshots and can restore a previous native file state. The
restore action is intentionally destructive: it puts the selected snapshot
back over the current native file.

## CLI

```text
plexus              start the dashboard
plexus start -p 7777
plexus detect       list detected agents
plexus join <url>   clone a team config repo into ~/.config/plexus/team
plexus pull         pull the configured team repo
plexus sync         sync MCP servers and skills
plexus status       show team subscription and sync status
plexus help
```

## Development

```bash
npm ci
npm run check
npm run test:core
npm run build --workspace=@plexus/core
npm run build --workspace=@plexus/web
```

For the full local gate:

```bash
npm run verify
```

## Security Notes

- Plexus is local-first and does not execute MCP servers.
- Plexus is not a secrets manager.
- Imported MCP `env` values are stored as plaintext in the local personal
  store.
- Do not push `~/.config/plexus/personal/` to a shared team repo without
  reviewing and redacting secrets.
- Debug snapshots intentionally return metadata only, not file contents.

## Limitations

- Project-scoped MCP files are not managed yet.
- Team subscription can clone, pull, and report status; dashboard PR proposal
  and conflict resolution are still manual.
- Custom agents are stored as instruction-file registry records only.
- Rules apply currently targets built-in agents only.
- Windows support is unverified.

## License

[Apache-2.0](./LICENSE)
