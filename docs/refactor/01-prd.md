# Plexus 1.0 — Open-Source Refactor PRD

> **Phase:** PM (Product Manager)
> **Owner:** Plexus team
> **Status:** Draft v1 — pending review before Design phase
> **Source skills:** `prd-development`, `agent-team-driven-development`

---

## 1. Executive Summary

We are rebuilding Plexus from a working private prototype (v0.0.2) into a
**polished, open-source 1.0 release**. The product itself stays the same:
**one local dashboard that keeps MCP servers, skills, and instruction files
(`CLAUDE.md` / `AGENTS.md`) in sync across every AI coding agent on the
user's machine** (Claude Code, Cursor, Codex, Factory Droid, …).

The refactor focuses on three things, in priority order:

1. **A new UI that 100% mirrors the Claude Code / claude.ai visual language**
   — current UI is functional but visually generic; the OSS audience expects
   the look-and-feel they already use daily inside Claude Code.
2. **OSS-grade code, docs, and DX** — `npx plexus dev` works for a stranger
   who clones the repo, the file tree is approachable, the README sells the
   pain point in 30 seconds, every public API is typed and documented.
3. **Same core flow, simpler mental model** — single source of truth in
   `~/.config/plexus/`, hybrid sync via symlinks (exclusive) and partial
   writes (shared), automatic snapshots with one-click restore.

Team subscription, Windows support, and project-scope MCP are explicitly
**out of scope for 1.0** — they ship in a `1.1 beta` channel.

---

## 2. Problem Statement

### Who has this problem?

Power users of AI coding agents who run **2 or more agents in parallel**:

- Claude Code + Cursor (most common)
- Claude Code + Factory Droid + Codex (advanced setup)
- Solo developers who write skills and want them everywhere
- Small teams that want a baseline of MCPs/skills shared across the team

### What is the problem?

Every agent stores its config in a different file in a different format:

| Agent | MCP file | Skills folder |
|---|---|---|
| Claude Code | `~/.claude.json` (60 KB shared blob) | `~/.claude/skills/` |
| Cursor | `~/.cursor/mcp.json` | `~/.cursor/commands/` |
| Codex | `~/.codex/config.toml` (TOML inside auth file) | `~/.codex/prompts/` |
| Factory Droid | `~/.factory/mcp.json` | `~/.factory/skills/` |

Today, when a user adds the `atlassian` MCP to Claude Code, they must:

1. Find the right path (different per OS).
2. Paste the JSON snippet without breaking the surrounding file.
3. Repeat for every other agent.
4. Repeat again every time they edit, upgrade, or rotate a token.
5. Repeat again every time they install a new agent.
6. Repeat the entire dance for skills (full folder copies).
7. Manually back up before each step because one bad save corrupts auth.

### Why is it painful?

- **Time:** A "small" config tweak takes 10–30 minutes if you have 4 agents.
- **Risk:** Editing `~/.claude.json` by hand has destroyed users' auth state.
- **Drift:** After a month, every agent has a different set of skills.
- **No audit trail:** Users can't tell which agent has which version of a
  skill, and there is no diff view across agents.
- **Onboarding:** A new agent install starts from zero — none of the user's
  curated skills/MCPs flow over automatically.

### Evidence

- Author's lived pain: 11 MCPs in Claude Code, 8 in Cursor, 0 in Codex,
  driving the original prototype.
- Public threads on r/ClaudeAI, r/cursor, X (Twitter), and HN consistently
  mention "config sprawl" as the #1 multi-agent annoyance.
- The `awesome-claude-skills` and `awesome-claude-design` repos have grown
  rapidly in 2026 — community is producing more skills, but distribution
  remains "copy this folder into `~/.claude/skills/`."

### Quote

> "Every time I add a new MCP I have to update four files and one of them
> always silently breaks. I just want one screen with checkboxes."

---

## 3. Target Users & Personas

### Primary persona: **Multi-Agent Power User Maya**

- Uses Claude Code daily, Cursor for IDE work, occasionally Codex/Droid.
- 5–15 MCPs configured, 5–10 custom skills.
- Comfortable in the terminal, but wants a UI for routine config work.
- macOS or Linux, never Windows.
- Will reach for `npx <thing>` before `git clone && npm install`.
- Cares about OSS ergonomics: tidy repo, clear README, MIT/Apache.

### Secondary persona: **Skill Author Sam**

- Writes and ships their own skills (Anthropic / Vercel / community).
- Wants to install their skill into every agent on their machine in one go
  to test consistency.
- Primary measure of Plexus quality: "did my skill show up correctly in
  Claude Code, Cursor, Codex, and Droid after one click?"

### Secondary persona: **Onboarding Olivia** (1.1 beta target)

