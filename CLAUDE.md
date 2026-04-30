# CLAUDE.md - Plexus

> **For the next Claude Code / Droid / Codex session.** This is the working
> map for Plexus: what the product is, how the repo is shaped today, which
> invariants are load-bearing, and how to validate changes. Read it before
> touching code.

---

## 1. What Plexus Is

Plexus is a **local-only web dashboard** for managing AI agent configuration
on one machine. It centralizes:

- MCP servers
- Skills / command bundles
- User-level instruction files such as `CLAUDE.md` and `AGENTS.md`

Supported built-in agents:

| Agent | MCP file | Skill / prompt dir | MCP mode |
|---|---|---|---|
| Claude Code | `~/.claude.json` | `~/.claude/skills/` | `shared` |
| Cursor | `~/.cursor/mcp.json` | `~/.cursor/commands/` | `exclusive` |
| Codex | `~/.codex/config.toml` | `~/.codex/prompts/` | `shared` |
| Gemini CLI | `~/.gemini/settings.json` | `~/.gemini/skills/` | `shared` |
| Qwen Code | `~/.qwen/settings.json` | `~/.qwen/skills/` | `shared` |
| Factory Droid | `~/.factory/mcp.json` | `~/.factory/skills/` | `exclusive` |

The current package version is tracked in the root `package.json`. All
workspace `package.json` files must stay on the same version:

- `package.json`
- `apps/web/package.json`
- `packages/core/package.json`
- `packages/cli/package.json`

### Product Contract

Plexus keeps a canonical store under `~/.config/plexus/` and projects it into
agent-native locations with the smallest reversible write:

- **Exclusive MCP files** are rendered into
  `~/.config/plexus/.cache/mcp/<agent>.json`, then linked or copied into the
  agent path.
- **Shared MCP files** are partial-written in place; Plexus rewrites only the
  MCP section and preserves unrelated auth/history/profile keys.
- **Skills** are linked or copied from the Plexus store into each agent's
  native skill directory.
- **Rules** are stored once at
  `~/.config/plexus/personal/rules/global.md`, then linked or copied to
  each built-in agent's native instruction file (`CLAUDE.md`, `AGENTS.md`,
  `GEMINI.md`, or `QWEN.md`).
- **Backups** are taken before syncs, toggles, and dashboard file edits.

### Non-Goals

- Plexus does not execute MCP servers or skills.
- Plexus is not a secrets manager; imported `env` values are plaintext in the
  local store.
- Project-scoped MCP files are not managed yet.
- Windows is best-effort only; macOS/Linux symlink behavior is the baseline.

---

## 2. Repo Layout

