# Plexus Growth Operator Playbook

Date: 2026-05-02

## Operating Assumptions

- The goal is credible early adoption from developers who already use multiple
  AI coding tools.
- The first conversion is a GitHub star, issue, or `npx` install.
- Promotion should feel like asking for technical feedback, not asking for
  upvotes.
- I can prepare assets, copy, SEO pages, and issue/PR drafts directly. Publishing
  from Reddit, Hacker News, Product Hunt, Google Search Console, or social
  accounts still needs an authenticated user session or connector.

## Visual Strategy

Use generated images only for static campaign surfaces:

- Reddit profile/avatar/banner
- Open Graph image variants
- Product Hunt gallery background treatment

Do not use generated images for the core demo. Plexus needs trust, so the
primary asset should be a real 45-60 second screen recording:

1. Show existing Claude Code, Cursor, and Codex config files.
2. Open Plexus.
3. Run Share config everywhere.
4. Show the merge preview and primary agent picker.
5. Apply sync.
6. Open Backups and show the snapshot.

## Search Positioning

Do not try to rank for plain `plexus` first. The term is already crowded by
medical, enterprise, game-addon, and unrelated AI products.

Target these queries first:

- `Plexus Agent Config`
- `plexus-agent-config`
- `Claude Code Cursor Codex config sync`
- `sync MCP servers across Claude Code and Cursor`
- `keep CLAUDE.md and AGENTS.md in sync`
- `Claude Code skills sync`

Use the phrase `Plexus Agent Config` in titles, link anchors, package metadata,
and launch copy until Google associates the project with agent configuration.

## Immediate Runbook

1. Public surface
   - Keep README npm quick start visible above the fold.
   - Publish the updated package description in the next npm release.
   - Enable GitHub Pages from `/docs` so `docs/index.html` becomes the canonical
     SEO landing page.

2. Demo asset
   - Record one real 45-60 second walkthrough.
   - Use the first frame as social preview if no custom OG image is ready.
   - Add the video or GIF link to README, HN maker comment, and Reddit posts.

3. First wave
   - Let the current r/ClaudeCode post resolve moderation.
   - Reply to every substantive comment with technical detail.
   - Post Hacker News only after the demo asset exists.
   - Do not post the same copy to multiple subreddits.

4. Compounding discovery
   - Open one awesome-list PR at a time.
   - Write one search article per week around an actual workflow.
   - Link each article to the GitHub repo and the landing page with descriptive
     anchor text.

## Reply Snippets

Security:

```text
Plexus is local-first and does not run MCP servers. It stores the canonical copy
under ~/.config/plexus, snapshots native files before writes, and partial-writes
shared files so auth/history/profile data is preserved.
```

Why not dotfiles:

```text
Dotfiles are great if every target file is yours. Plexus is for the messier case:
Claude Code, Cursor, Codex, Gemini CLI, and Qwen Code each expect different
native shapes, and some shared config files contain auth/history/profile data
that should not be replaced wholesale.
```

Why a dashboard:

```text
The dashboard exists for preview and trust. I wanted to see what will be imported,
which agent wins conflicts, and exactly where backups exist before anything
touches native config files.
```

## Weekly Loop

- Monday: check GitHub traffic, stars, npm downloads, issues, and referrers.
- Tuesday: ship one small onboarding or trust improvement from feedback.
- Wednesday: publish or draft one search-focused technical post.
- Thursday: submit one directory/list PR.
- Friday: prepare one demo clip or short platform-native post.

Stop a channel if it produces views without technical comments. Improve the hook
or the target audience before posting again.
