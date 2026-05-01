# Plexus 100-Star Growth Plan

Date: 2026-05-01
Baseline: 3 GitHub stars, 0 forks, Apache-2.0, good repo topics already set.
Goal: reach 100 GitHub stars from developers who actually understand the
multi-agent config pain.

## Assumptions

- Primary goal is awareness and credible early users, not paid acquisition.
- The first audience is developers already using at least two of Claude Code,
  Cursor, Codex, Gemini CLI, Qwen Code, or MCP-enabled tools.
- The best first conversion is a GitHub star or issue. A full install is a
  stronger signal, but today the install path still requires cloning the repo.
- Do not ask communities to upvote. Ask for feedback, be transparent, and let
  stars follow.

## Positioning

Short line:

> Plexus is a local dashboard that gives Claude Code, Cursor, Codex, Gemini CLI,
> and Qwen Code one source of truth for rules, MCP servers, and skills.

The useful contrast:

- Not another agent runtime.
- Not a hosted secrets/config service.
- Not just a CLI that rewrites files.
- A local-first control panel with previews, backups, partial writes, and
  per-agent native formats.

## Review Findings

High impact:

- The README explains the product well, but there is no short demo asset. A
  45-60 second video or GIF is the biggest missing trust builder.
- Public install friction is high. `@plexus/cli` is not published on npm, and
  the unscoped `plexus` npm name is already taken by an unrelated package.
- The repo has good topics and screenshots, so discovery metadata is not the
  main bottleneck.
- The safest first launch is Hacker News plus niche AI-coding communities,
  because the product is most obvious to people who already feel the config
  drift problem.

Medium impact:

- Product Hunt should wait until there is a simple public install path, a demo
  video, and a few real user comments.
- The README should keep making the safety story prominent: local-first,
  snapshot before native writes, partial writes for shared config files.
- The project needs one memorable before/after story: "I stopped maintaining
  MCP servers and skills in five separate places."

## 30-Day Target

| Milestone | Target | What must be true |
| --- | ---: | --- |
| Day 3 | 10 stars | README CTA added, launch copy ready, demo script ready |
| Day 7 | 25 stars | HN + 2 niche community posts live, active comment replies |
| Day 14 | 50 stars | Feedback fixes shipped, awesome-list PRs opened |
| Day 21 | 75 stars | Short demo video circulated, second wave posts |
| Day 30 | 100 stars | Product Hunt or broader launch if install path is ready |

## Channel Plan

### Hacker News

Use when the demo is ready and the repo can be tried directly.

- Title: `Show HN: Plexus - one local dashboard for AI coding tool configs`
- Link: `https://github.com/miniLV/Plexus`
- First comment: use the HN copy in `docs/marketing/launch-copy.md`.
- Follow the Show HN rule: people must be able to try it, and do not ask for
  upvotes or comments.

Expected result: 10-40 stars if the title and comments land with the right
developer crowd.

### Reddit

Post only where the problem is native to the community. Do not cross-post the
same wording.

- `r/ClaudeAI`: lead with Claude Code plus Cursor/Codex config drift.
- `r/cursor`: lead with Cursor MCP + commands sync.
- `r/codex`: lead with Codex `AGENTS.md` + `config.toml` partial writes.
- `r/mcp`: lead with MCP config portability and safety.
- `r/SideProject` or `r/coolgithubprojects`: use the builder story.

Expected result: 10-30 stars if the posts are specific and replies are fast.

### Awesome Lists

Open small PRs, one at a time:

- `subinium/awesome-claude-code`
- `ai-for-developers/awesome-ai-coding-tools`
- `appcypher/awesome-mcp-servers` or other MCP-adjacent lists if they accept
  tools, not only servers

Expected result: slower, but compounding discovery. Track merged PRs and stars
for 30 days.

### X / LinkedIn

Use a short demo clip and one clear pain point. Avoid generic "AI productivity"
language.

- X: 4-6 post thread, fast hook, video first.
- LinkedIn: builder story plus concrete before/after.

Expected result: small direct star count unless the clip is strong, but useful
for seeding later Product Hunt traffic.

### Product Hunt

Delay until:

- one-command install or packaged release is ready
- gallery images and demo video exist
- at least 3-5 early users or comments can be referenced
- the maker profile is warmed up with normal Product Hunt activity

Expected result: only worth doing after the first wave proves the message.

## Execution Checklist

Before first public post:

- [ ] Record 45-60 second demo: import, preview, sync, backup restore.
- [ ] Add a short "try it" clip to README or GitHub release assets.
- [ ] Decide npm package path. Since `plexus` is taken, consider
  `@minilv/plexus`, `@plexus-local/cli`, or `create-plexus`.
- [ ] Test the fresh-machine path from a clean checkout.
- [ ] Prepare reply snippets for security, secrets, symlinks, and "why not just
  use dotfiles?" questions.

Launch day:

- [ ] Post HN first.
- [ ] Reply to every substantive comment within 15-30 minutes.
- [ ] Fix one small piece of feedback quickly and mention it in the thread.
- [ ] Post one niche Reddit thread after HN has real comments.
- [ ] Track stars at launch, +6h, +24h, +48h.

After launch:

- [ ] Create issues for repeated objections.
- [ ] Ship a patch release with the top feedback fix.
- [ ] Open awesome-list PRs with a concise description.
- [ ] Write a short "what I learned syncing configs across AI coding tools"
  post and submit that separately from the repo launch.

## Metrics

Track in a small spreadsheet:

- GitHub stars
- GitHub unique visitors
- GitHub clones
- README image/video views if hosted somewhere measurable
- Issues opened
- Release downloads
- Referrer/source when identifiable

Decision rule:

- If a channel produces comments but few stars, improve README conversion.
- If a channel produces views but no comments, sharpen the hook.
- If people object to safety, emphasize snapshots, partial writes, and
  local-first more aggressively.
- If people ask for install, prioritize npm packaging before more promotion.

## Useful References

- GitHub topics help discovery:
  https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics
- Show HN guidelines:
  https://news.ycombinator.com/showhn.html
- Hacker News guidelines:
  https://news.ycombinator.com/newsguidelines.html
- Product Hunt posting guide:
  https://help.producthunt.com/en/articles/479557-how-to-post-a-product
- Product Hunt scheduling:
  https://help.producthunt.com/en/articles/2724119-how-to-schedule-a-post