```text
Plexus/
├── package.json                  # npm workspaces root; scripts and version
├── package-lock.json
├── tsconfig.base.json             # strict shared TS config
├── biome.json                     # formatter/linter config
├── .nvmrc                         # Node 20
├── README.md
├── CLAUDE.md                      # this file
├── AGENTS.md                      # agent-facing instructions if present
├── apps/
│   └── web/                       # Next.js App Router dashboard
│       ├── app/
│       │   ├── layout.tsx         # shell: sidebar, topbar, theme provider
│       │   ├── page.tsx           # dashboard
│       │   ├── rules/page.tsx
│       │   ├── mcp/page.tsx
│       │   ├── skills/page.tsx
│       │   ├── mirror/page.tsx
│       │   ├── spread/page.tsx    # redirects to /mirror
│       │   ├── agents/[id]/page.tsx
│       │   ├── backups/page.tsx
│       │   ├── debug/page.tsx
│       │   ├── team/page.tsx
│       │   ├── settings/page.tsx
│       │   └── api/               # thin route handlers around @plexus/core
│       │       └── rules/route.ts
│       ├── components/
│       │   ├── app-sidebar.tsx
│       │   ├── app-topbar.tsx
│       │   ├── agent-detail.tsx
│       │   ├── backups-panel.tsx
│       │   ├── custom-agents-panel.tsx
│       │   ├── debug-panel.tsx
│       │   ├── import-banner.tsx
│       │   ├── mcp-editor.tsx
│       │   ├── mirror-panel.tsx
│       │   ├── rules-panel.tsx
│       │   ├── settings-panel.tsx
│       │   ├── skills-editor.tsx
│       │   ├── sync-button.tsx
│       │   ├── team-panel.tsx
│       │   └── ui/
│       ├── styles/tokens.css
│       ├── lib/version.ts
│       └── package.json
├── packages/
│   ├── core/                      # all filesystem and sync logic; no React
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── store/             # ~/.config/plexus store I/O
│   │   │   ├── agents/            # detection, inspection, adapters
│   │   │   ├── sync/
│   │   │   ├── rules/
│   │   │   ├── effective/
│   │   │   ├── import/
│   │   │   ├── spread/
│   │   │   ├── backup/
│   │   │   ├── team/
│   │   │   ├── debug/
│   │   │   └── index.ts
│   │   ├── test/                  # vitest safety tests
│   │   └── package.json
│   └── cli/
│       ├── src/bin.ts             # `plexus` command
│       └── package.json
├── docs/refactor/                 # PRD, design, architecture, mockups
├── examples/team-config-template/
└── scripts/
    ├── bump.mjs                   # synchronized patch bump
    ├── release-commit.mjs
    └── ship.mjs                   # verify + bump + commit + tag + push
```

### Workspace Conventions

- TypeScript is strict and ESM-only.
- Local imports in TS use `.js` extensions.
- `apps/web` and `packages/cli` depend on `@plexus/core` with an exact version
  pin matching the monorepo version.
- `packages/core` must stay free of React, Next.js, DOM, or browser-only APIs.
- Prefer small, surgical changes. Do not refactor adjacent code unless the
  user asked or the change is required for the task.

---

## 3. Critical Mental Models

### 3.1 Three Layers of State

```text
                   dashboard effective view
                 (authority + effectiveAgents)
                             ▲
                             │ computed by effective/index.ts
        ┌────────────────────┴────────────────────┐
        │                                         │
        ▼                                         ▼
Plexus canonical store                    native agent files
~/.config/plexus/                         ~/.claude.json
├── team/                                 ~/.cursor/mcp.json
├── personal/                             ~/.codex/config.toml
├── .cache/mcp/                           ~/.factory/mcp.json
└── backups/                              skills dirs
        ▲                                         │
        └──── import/from-agents.ts reads native ─┘
```

Do not conflate these:

1. **Store state** lives under `~/.config/plexus/team` and
   `~/.config/plexus/personal`.
2. **Native state** is what each agent currently reads from its own path.
3. **Effective state** is the dashboard's union of store and native state.

Current effective rows are intentionally simple:

```ts
authority: "team" | "personal" | "native";
effectiveAgents: AgentId[];
nativeAgents: AgentId[];
enabledAgents?: AgentId[];
```

The old `synced` / `divergent` mental model still appears in some UI badge
names, but `packages/core/src/effective/index.ts` does **not** currently
compare byte-level or value-level divergence. If you add a divergence diff UI,
do it deliberately in `effective/` and update this file.

### 3.2 Hybrid MCP Sync

`packages/core/src/store/paths.ts` declares `AGENT_PATHS` and each agent's
`mcpFileMode`.

#### Exclusive Mode: Cursor, Factory Droid

These files are treated as dedicated MCP files.

1. Render merged store entries to
   `~/.config/plexus/.cache/mcp/<agent>.json`.
2. Replace the agent file with a symlink to that cache when possible.
3. Fall back to copy if symlinks fail.

Implementation: `packages/core/src/agents/adapters/json-mcp.ts`
`writeExclusive()`.

Important nuance: exclusive mode still preserves native MCP IDs that Plexus
does not manage by reading the current file first and carrying those entries
forward.

#### Shared Mode: Claude Code, Codex, Gemini CLI, Qwen Code

These files contain auth, history, profiles, and other agent-owned state.
Plexus must never replace the whole file.

