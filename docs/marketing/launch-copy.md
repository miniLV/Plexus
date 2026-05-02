# Plexus Launch Copy

Use this as source material. Edit each post in your own voice before publishing.

Canonical link:

`https://github.com/miniLV/Plexus`

## Core Message

One sentence:

> Plexus is a local dashboard for sharing rules, MCP servers, and skills across
> Claude Code, Cursor, Codex, Gemini CLI, Qwen Code, and other AI coding tools.

One paragraph:

> I built Plexus because my AI coding setup had turned into five separate config
> systems. Claude Code, Cursor, Codex, Gemini CLI, and Qwen Code each have their
> own instruction files, MCP formats, and skill folders. Plexus imports what is
> already on your machine, lets you choose a primary source when configs
> conflict, and projects the result back into each tool's native format with
> previews and backups.

## Demo Script

Length: 45-60 seconds.

1. Show the problem: open `CLAUDE.md`, `AGENTS.md`, `.claude.json`,
   `.cursor/mcp.json`, and `.codex/config.toml`.
2. Open Plexus dashboard.
3. Click `Share config everywhere`.
4. Show the smart-merge preview and primary agent picker.
5. Apply sync.
6. Show Claude Code, Cursor, and Codex now share the same rule/MCP/skill.
7. Open Backups and show that native files were snapshotted before writes.

Voiceover:

> AI coding tools are great, but each one has its own config universe. I got
> tired of copying the same MCP servers, rules, and skills between Claude Code,
> Cursor, Codex, and Gemini CLI. Plexus gives them one local source of truth,
> then writes back to each native format with previews and backups.

## Hacker News

Title:

```text
Show HN: Plexus - one local dashboard for AI coding tool configs
```

Maker comment:

```text
Hi HN, I built Plexus because my AI coding setup had turned into five config systems.

I use different tools for different jobs: Claude Code for planning, Cursor for editing, Codex for automation, and sometimes Gemini CLI or Qwen Code. The annoying part is that every tool has its own instruction file, MCP format, and skills or commands directory.

Plexus is a local dashboard that imports what you already have, lets you choose a primary source when configs conflict, and syncs rules, MCP servers, and skills back into each agent's native location.

The safety model is the main thing I cared about:

- local-first, no hosted service
- does not run MCP servers
- snapshots native files before writes
- partial-writes shared config files like ~/.claude.json and ~/.codex/config.toml instead of replacing them
- supports Claude Code, Cursor, Codex, Gemini CLI, Qwen Code, and Factory Droid today

It is still early. The quickest install path is:

npx -y plexus-agent-config@latest start

I would especially love feedback on the sync model, backup semantics, and what other AI coding tools should be supported next.
```

## Reddit: r/ClaudeAI

Title:

```text
I built an open-source local dashboard to sync Claude Code config with Cursor, Codex, and Gemini CLI
```

Body:

```text
I kept running into a boring but persistent Claude Code problem: once I had useful MCP servers, rules, and skills, I wanted the same setup in Cursor and Codex without copy-pasting config files by hand.

So I built Plexus: a local-first dashboard that imports existing config from Claude Code, Cursor, Codex, Gemini CLI, Qwen Code, etc., then syncs rules, MCP servers, and skills back into each tool's native format.

The part I spent the most time on is safety:

- snapshots before writing native config files
- partial-writes shared files like ~/.claude.json
- does not run MCP servers
- keeps the canonical store under ~/.config/plexus/
- supports rollback from a Backups page

Repo: https://github.com/miniLV/Plexus

It is early and runs with Node 20:

npx -y plexus-agent-config@latest start

I would love feedback from people with heavier Claude Code setups: is the sync model right, and what would make you trust this with your config?
```

## Reddit: r/cursor

Title:

```text
Open-source tool for syncing Cursor MCP/commands with Claude Code and Codex
```

Body:

```text
I use Cursor alongside Claude Code and Codex, and the config drift got annoying: MCP servers in one place, rules in another, commands/skills in a third.

I built Plexus as a local dashboard for this. It imports existing config from each installed agent, lets you resolve conflicts, and projects rules, MCP servers, and skills back into each native format.

For Cursor specifically, Plexus manages:

- ~/.cursor/AGENTS.md
- ~/.cursor/mcp.json
- ~/.cursor/commands/

It snapshots files before writing and can restore from the Backups page.

Repo: https://github.com/miniLV/Plexus

Try it:
npx -y plexus-agent-config@latest start

Still early, so I am looking for feedback from people with real Cursor MCP setups. What would you expect this to preserve or never touch?
```

## Reddit: r/mcp

Title:

```text
I built a local dashboard for syncing MCP server config across AI coding agents
```