- Joins a team that has a Plexus team repo configured.
- Runs `plexus join <url>` and inherits 12 team-blessed MCPs/skills.
- Out of scope for 1.0 — listed here so we don't paint ourselves into a
  corner.

---

## 4. Strategic Context

### Why open source?

- **Trust.** Plexus reads/writes sensitive files (`~/.claude.json` contains
  auth). A closed binary will not earn the audience's trust.
- **Distribution.** The audience already lives on GitHub; the natural
  growth path is `awesome-claude-code` lists, not paid ads.
- **Contribution.** Each new agent (Aider, Continue.dev, OpenClaw, Gemini
  CLI, ...) is ~80 lines of adapter — community can extend.

### Why 1.0 now?

- **Critical mass:** Q1 2026 saw Claude Code 4.7, Claude Design, and a 2x
  jump in published skills. The "I run multiple agents" cohort is suddenly
  large.
- **No incumbent.** No competing open-source tool addresses this exact
  problem. `mcphub` and similar serve a different audience (server discovery,
  not multi-agent sync).
- **The prototype works.** Sync, backup, hybrid mode, and import already
  work end-to-end. The remaining work is *polish* and *trust*, not
  invention.

### Competitive landscape

- `mcphub`: discovery hub for MCP servers; does not write to agent files.
- `claude-code-skills` repos (VoltAgent, anthropics): distribute skills,
  no syncing across agents.
- IDE-native settings (Cursor, Codex): single-agent only.
- **Plexus' wedge:** the only tool that owns the cross-agent **sync**
  problem with a UI.

---

## 5. Solution Overview

### Product shape (unchanged from prototype)

```
                 ┌────────────────────────────────────────┐
                 │  Plexus dashboard  (localhost:7777)    │
                 │  one UI, claude.ai visual language     │
                 └────────────────┬───────────────────────┘
                                  │
                ┌─────────────────▼─────────────────┐
                │  Canonical store                   │
                │  ~/.config/plexus/                 │
                │  ├ team/                           │
                │  ├ personal/                       │
                │  ├ .cache/mcp/                     │
                │  └ backups/                        │
                └─────────────────┬─────────────────┘
                                  │ hybrid sync
       ┌──────────────┬───────────┼─────────────────┬──────────────┐
       ▼              ▼           ▼                 ▼              ▼
  ~/.claude.json   ~/.cursor   ~/.codex          ~/.factory   …future agents
   (partial-write)  (symlink)   (partial-write)   (symlink)
```

### What ships in 1.0

| Capability | 0.0.2 | 1.0 | Notes |
|---|---|---|---|
| Detect installed agents | ✅ | ✅ | unchanged |
| Import existing MCPs/skills | ✅ | ✅ | unchanged |
| Hybrid sync (exclusive + shared) | ✅ | ✅ | unchanged contract |
| Per-skill / per-MCP toggle per agent | ✅ | ✅ | redesigned UI |
| Per-agent inspector | ✅ | ✅ | redesigned UI |
| Auto snapshot before every write | ✅ | ✅ | unchanged |
| One-click restore | ✅ | ✅ | redesigned UI |
| Edit `CLAUDE.md` / `AGENTS.md` from UI | ✅ | ✅ | redesigned UI |
| Edit per-skill `SKILL.md` from UI | ✅ | ✅ | redesigned UI |
| **Claude-style UI (light + dark)** | ❌ | ✅ | **major work** |
| **`npx plexus` zero-install boot** | ❌ | ✅ | **major work** |
| **Marketing-grade README** | ❌ | ✅ | new |
| **Contributor docs (`CONTRIBUTING`, `ADAPTERS.md`)** | ❌ | ✅ | new |
| **CI (typecheck + build + smoke test)** | ❌ | ✅ | new |
| **Telemetry-free pledge** | implicit | explicit | privacy guarantee |
| Team git subscription | scaffolded | ❌ | **deferred to 1.1 beta** |
| Project-scope MCP | ❌ | ❌ | deferred |
| Windows support | untested | best-effort | deferred guarantee |

### High-level UX flow

1. User runs `npx plexus@latest` → browser opens at `localhost:7777`.
2. **Onboarding card** detects their agents and offers to import existing
   config. One click → import banner replaced by populated store.