- Claude Code / Gemini CLI / Qwen Code JSON: rewrite only `mcpServers`.
- Codex TOML: rewrite only `mcp_servers`.
- Managed IDs disabled for the agent are removed from that MCP section.
- Unmanaged native MCP IDs are preserved.

Implementation:

- JSON: `packages/core/src/agents/adapters/json-mcp.ts` `writeShared()`
- TOML: `packages/core/src/agents/adapters/codex.ts`

Tests:

- `packages/core/test/partial-write-json.test.ts`
- `packages/core/test/partial-write-toml.test.ts`

### 3.3 Skills Sync

Skills are directory-based and are treated as exclusive per skill ID.

- Store format: `~/.config/plexus/<layer>/skills/<id>/SKILL.md`
- Claude Code target: `~/.claude/skills/<id>`
- Cursor target: `~/.cursor/commands/<id>`
- Codex target: `~/.codex/prompts/<id>`
- Gemini CLI target: `~/.gemini/skills/<id>`
- Qwen Code target: `~/.qwen/skills/<id>`
- Factory Droid target: `~/.factory/skills/<id>`

`placeLinkOrCopy()` is the shared helper. If a real file or directory already
exists at the target, it is quarantined under
`~/.config/plexus/backups/_collisions/` before the link/copy is placed.

### 3.4 Global Rules Sync

Rules are the product answer to "one instruction file for every AI tool."

- Canonical file: `~/.config/plexus/personal/rules/global.md`
- Claude Code target: `~/.claude/CLAUDE.md`
- Cursor target: `~/.cursor/AGENTS.md`
- Codex target: `~/.codex/AGENTS.md`
- Gemini CLI target: `~/.gemini/GEMINI.md`
- Qwen Code target: `~/.qwen/QWEN.md`
- Factory Droid target: `~/.factory/AGENTS.md`

Implementation:

- Store I/O: `packages/core/src/store/rules.ts`
- Status/apply/import: `packages/core/src/rules/index.ts`
- API: `apps/web/app/api/rules/route.ts`
- UI: `apps/web/app/rules/page.tsx` and
  `apps/web/components/rules-panel.tsx`

Apply behavior:

1. Require a personal canonical rules file.
2. Skip agents that are not installed or disabled in `config.yaml`.
3. Snapshot an existing target instruction file with `snapshotSingleFile()`.
4. Quarantine a real target file under `backups/_collisions/`.
5. Place a symlink to the canonical rules file, falling back to copy if
   symlinks fail.

Rules apply is intentionally separate from MCP/skills `runSync()` so a user
can edit and apply operating instructions without rewriting MCP state.

### 3.5 Store Merge Rules

The store has two layers:

- `team`: cloned/pulled from a Git repo, treated as read-only by the normal UI
- `personal`: local user-owned overrides and additions

`packages/core/src/store/merge.ts` gives personal entries precedence over team
entries with the same ID.

Team rows are disabled in the MCP/Skills table UI. The core toggle functions
can create personal overrides for team entries, but the current UI chooses the
safer path: propose changes through the team repo instead.

---

## 4. Main Workflows

### 4.1 Sync

Entry points:

- `POST /api/sync`
- `plexus sync`
- Sync button and add-row flows that explicitly call `/api/sync`

Core function: `packages/core/src/sync/index.ts` `runSync()`.

Flow:

1. Read `~/.config/plexus/config.yaml`.
2. Detect installed agents.
3. Snapshot native MCP files with `snapshotAgentConfigs()`.
4. Run `cleanupLegacyResidue()`.
5. Read team + personal MCPs and skills.
6. Merge team + personal.
7. Apply adapters for enabled, installed targets.

### 4.2 Import

Entry points:

- `GET /api/import`: preview only
- `POST /api/import`: write previewed items into personal store
- `<ImportBanner />`

Implementation:

- `packages/core/src/import/from-agents.ts`
- `packages/core/src/import/index.ts`

Candidate kinds:

