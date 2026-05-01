# Team Plexus Config (template)

This is a starter layout for a team's shared Plexus config repo.

For a real starter config, see [miniLV/agent-primer](https://github.com/miniLV/agent-primer).
It uses this same layout and can be subscribed from Plexus directly.

Members run:

```bash
npx plexus-agent-config join https://github.com/your-org/team-plexus-config.git
```

…to clone this repo into `~/.config/plexus/team/`. Plexus then merges
team layer with the member's personal layer and pushes the result to every
installed AI agent.

## Layout

```
team-plexus-config/
├── rules/
│   └── global.md        # Team-wide instruction baseline
├── mcp/
│   └── servers.yaml      # Team-approved MCP servers
└── skills/
    └── <skill-id>/
        └── SKILL.md      # Markdown skill file (with frontmatter)
```

## Contributing as a member

1. In Plexus, go to **MCP Servers** or **Skills**, layer `personal`.
2. Add the server / skill you want to share.
3. Copy the generated file from `~/.config/plexus/personal/...` into the
   matching location under this repo.
4. Open a pull request. The team lead reviews, merges, and members pull.