3. **Dashboard** shows:
   - top: status pill ("4 agents synced ·  12 MCPs · 8 skills · last
     synced 2 min ago")
   - middle: per-agent cards (live status, "in sync" / "drifted"
     badges, click into inspector)
   - bottom: split between "MCP Servers" and "Skills" — clicks deep-link.
4. **MCP / Skills page** is a table: rows = entries, columns = agents.
   Toggling a checkbox triggers a snapshot + sync. Each row has a
   "managed kind" badge (team / personal / synced / divergent / native).
5. **Mirror page** stays unchanged conceptually — pick one source agent,
   tick targets, hit Apply.
6. **Backups page** lists snapshots, restore is a destructive confirm
   dialog, exactly as today but with claude.ai-style empty states.
7. **Settings page** holds the privacy pledge, store path override, and
   the "danger zone" (wipe canonical store / reset).

---

## 6. Success Metrics

### Primary

- **Time-to-first-sync after `npx plexus`** under **60 seconds** for a
  user who has Claude Code + Cursor already installed.

### Secondary

- **GitHub stars** in the first 30 days post-launch (vanity but signals
  reach): target 500+.
- **Adapter-contribution PRs** in the first 90 days: target ≥ 2.
- **Issues filed about UI clarity** (negative metric): target < 3 in the
  first 30 days.

### Guardrails (must not regress)

- **No data loss.** Zero reports of corrupted `~/.claude.json` after 1.0
  GA. (Backup restore must always succeed.)
- **Sync determinism.** Two consecutive `plexus sync` runs produce
  byte-identical native files.
- **Build time** of the dashboard under **8 s** on an M-series Mac.

---

## 7. User Stories & Requirements

### Epic hypothesis

> *We believe that giving multi-agent power users a polished, Claude-styled
> dashboard for syncing MCPs/skills/instruction files will make Plexus the
> default tool for cross-agent config management, because today they
> tolerate manual edits only because no good alternative exists.*

### Epics for 1.0

#### Epic A — Visual identity

- **A1** Adopt Claude Code / claude.ai design tokens (light + dark) via
  the `anthropics/skills@frontend-design` skill.
- **A2** Replace every page's chrome (sidebar, top bar, cards, tables,
  badges, modals) with the new system.
- **A3** Add light/dark toggle that follows OS preference by default.
- **A4** Replace ad-hoc icons with the official Lucide / Anthropic icon
  set used by Claude Code.

**Acceptance:**
- Side-by-side screenshot comparison: Plexus dashboard vs claude.ai
  workspace shows ≥ 90% visual coherence on color, type, spacing.
- All 7 pages (`/`, `/mcp`, `/skills`, `/mirror`, `/team`, `/backups`,
  `/settings`, `/agents/[id]`) audited and re-skinned.

#### Epic B — UX polish

- **B1** Empty states for every list (no MCPs, no skills, no backups, no
  agents detected) with friendly illustrations and a clear next action.
- **B2** Loading skeletons for every async section (dashboard counters,
  effective lists, file viewers).
- **B3** Toasts for sync results — success, partial failure, full
  failure — with "view details" linking to the inspector.
- **B4** Keyboard shortcuts: `g d` dashboard, `g m` MCPs, `g s` skills,
  `g b` backups, `?` cheat sheet (matches Claude Code).
- **B5** Diff viewer in the inspector when a row is `divergent` (store
  vs native side-by-side).

**Acceptance:**
- All four states (empty / loading / loaded / error) covered for every
  list view.
- `?` opens a modal listing all shortcuts.

#### Epic C — OSS readiness

- **C1** `npx plexus@latest` boots a packaged Next.js build with zero
  install steps. CLI lives in `packages/cli`.
- **C2** Top-level README rewritten with: 30-second pitch, GIF demo,
  install line, agent matrix, contribution pointer, license.
- **C3** `CONTRIBUTING.md` covers: monorepo layout, dev loop, how to
  write a new adapter (link to `ADAPTERS.md`), commit conventions,
  release flow.
- **C4** `ADAPTERS.md` is the *adapter author's manual* — the contract
  every new agent integration must implement.
- **C5** GitHub Actions workflow: `npm ci → typecheck → build → smoke
  test (boot dashboard + GET /api/agents) → upload artifact`.
- **C6** Issue + PR templates that funnel bug reports vs feature
  requests vs adapter proposals.
- **C7** A `CHANGELOG.md` started at v1.0.0 following Keep-a-Changelog.
- **C8** A privacy pledge in README + Settings: "Plexus performs zero
  network requests other than `git fetch` from team subscriptions in
  1.1 beta."

**Acceptance:**
- A stranger can `npx plexus` from a clean machine and reach the
  dashboard in < 60 s.
- CI green on every PR; merge requires green CI.
- All public APIs in `packages/core` have TSDoc.

#### Epic D — Code quality / refactor

- **D1** Shrink `apps/web/components/*.tsx` — every component < 250
  lines, extract custom hooks for fetch+toggle pairs.
- **D2** Move all Tailwind tokens into a tokens file
  (`apps/web/styles/tokens.ts`) generated from the design system.