- `new`: ID is not in the store; write a new personal entry.
- `extend`: ID exists in store, but at least one native source agent is
  missing from `enabledAgents`; append those agents.
- `managed`: not returned by the public preview; already covered.

Current import logic reads real skill directories. If symlink-aware import is
extended, it must not claim user-owned external skill links as Plexus-managed.

### 4.3 Toggle Per Agent

Entry points:

- `POST /api/mcp/[id]/toggle`
- `POST /api/skills/[id]/toggle`

Implementation: `packages/core/src/effective/index.ts`.

Behavior:

- Native-only items are promoted into the personal layer on first toggle.
- Promote syncs every native source agent plus the target agent, so those
  agents start reading the canonical Plexus copy.
- Non-promote toggles sync the affected agent.
- Each toggle snapshots native MCP files before adapter writes.

### 4.4 Mirror

The old "Spread" concept is now exposed as `/mirror`; `/spread` redirects.
The API is still named `/api/spread`.

Entry points:

- `GET /api/spread?from=<agent>&to=<agent>`: preview
- `POST /api/spread`: apply

Implementation: `packages/core/src/spread/index.ts`.

Mirror computes the effective source set, writes missing items into the
personal layer or adds the target to `enabledAgents`, then syncs the target.

Current safety gap: `applySpread()` calls the target adapter directly and does
not call `snapshotAgentConfigs()` first. This should be fixed before treating
Mirror as fully compliant with the backup invariant.

### 4.5 Team Subscription

Team Git support is no longer just a stub, but it is still a beta flow.

Entry points:

- `plexus join <git-url>`
- `plexus pull`
- `plexus status`
- `GET /api/team`
- `POST /api/team` with `{ action: "join" | "pull" }`
- `/team`

Implementation: `packages/core/src/team/git.ts`.

Current behavior:

- `joinTeam(url)` clones the repo into `~/.config/plexus/team/`.
- If the same repo is already configured, it runs `git pull --ff-only`.
- If `team/` exists but is not a Git repo, it renames it to
  `team.plexus-backup-<timestamp>` before clone.
- `pullTeam()` runs `git pull --ff-only`.
- `teamStatus()` fetches and reports ahead/behind when upstream is available.

Still missing:

- one-click PR proposal from dashboard
- conflict UI when team and personal entries share an ID
- leave/switch team flow
- periodic refresh

### 4.6 Custom Agents

Settings includes an Agent Catalog plus a custom-agent lite registry.

Implementation:

- `packages/core/src/store/custom-agents.ts`
- `packages/core/src/agents/catalog.ts`
- `GET /api/agent-catalog`
- `GET/POST /api/custom-agents`
- `DELETE /api/custom-agents/[id]`
- `apps/web/components/custom-agents-panel.tsx`

Storage: `~/.config/plexus/personal/custom-agents.json`.

Scope today:

- add/remove a custom agent record
- store ID, display name, instruction file path, optional note
- list common market tools as either `full sync` built-ins or manual presets
  (Windsurf, Kiro, VS Code Copilot, Cline, Roo Code, Kilo Code, Continue,
  Aider, Amp, OpenHands, Zed AI)

Out of scope today:

- MCP sync for custom agents
- skills sync for custom agents
- custom-agent detail page or file editor integration

Do not imply custom agents are fully managed until those routes/components
exist.

### 4.7 Debug Snapshot

The Debug page is intentionally metadata-only.

Implementation:

- `packages/core/src/debug/index.ts`
- `GET /api/debug`
- `/debug`

It reports path existence, kind, size, mtime, symlink targets, and directory
entry counts. It must not read or return file contents because native config
files may contain secrets.

### 4.8 Rules

Entry points:

- `GET /api/rules`: status
- `PUT /api/rules`: save personal baseline
- `POST /api/rules` with `{ action: "apply" }`
- `POST /api/rules` with `{ action: "import", agentId }`
- `/rules`

Implementation: `packages/core/src/rules/index.ts`.