Body:

```text
MCP setup is easy to duplicate once. It is annoying to keep correct across Claude Code, Cursor, Codex, Gemini CLI, and Qwen Code.

Plexus is my attempt at a local-first MCP/config control panel:

- imports existing MCP servers from supported agents
- stores a canonical personal/team layer under ~/.config/plexus/
- writes back to each agent's native MCP format
- uses symlink/copy for dedicated MCP files
- partial-writes shared config files so auth/history/profile data is preserved
- snapshots native files before writes

Repo: https://github.com/miniLV/Plexus

Try it:
npx -y plexus-agent-config@latest start

It does not run MCP servers and is not a secrets manager. I am looking for feedback on the data model and which clients should be supported next.
```

## X Thread

```text
1/ I got tired of maintaining the same AI coding config in five places.

Claude Code, Cursor, Codex, Gemini CLI, and Qwen Code all have different files for rules, MCP servers, and skills.

So I built Plexus.

2/ Plexus is a local dashboard that imports your existing agent config, lets you resolve conflicts, and syncs the result back into each tool's native format.

3/ The key detail: it is not trying to invent a new runtime.

Claude Code still reads Claude files.
Cursor still reads Cursor files.
Codex still reads Codex files.

Plexus just gives them one local source of truth.

4/ Safety model:

- local-first
- snapshots before native writes
- partial-writes shared config files
- does not run MCP servers
- rollback from the Backups page

5/ It supports Claude Code, Cursor, Codex, Gemini CLI, Qwen Code, and Factory Droid today.

Repo:
https://github.com/miniLV/Plexus

6/ Still early. I would love feedback from people who use multiple AI coding tools and have already felt config drift.
```

## LinkedIn

```text
I built a small open-source tool for a very specific AI coding annoyance:

Every agent has its own config universe.

Claude Code has its instruction files and MCP config.
Cursor has its rules, commands, and MCP file.
Codex has AGENTS.md and config.toml.
Gemini CLI and Qwen Code have their own formats too.

If you use more than one of them, a good MCP server, rule, or skill quickly turns into copy-paste work.

Plexus is a local dashboard that imports what is already on your machine, lets you choose a primary source when configs conflict, and syncs rules, MCP servers, and skills back into each tool's native format.

The important part is safety:

- local-first
- snapshots before native writes
- partial-writes shared config files
- does not execute MCP servers
- rollback from a Backups page

It is early, open source, and built for people who use multiple AI coding tools in the same workflow.

Repo: https://github.com/miniLV/Plexus
```

## Product Hunt Draft

Use only after the install path and demo video are ready.

Name:

```text
Plexus
```

Tagline:

```text
One local dashboard for AI coding tool configs
```

Description:

```text
Plexus syncs rules, MCP servers, and skills across Claude Code, Cursor, Codex, Gemini CLI, Qwen Code, and more. Import existing config, resolve conflicts, write back to native formats, and restore from backups when needed.
```

First comment:

```text
Hi Product Hunt, I built Plexus after getting tired of maintaining the same AI coding setup across Claude Code, Cursor, Codex, Gemini CLI, and Qwen Code.

Each tool has its own rules files, MCP format, and skills or commands folder. Plexus gives them one local source of truth while still writing back to each tool's native format.

What makes it different:

- local-first dashboard
- imports existing agent config
- previews sync before applying
- snapshots native files before writes
- partial-writes shared config files instead of replacing them
- supports personal and team config layers

I would love feedback from developers already using multiple AI coding agents.
```

## Awesome-List PR Description

```text
Add Plexus, a local-first dashboard for syncing AI coding agent configuration.

Plexus manages rules, MCP servers, and skills across Claude Code, Cursor, Codex, Gemini CLI, Qwen Code, and Factory Droid. It imports existing native config, keeps a canonical local store under ~/.config/plexus/, writes back to each agent's native format, and snapshots files before writes.

Repo: https://github.com/miniLV/Plexus
```

## Common Replies

Why not use dotfiles?

```text
Dotfiles are great if you already know the exact file contract and only need one-way copying. Plexus is trying to handle import, per-agent native formats, conflict preview, partial writes for shared files, and rollback.
```

Does it run MCP servers?

```text
No. Plexus edits and syncs configuration. It does not execute MCP servers.
```

How does it avoid breaking auth/history?

```text
For shared native config files, Plexus rewrites only the MCP section it manages and preserves the rest of the file. It snapshots before writes so you can restore from the dashboard.
```

Where are secrets stored?

```text
Imported MCP env values live in the local personal store under ~/.config/plexus/. Plexus is not a secrets manager, so secrets should not be pushed to a team repo.
```