- **D3** Replace `any` in `apps/web` with concrete types (current
  prototype allows pragmatic `any`).
- **D4** Add a `core` test suite: at minimum, snapshot/restore round-trip,
  partial-write JSON merge, partial-write TOML merge, symlink-safe
  removal.
- **D5** Lint + format with biome (or eslint+prettier) and enforce in
  CI.

**Acceptance:**
- `npm run typecheck && npm run build && npm test` is green from a
  fresh clone.
- No `any` outside `parseJson`/`parseToml` boundaries in `packages/core`.

#### Epic E — DX of running locally

- **E1** A single `npm run dev` from repo root spawns both core build
  watcher + web dev server.
- **E2** Hot-reload works for `packages/core` edits (use `tsc --watch`
  + Next.js auto-reload).
- **E3** Logging surface (a small "console" panel in /settings during
  dev mode) so contributors can see sync / backup events without
  opening DevTools.

---

## 8. Out of Scope (1.0)

- **Team git subscription UI** — code paths exist (`packages/core/team`)
  and unit-tested, but the `/team` page renders a "coming in 1.1 beta"
  card. Avoids the feature being the long pole on launch.
- **Project-scope MCP files** (`<repo>/.cursor/mcp.json`,
  `<repo>/.mcp.json`) — requires "what is a project" UX.
- **Windows guarantee** — symlink fallback exists but is unverified.
  README lists macOS + Linux as supported.
- **Secret redaction on team push** — relevant only when team subscription
  ships; tracked separately.
- **Telemetry** — Plexus stays telemetry-free. We will not add anonymous
  usage analytics in 1.0.
- **Auth / multi-user** — Plexus is local-only.

---

## 9. Dependencies & Risks

### Dependencies

- `anthropics/skills@frontend-design` skill (installed) for visual
  language reference.
- `awesome-claude-design` repo for color/type tokens that match
  claude.ai.
- `lucide-react` (already common in claude.ai-style projects) for icons.
- Node ≥ 20.19 (per CLAUDE.md §7.3).

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Visual coherence with Claude Code is subjective; reviewers may say "still doesn't look right" | High | Designer phase produces side-by-side screenshots gating before Dev phase |
| `npx plexus` packaging is fiddly on Next.js 14 standalone | Medium | Spike early in Epic C; fallback is `pnpm dlx plexus` or a `bin` script that runs `next start` from a published build |
| Refactor accidentally breaks the hybrid sync contract (CLAUDE.md §3.2) | High | Lock down with `core` tests *before* refactor (D4 first, then D1–D3) |
| OSS launch attracts unexpected agent requests (Aider, Continue) | Medium | `ADAPTERS.md` (C4) makes contribution a self-service path |
| Backup directory grows unbounded | Low | Existing 20-snapshot ring buffer holds; add storage warning in /backups |

### Resolved decisions (PRD review, 2026-04-27)

1. **Default theme:** **Dark**, matching Claude Code's default.
2. **Body font:** **Inter** (matches claude.ai). Self-hosted via
   `next/font` — zero CDN call to honour the privacy pledge.
3. **Side nav:** Collapsible, matching Claude Code's web; resolved in
   Designer phase.
4. **`/team` in 1.0:** Visible in nav with a "1.1 beta" chip; page body
   shows the roadmap and a waitlist email field.
5. **Component substrate:** **shadcn/ui** on top of Radix primitives —
   fastest path to claude.ai parity, aligns with the `frontend-design`
   skill, and remains tree-shakeable.

---

## 10. Phase Plan (mapped to team skills)

| Phase | Skill | Output | Gate |
|---|---|---|---|
| **PM** *(this doc)* | `prd-development` | `docs/refactor/01-prd.md` | User signs off |
| **Designer** | `anthropics/skills@frontend-design` + `design-system` + `design-critique` | `docs/refactor/02-design.md` + `docs/refactor/mockups/*.html` | Side-by-side screenshots vs claude.ai approved |
| **Architect** | `architecture-designer` | `docs/refactor/03-architecture.md` (ADRs for: shadcn adoption, `npx` packaging, test strategy) | All open questions resolved |
| **Dev** | `agent-team-driven-development` (orchestrating sub-agents per epic) | Code on a `refactor/1.0` branch | All acceptance criteria above pass |
| **QA** | `qa-testing-strategy` + `multi-reviewer-patterns` | `docs/refactor/04-qa.md` + green CI + smoke test report | No P0/P1 issues open |
| **OSS launch** | `opensource-pipeline` | Tag `v1.0.0`, GitHub release, README polished | First external contributor PR within 30 days |

---

*End of PRD v1 draft. Awaiting sign-off before entering Designer phase.*