The Rules page lets the user edit one shared baseline, save it, import from an
agent's current instruction file, and apply the saved baseline to all
available built-in agents. The status model reports installed/enabled state,
target path, symlink target, and whether target contents match the canonical
rules file.

---

## 5. Backup And Safety Invariants

The backup module is load-bearing:

`packages/core/src/backup/index.ts`

### Core APIs

```ts
snapshotAgentConfigs({ reason });
snapshotSingleFile(absPath, reason);
listBackups();
restoreSnapshot(id);
quarantineCollision({ agent, sourcePath });
cleanupLegacyResidue();
```

### Backup Layout

```text
~/.config/plexus/backups/
├── 2026-04-30T06-00-00-000Z/
│   ├── manifest.json
│   ├── _reason.txt
│   ├── claude-code-mcp.json
│   ├── cursor-mcp.json
│   ├── codex-mcp.toml
│   └── factory-droid-mcp.json
├── _collisions/
└── _legacy-residue/
```

### Invariants

1. **Snapshot before native writes.** Any write outside
   `~/.config/plexus/` needs a backup path or an explicit reason why it is
   safe.
2. **Never follow a symlink when removing.** Use `lstat` first. If it is a
   symlink, `unlink` the link. If it is a real directory, then `rm -r`.
3. **No inline `.plexus-backup-*` residue.** Real collisions belong under
   `backups/_collisions/`, not next to agent files.
4. **Restore is destructive by design.** `restoreSnapshot()` removes the
   current file/symlink and writes the backed-up bytes back to the original
   path. It does not currently recreate the original symlink, even though the
   manifest records symlink metadata.
5. **Ring buffer keeps 20 snapshot directories.** `_collisions` and
   `_legacy-residue` live under the same backup root; be careful changing
   pruning behavior.
6. **Instruction file edits snapshot first.** The agent file editor calls
   `snapshotSingleFile()` before saving `CLAUDE.md`, `AGENTS.md`, or other
   allowed text files.

### File Edit Route Safety

`apps/web/app/api/agent/[id]/file/route.ts` currently:

- allows built-in agent IDs only
- resolves paths under the user's home directory
- blocks `~/.ssh` and `~/.aws`
- snapshots before PUT

Despite the route comment, the code does **not** currently restrict edits to
known agent roots. If you tighten this, update the route, UI expectations,
and this file together.

---

## 6. UI Architecture

The app is a local Next.js App Router dashboard.

Top-level navigation in `apps/web/components/app-sidebar.tsx`:

```text
Workspace:
  Dashboard
  Rules
  MCP Servers
  Skills
  Mirror

Configuration:
  Backups
  Debug
  Team (1.1 beta)
  Settings
```

### Dashboard `/`

Server component:

- `detectAgents()`
- `getEffectiveMcp()`
- `getEffectiveSkills()`
- `teamStatus()`

Shows:

- Sync CTA
- import banner
- detected built-in agents
- rules target sync count
- MCP/skill counters by authority
- team update callout when subscribed and behind
- recent activity placeholder

### Agent Detail `/agents/[id]`

Valid IDs are built-ins only.

Core source: `packages/core/src/agents/inspect.ts`.

Shows:

- conventional instruction file (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, or
  `QWEN.md` depending on the agent)
- skill entries with `Plexus-owned` vs `agent-local`
- MCP file status, mode, size, mtime, symlink target

The file viewer/editor modal lives in `apps/web/components/agent-detail.tsx`.
Edits go through `/api/agent/[id]/file`, which snapshots first.

### Rules `/rules`

Component: `apps/web/components/rules-panel.tsx`.

Current behavior:

- edit the personal canonical rules file
- save through `PUT /api/rules`
- apply to all installed, enabled built-in agents through `POST /api/rules`
- import one agent's current instruction file into the personal baseline
- show target status as linked, in sync, drift, missing, disabled, or not
  installed

### MCP Servers `/mcp`

Component: `apps/web/components/mcp-editor.tsx`.

Current behavior:

