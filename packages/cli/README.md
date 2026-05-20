# Plexus Agent Config

Local dashboard for syncing rules, MCP servers, and skills across Claude Code,
Cursor, Codex, Gemini CLI, and Qwen Code.

## Quick start

Requires Node 20.

```bash
npx -y plexus-agent-config@latest start
```

Then open `http://localhost:7777`.

## What it does

- imports existing agent config from your machine
- keeps a canonical local store under `~/.config/plexus/`
- syncs rules, MCP servers, and skills back into each tool's native format
- snapshots native files before writes
- partial-writes shared config files instead of replacing them wholesale

Plexus does not execute MCP servers.

## Supported agents

- Claude Code
- Cursor
- Codex
- Gemini CLI
- Qwen Code
- Factory Droid

## Links

- Homepage: https://minilv.github.io/Plexus/
- Repository: https://github.com/miniLV/Plexus
- Guides: https://minilv.github.io/Plexus/guides.html
