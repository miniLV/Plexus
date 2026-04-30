# AGENTS.md - Plexus

This repo keeps the detailed agent operating guide in [CLAUDE.md](./CLAUDE.md).
Read that file before changing code.
Codex uses this file as its project entrypoint; keep it as a thin pointer to
the current project's `CLAUDE.md` instead of duplicating the full guide here.

Short version:

- Talk to the user in Chinese.
- Keep edits surgical and preserve unrelated worktree changes.
- Use Node 20 from `.nvmrc`.
- Run the validation commands in `CLAUDE.md` before committing.
- After completing a small feature or focused fix, validate it and commit it
  automatically without waiting for a separate prompt.
- Multiple Codex conversations may be active at once; stage and commit only
  the files changed in the current conversation.
- Treat `~/.config/plexus/` as the only Plexus-owned config root.
- Snapshot before any write to an agent-native file.