- table rows come from `getEffectiveMcp()`
- personal rows can be toggled or deleted
- native rows can be toggled, which promotes them to personal
- team rows are read-only in the UI
- adding a row writes the personal MCP list through `/api/mcp`, then syncs

### Skills `/skills`

Component: `apps/web/components/skills-editor.tsx`.

Current behavior mirrors MCP:

- rows come from `getEffectiveSkills()`
- native rows promote to personal on toggle
- personal rows can be created/deleted
- team rows are read-only in the UI
- created skills generate `SKILL.md` frontmatter automatically

### Mirror `/mirror`

Component: `apps/web/components/mirror-panel.tsx`.

Single source agent, multiple target agents. The panel calls `/api/spread`
for each target preview and apply. Target badges show how the target will be
written: `partial-write` for Claude/Codex/Gemini/Qwen, `symlink` for
Cursor/Droid.

### Backups `/backups`

Component: `apps/web/components/backups-panel.tsx`.

Lists `listBackups()` and posts to `/api/backups/[id]/restore` after a
destructive confirmation.

### Debug `/debug`

Component: `apps/web/components/debug-panel.tsx`.

Shows copyable metadata-only diagnostics. Keep it free of file contents.

### Team `/team`

Component: `apps/web/components/team-panel.tsx`.

Wired to clone/pull/status, but still labeled 1.1 beta. PR proposals and
conflict handling are manual.

### Settings `/settings`

Components:

- `SettingsPanel`: enabled agents, sync strategy, local-only pledge
- `CustomAgentsPanel`: Agent Catalog and custom agent lite registry

---

## 7. CLI And Scripts

### CLI

Source: `packages/cli/src/bin.ts`.

Commands:

```text
plexus
plexus start [-p <port>]
plexus detect
plexus join <git-url>
plexus pull
plexus sync
plexus status
plexus help
```

`plexus` / `plexus start` locates `apps/web` and runs:

- `npm run start` if `.next/` exists
- otherwise `npm run dev`

This is convenient for the monorepo and `npm link`. A fully packaged
zero-install `npx plexus` distribution is still a release-hardening item;
`apps/web/next.config.mjs` does not currently use `output: "standalone"`.

### Important Scripts

Root `package.json`:

```text
npm run dev          # web dev server on :7777
npm run build        # build all workspaces
npm run build:core
npm run build:cli
npm run typecheck
npm run test
npm run test:core
npm run check        # biome check
npm run verify       # biome + core tests + all builds
npm run bump:patch
npm run release:patch
npm run ship -- "<subject>"
```

`scripts/ship.mjs` is the one-shot release path:

1. verify
2. patch bump
3. stage all changes
4. commit with co-author trailer
5. tag `vX.Y.Z`
6. push branch and tag

Do not run `ship` casually when the worktree contains user changes that should
not be included.

---

## 8. Development Rules

### Communication

- Talk to the user in Chinese.
- Code, identifiers, commit messages, PR titles, and this technical file stay
  in English unless asked otherwise.
- Before implementation, state assumptions and success criteria when the task
  is non-trivial.

### Editing

- Keep changes surgical.
- Do not clean up unrelated code.
- Preserve user changes in the working tree.
- Never use destructive git commands such as `git reset --hard` or
  `git checkout -- <file>` unless the user explicitly asks.
- Use `rg` for search.
- Use `apply_patch` for manual file edits.

### Git

- Default branch is `master`.
- Business-logic commits should bump patch versions across all workspace
  packages.
- Never push without a successful build.
- Commit messages are short English subjects with this trailer:

```text
Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>
```

### Node Version

Use Node 20 from nvm. The user's default PATH may point to an older Node.

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"
```

### Dev Server

Port `7777` is reserved for Plexus.

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"
cd /path/to/Plexus
lsof -ti:7777
npm run dev
```

If a stale Next.js process is occupying `7777`, kill only that stale process
after confirming it is Plexus-related.

---

## 9. Validation Checklist

