# Plexus Show HN Launch Kit

Date: 2026-05-07

Use this file when Plexus is ready for a direct `Show HN` launch.

Canonical link:

`https://github.com/miniLV/Plexus`

Fast install path:

```text
npx -y plexus-agent-config@latest start
```

## Launch Decision

Do not post to Hacker News until these are true:

- the npm install path works on a clean machine
- the repo README shows the `npx` command above the fold
- a 45-60 second real demo exists
- the maker can reply to comments for the first 4-6 hours

If any of those are missing, wait.

## Goal

The goal of `Show HN` is not broad awareness. The goal is to reach developers
who already use two or more AI coding tools and immediately recognize the
config drift problem.

## Title Options

Start with the simplest title first:

```text
Show HN: Plexus - one local dashboard for AI coding tool configs
```

If that feels too broad, test one of these instead:

```text
Show HN: Plexus - sync MCP, rules, and skills across Claude Code, Cursor, and Codex
Show HN: Plexus - local config sync for Claude Code, Cursor, Codex, and Gemini CLI
Show HN: Plexus - one local source of truth for AI coding tool config
```

Do not lead with too many product nouns in the title. `Show HN` usually works
better when the first line explains the job of the tool, not every feature.

## Submission Link

Prefer submitting the GitHub repo:

`https://github.com/miniLV/Plexus`

Use the Pages site only if the homepage becomes materially stronger than the
repo at explaining the product and proving trust.

## Maker Comment

Paste this as the first comment right after posting:

```text
Hi HN - I built Plexus because my AI coding setup had turned into multiple config systems.

I use different tools for different jobs: Claude Code for planning, Cursor for editing, Codex for automation, and sometimes Gemini CLI or Qwen Code. The annoying part is that every tool has its own instruction file, MCP format, and skills or commands directory.

Plexus is a local dashboard that imports what is already on your machine, lets you choose a primary source when configs conflict, and syncs rules, MCP servers, and skills back into each agent's native location.

The safety model is the main thing I cared about:

- local-first, no hosted service
- does not run MCP servers
- snapshots native files before writes
- partial-writes shared config files like ~/.claude.json and ~/.codex/config.toml instead of replacing them
- supports Claude Code, Cursor, Codex, Gemini CLI, Qwen Code, and Factory Droid today

Fastest install path:

npx -y plexus-agent-config@latest start

I would especially love feedback on three things:
1. whether the sync model feels trustworthy enough for real config
2. where the current onboarding is still confusing
3. which AI coding tools should be supported next
```

## What To Emphasize In Replies

When the thread starts moving, keep replies concrete:

- what files Plexus actually reads and writes
- what it deliberately does not do
- why partial writes exist
- why backups are part of the product, not an extra

The core message should be:

> Plexus is not a new runtime. It is a local control plane for config that
> writes back into each tool's native format.

## Likely Questions And Good Short Replies

### Why not just use dotfiles?

```text
Dotfiles are great if every target file is fully yours. Plexus is for the messier case where Claude Code, Cursor, Codex, and others all expect different native shapes, and some of those files also contain auth/history/profile state that should not be replaced wholesale.
```

### Why a dashboard instead of a CLI?

```text
The dashboard is mainly about trust. I wanted preview, conflict resolution, and visible backups before anything touches native config files. The local install path is still one command, but the UI makes the write surface easier to inspect.
```

### Does it run MCP servers?

```text
No. Plexus only manages config. It does not execute MCP servers and it is not trying to be a hosted agent platform.
```

### Where does it store the canonical copy?

```text
Under ~/.config/plexus/. The idea is one local source of truth, then projection back into each tool's native files and directories.
```

## Posting Window

Use a window where the maker can stay close to the thread.

Preferred operating pattern:

1. Post
2. Add maker comment within 1-2 minutes
3. Reply quickly for the first 60-90 minutes
4. Ship one small clarity fix if the same confusion appears twice
5. Mention that fix in-thread only if it is genuinely relevant

## Success Signals

Treat these as good signs:

- technical comments instead of generic praise
- questions about sync semantics, not confusion about what the product is
- clicks to GitHub followed by stars or installs
- people comparing it against dotfiles, chezmoi, or hand-rolled scripts

Treat these as warning signs:

- many views but almost no comments
- repeated confusion about whether Plexus is an MCP runtime
- repeated confusion about whether it is cloud-hosted
- comments that suggest the README still does not explain the problem fast enough

## After The Post

Capture a quick launch note:

- post title used
- time posted
- first 3 meaningful questions
- whether stars moved in the first 6 hours
- whether README or homepage needed clarification

That note should feed the next launch channel instead of starting from scratch.
