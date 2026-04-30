# Contributing to Plexus

Thanks for helping make multi-agent configuration less repetitive.

## Setup

```bash
npm ci
npm run dev
```

The dashboard runs at [http://localhost:7777](http://localhost:7777).

## Validation

Before opening a PR, run:

```bash
npm run verify
```

For focused core work:

```bash
npm run test:core
npm run build --workspace=@plexus/core
```

For focused web work:

```bash
npm run build --workspace=@plexus/web
```

## Safety Rules

- Do not commit secrets.
- Do not write outside `~/.config/plexus/` without a backup path.
- Use `lstat` before removing paths that may be symlinks.
- Preserve agent-owned fields in shared native files such as
  `~/.claude.json` and `~/.codex/config.toml`.
- Keep team config and personal config separate.

## Pull Requests

Good PRs include:

- a clear problem statement
- a small, reviewable change
- tests for filesystem or sync behavior
- screenshots or Playwright notes for UI changes
- updated README or `CLAUDE.md` when behavior changes