For code or behavior changes, run:

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"
cd /path/to/Plexus
npm run build --workspace=@plexus/core
npm run build --workspace=@plexus/web
```

For broader changes, prefer:

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"
cd /path/to/Plexus
npm run verify
```

Sanity-test a running dev server:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7777/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7777/backups
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7777/api/backups
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7777/debug
```

After sync-related changes, also verify no inline backup residue:

```bash
ls ~/.claude/skills | grep plexus-backup || echo "(clean)"
ls ~/.cursor        | grep plexus-backup || echo "(clean)"
ls ~/.factory       | grep plexus-backup || echo "(clean)"
```

For doc-only changes to `CLAUDE.md`, at minimum run:

```bash
git diff --check -- CLAUDE.md
```

---

## 10. Known Limitations And Roadmap

Current limitations:

- Effective view does not compute real `divergent` diffs.
- Mirror / spread target sync currently bypasses the backup snapshot path.
- Team subscription can clone/pull/status, but PR proposal and conflict
  workflows are manual.
- Custom agents are instruction-file registry records only.
- Rules apply covers built-in agents only; custom agent rules projection is not
  wired yet.
- Project-scoped MCP files are not managed.
- Secrets are plaintext in the local store.
- Packaged `npx plexus` distribution is not fully hardened.
- Windows is unverified.

Recently important fixes that must not regress:

- Claude Code path is `~/.claude.json`, not a Claude Desktop path.
- Symlink-safe removal must use `lstat` first.
- Collisions go to `backups/_collisions/`, not inline `.plexus-backup-*`
  files.
- Legacy residue cleanup hides/quarantines old `.plexus-backup-*` entries.
- Instruction file edits snapshot with `snapshotSingleFile()`.
- Debug snapshots must not include file contents.

---

## 11. Quick Reference

| Question | File |
|---|---|
| Known built-in agents and paths | `packages/core/src/store/paths.ts` |
| Store scaffolding | `packages/core/src/store/scaffolding.ts` |
| Config YAML I/O | `packages/core/src/store/config.ts` |
| MCP YAML I/O | `packages/core/src/store/mcp.ts` |
| Skill frontmatter I/O | `packages/core/src/store/skills.ts` |
| Rules text I/O | `packages/core/src/store/rules.ts` |
| Team/personal merge | `packages/core/src/store/merge.ts` |
| Custom agents lite store | `packages/core/src/store/custom-agents.ts` |
| Agent detection | `packages/core/src/agents/detect.ts` |
| Agent inspection | `packages/core/src/agents/inspect.ts` |
| JSON MCP adapters | `packages/core/src/agents/adapters/json-mcp.ts` |
| Codex TOML adapter | `packages/core/src/agents/adapters/codex.ts` |
| Adapter file/link helpers | `packages/core/src/agents/adapters/base.ts` |
| Full sync | `packages/core/src/sync/index.ts` |
| Rules status/apply/import | `packages/core/src/rules/index.ts` |
| Effective MCP/skill tables and toggles | `packages/core/src/effective/index.ts` |
| Import native config | `packages/core/src/import/from-agents.ts` |
| Mirror/spread | `packages/core/src/spread/index.ts` |
| Backups, restore, quarantine | `packages/core/src/backup/index.ts` |
| Team Git subscription | `packages/core/src/team/git.ts` |
| Debug snapshot | `packages/core/src/debug/index.ts` |
| CLI | `packages/cli/src/bin.ts` |
| Sidebar nav and version badge | `apps/web/components/app-sidebar.tsx` |
| Agent catalog presets | `packages/core/src/agents/catalog.ts` |
| Agent file edit API | `apps/web/app/api/agent/[id]/file/route.ts` |
| Rules API | `apps/web/app/api/rules/route.ts` |
| Rules UI | `apps/web/components/rules-panel.tsx` |
| Refactor docs | `docs/refactor/` |

---

*Last updated for v0.0.14 on 2026-04-30. If you change the sync contract,
store layout, backup behavior, supported paths, CLI behavior, or UI routes,
update this file in the same change.*
