# CLAUDE.md - Plexus

> **For the next Droid/Claude Code session.** This file is the single source
> of truth for "what is Plexus, what's already built, what's open, and what
> conventions to follow." Read it end-to-end before touching code.

---

## 1. What Plexus Is

A **local web dashboard** that lets a single human (and eventually a team)
manage AI agent configuration — MCP servers, skills, and instruction files
(`CLAUDE.md` / `AGENTS.md`) — across **every AI agent installed on the same
machine** (Claude Code, Cursor, Codex, Factory Droid, …).

The pitch in one sentence:

> *"One source of truth in `~/.config/plexus/`, kept in sync with each
> agent's native location via symlinks where possible and partial-write
> JSON/TOML where not, with automatic backups and a 1-click revert."*

Distribution model (target): `npx plexus dev` opens
http://localhost:7777, no install. Team config layered via a public GitHub
repo subscription.

### Why this exists (problem statement)

- A power user has 11 MCPs configured in Claude Code, 8 in Cursor, none in
  Codex. Every change has to be made in N places.
- Skills are even worse: `~/.claude/skills/` and `~/.cursor/...` and
  `~/.factory/skills/` all hold near-identical folders that drift.
- A team wants to standardise "everyone in the org gets the
  `atlassian-mcp` skill," but each engineer is on a different agent.
- Today there's no neutral surface to (a) see all this, (b) edit it
  safely, (c) push a change to multiple agents at once, (d) undo when
  something breaks.

Plexus solves (a)–(d) with a deliberately *thin* design: it never *invents*
configuration; it just lifts native files into a canonical store and
projects them back out via the cheapest reversible mechanism per agent.

### Non-goals

- Not a runtime engine — Plexus does not execute MCPs or skills.
- Not Windows-first — we assume macOS/Linux symlinks work.
- Not a secrets manager — secrets stay in agent-native files; the
  canonical store can hold them but we surface a warning.

---

## 2. Repo Layout

```
Plexus/
├── package.json                 # npm workspaces root (private)
├── tsconfig.base.json           # strict TS shared by every workspace
├── .nvmrc                       # 20 (Next.js 14 needs >=18.17)
├── .gitignore
├── README.md
├── CLAUDE.md                    # ← this file
├── apps/
│   └── web/                     # Next.js 14 dashboard (App Router)
│       ├── app/
│       │   ├── layout.tsx       # sidebar + nav + version label
│       │   ├── page.tsx         # Dashboard (agent grid + counts)
│       │   ├── agents/[id]/page.tsx     # per-agent detail page
│       │   ├── mcp/page.tsx
│       │   ├── skills/page.tsx
│       │   ├── mirror/page.tsx          # source × multi-target
│       │   ├── spread/page.tsx          # 307 → /mirror
│       │   ├── backups/page.tsx         # snapshot list + restore
│       │   ├── team/page.tsx
│       │   ├── settings/page.tsx
│       │   └── api/
│       │       ├── sync/route.ts
│       │       ├── mcp/route.ts
│       │       ├── mcp/[id]/toggle/route.ts
│       │       ├── mcp/effective/route.ts
│       │       ├── skills/route.ts
│       │       ├── skills/[id]/route.ts
│       │       ├── skills/[id]/toggle/route.ts
│       │       ├── skills/effective/route.ts
│       │       ├── import/route.ts
│       │       ├── spread/route.ts
│       │       ├── team/route.ts
│       │       ├── config/route.ts
│       │       ├── agent/[id]/route.ts          # GET inspector
│       │       ├── agent/[id]/file/route.ts     # GET/PUT file
│       │       ├── backups/route.ts             # GET list
│       │       └── backups/[id]/restore/route.ts
│       ├── components/
│       │   ├── sync-button.tsx
│       │   ├── import-banner.tsx
│       │   ├── mcp-editor.tsx
│       │   ├── skills-editor.tsx
│       │   ├── agent-detail.tsx
│       │   ├── mirror-panel.tsx
│       │   └── backups-panel.tsx
│       ├── lib/version.ts       # PLEXUS_VERSION from pkg.version
│       ├── tailwind.config.ts
│       ├── next.config.mjs
│       └── package.json
├── packages/
│   ├── core/                    # all real logic — pure TS, no DOM
│   │   ├── src/
│   │   │   ├── types.ts         # AgentId, ServerEntry, Skill, …
│   │   │   ├── store/
│   │   │   │   ├── paths.ts                 # PLEXUS_PATHS, AGENT_PATHS
│   │   │   │   ├── fs-utils.ts
│   │   │   │   ├── config.ts                # personal/team config
│   │   │   │   ├── mcp.ts                   # YAML I/O
│   │   │   │   ├── skills.ts                # frontmatter+md I/O
│   │   │   │   ├── merge.ts                 # personal overrides team
│   │   │   │   └── scaffolding.ts           # ensures dirs exist
│   │   │   ├── agents/
│   │   │   │   ├── detect.ts
│   │   │   │   ├── inspect.ts               # full per-agent snapshot
│   │   │   │   └── adapters/
│   │   │   │       ├── base.ts              # placeLinkOrCopy
│   │   │   │       ├── json-mcp.ts          # Claude/Cursor/Droid
│   │   │   │       ├── codex.ts             # TOML partial-write
│   │   │   │       └── index.ts
│   │   │   ├── sync/index.ts                # one-shot sync engine
│   │   │   ├── effective/index.ts           # native + store merge
│   │   │   ├── import/index.ts              # 3-kind candidates
│   │   │   ├── spread/index.ts              # source→targets diff
│   │   │   ├── backup/index.ts              # snapshot/restore/cleanup
│   │   │   ├── team/git.ts                  # GitHub subscription stub
│   │   │   └── index.ts                     # barrel
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── cli/                     # `plexus` CLI (kept small)
│       ├── src/index.ts
│       └── package.json
├── examples/
│   └── team-config-template/    # what a team repo looks like
└── scripts/                     # dev helpers (none required by docs)
```

### Workspace conventions

- **TS strict, ESM only** (`"type": "module"`, `.js` imports inside `.ts`).
- Every workspace has its own `package.json`. Versions match the root
  package.json (currently **0.0.2**) and bump together on every
  business-logic commit.
- `apps/web` imports core via `"@plexus/core": "0.0.x"` workspace symlink.

---

## 3. The Two Critical Mental Models

If you remember nothing else, remember these two.

### 3.1 The Three Layers of Configuration State

```
                     ┌────────────────────────────────────┐
                     │  Effective view in the dashboard   │  ← user-facing
                     │  (ManagedKind for every entry)     │
                     └─────────────▲──────────────────────┘
                                   │ merge (effective/index.ts)
              ┌────────────────────┴────────────────────┐
              │                                         │
   ┌──────────▼──────────┐                  ┌───────────▼────────┐
   │   Plexus store      │                  │   Native agent     │
   │ ~/.config/plexus/   │                  │   files            │
   │   ├ team/   …       │                  │ ~/.claude.json     │
   │   ├ personal/ …     │                  │ ~/.cursor/mcp.json │
   │   ├ .cache/mcp/ …   │   sync writes    │ ~/.codex/...       │
   │   └ backups/ …      ├──────────────────►  ~/.factory/...    │
   └─────────────────────┘                  └────────────────────┘
                ▲                                        │
                └─── import (3-kind detector) ───────────┘
```

Three things that are *not* the same:

1. **The Plexus canonical store** — YAML for MCPs (`mcp/servers.yaml`),
   markdown+frontmatter for skills (`skills/<id>/SKILL.md`). One file =
   one entry. The user can hand-edit these.
2. **The native agent files** — `~/.claude.json` (a 60KB blob with auth +
   history + mcpServers), `~/.cursor/mcp.json`, `~/.codex/config.toml`,
   `~/.factory/mcp.json`. The file format is whatever the agent demands.
3. **The effective view** — what the dashboard shows. For each MCP
   server / skill we compute one of:
   - `native-only` — exists in agent file, not in store
   - `personal` — in store under personal layer
   - `team` — in store under team layer
   - `synced` — store entry currently mirrored to a native file
   - `divergent` — same id in both, contents differ

The dashboard's job is to keep these three layers honest. **Never let the
UI conflate "what's in the store" with "what an agent currently sees."**
The bug we fixed twice was the dashboard treating the store as ground
truth while the native files had drifted.

### 3.2 Hybrid Sync: Exclusive vs Shared

Different agent files carry different amounts of "stuff Plexus shouldn't
touch." This single fact drives the entire sync engine.

| Agent file              | Other contents besides MCPs           | Mode       |
|-------------------------|---------------------------------------|------------|
| `~/.claude.json`        | auth tokens, history, settings        | `shared`   |
| `~/.codex/config.toml`  | profiles, auth, model overrides       | `shared`   |
| `~/.cursor/mcp.json`    | (only MCP servers — single-purpose)   | `exclusive`|
| `~/.factory/mcp.json`   | (only MCP servers — single-purpose)   | `exclusive`|

#### Exclusive mode (Cursor, Factory Droid)

The whole file is "ours." We:

1. Render the merged store to `~/.config/plexus/.cache/mcp/<agent>.json`.
2. Replace the agent's native path with a **symlink** pointing at the cache.
3. If the native path was already a real file, we evict it via
   `quarantineCollision()` (see §4.3) into `~/.config/plexus/backups/_collisions/`.

Result: editing the agent file directly is impossible without breaking the
symlink, and editing the cache file is reflected instantly in the agent.

#### Shared mode (Claude Code, Codex)

We can never own the file. Instead we **partial-write**:

- Read the file.
- Replace **only** the `mcpServers` (JSON) or `mcp_servers` (TOML)
  section with the rendered store contents.
- Write back. Every other key — auth, history, profiles — is preserved
  byte-for-byte using `JSON.parse → mutate → JSON.stringify` (or a
  TOML-specific equivalent).

Result: Claude/Codex still see their own auth and history, and our
managed servers ride along inside the same file.

#### `mcpFileMode` is a per-agent capability

`packages/core/src/types.ts → AgentCapabilities.mcpFileMode` carries
`"exclusive" | "shared"` and is hard-coded in
`packages/core/src/store/paths.ts → AGENT_PATHS`. The adapter reads it and
dispatches accordingly. **Never change a mode without auditing every site
that calls `placeFileSymlink` or partial-write helpers.**

#### Skills are simpler

Skills are always exclusive (one folder per skill). We symlink
`<agent>/skills/<id>` → `~/.config/plexus/<layer>/skills/<id>/`. If a real
folder is at the symlink target, `quarantineCollision()` evicts it before
we place the link.

---

## 4. The Backup Module

Located in `packages/core/src/backup/index.ts`. **This is load-bearing.**
Every write path on the agent side must funnel through it.

### 4.1 Core APIs

```ts
snapshotAgentConfigs({ reason })   // before every sync
snapshotSingleFile(absPath, reason)// before every dashboard file edit
listBackups()                      // returns Snapshot[] with entries
restoreSnapshot(id)                // copy back over originals
quarantineCollision({ agent, sourcePath })   // pre-write eviction
cleanupLegacyResidue()             // one-shot scrub of old `.plexus-backup-*`
```

### 4.2 Layout

```
~/.config/plexus/backups/
├── 2026-04-27T03-00-58-753Z/         # ring-buffered snapshots (max 20)
│   ├── manifest.json
│   ├── _reason.txt
│   ├── claude-code-mcp.json
│   ├── cursor-mcp.json
│   └── …
├── _collisions/                       # placeLinkOrCopy quarantine
│   └── 2026-04-27T03-00-58-757Z/
│       ├── claude-code/...
│       └── cursor/...
└── _legacy-residue/                   # one-shot v0.0.1→v0.0.2 cleanup
    └── 2026-04-27T03-00-58-757Z/
        └── claude-code/agent-harness-construction.plexus-backup-…
```

### 4.3 Critical invariants

1. **Symlink-safe removal.** Before removing any path we already think we
   own, `lstat` first. If it's a symlink, `fs.unlink`; otherwise `fs.rm`
   recursively. The naive `fs.rm(p, { recursive: true })` will follow the
   symlink and delete the *cache target*, which is the canonical store —
   this bug shipped once and never again.

2. **Inline residue is forbidden.** Adapters used to rename collisions to
   `<name>.plexus-backup-<ts>` next to the original; we no longer do this
   because it pollutes the agent's own directory. All collisions go to
   `_collisions/<ts>/<agent>/...`. `cleanupLegacyResidue()` exists solely
   to scrub the leftover `.plexus-backup-*` from older versions.

3. **Restore is destructive on purpose.** `restoreSnapshot` does **not**
   take a fresh snapshot before overwriting — that's the whole point of
   a "go back to before this snapshot" operation. The UI surfaces this in
   the confirm dialog.

4. **The 20-snapshot ring buffer.** Older snapshots are pruned on every
   new write. If the user wants long-term archival they should copy
   manually outside `~/.config/plexus/backups/`.

5. **Restore covers per-file edits too.** `snapshotSingleFile` is called
   when the dashboard saves an instruction file (`CLAUDE.md`, `AGENTS.md`,
   per-skill `SKILL.md`). The same `restoreSnapshot()` works because the
   manifest records `originalPath`.

---

## 5. The UI Architecture

### 5.1 Top-level navigation (`apps/web/app/layout.tsx`)

```
Dashboard / MCP Servers / Skills / Mirror / Team / Backups / Settings
```

Plus a tiny version badge `v0.0.X` in the sidebar header pulled from
`apps/web/lib/version.ts` → `process.env`-free at build time.

### 5.2 Dashboard (`/`)

- Imports detected? → green `Sync All Agents` CTA.
- 4 agent cards in a 2-col grid; each is a `<Link>` to `/agents/<id>`.
- Two big counters (MCPs, Skills) with breakdown:
  `N team · M personal · K native-only`. Clicks route to /mcp /skills.
- `<ImportBanner />` surfaces 3-kind import candidates (new / extend /
  managed) with a single Apply button.

### 5.3 Per-agent page (`/agents/[id]`)

Server component renders `inspectAgent(id)` from
`packages/core/src/agents/inspect.ts`. The client component `<AgentDetail>`
renders three sections:

- **MCP File**: path, mode (`exclusive`|`shared`), is-symlink, link target,
  size, mtime. View button opens a `<FileViewerButton>` modal that fetches
  the file via `GET /api/agent/[id]/file?path=...`. Save button calls
  `PUT /api/agent/[id]/file` which `snapshotSingleFile` first.
- **Instruction Files**: only `CLAUDE.md` for Claude Code,
  `AGENTS.md` for the others. Same view/edit modal.
- **Skills**: the on-disk folders the agent has. Each row tagged
  `Plexus-owned` (symlink → store) or `agent-local` (real dir, drift
  candidate). Per-skill SKILL.md edit button.

`inspectAgent` filters out `.DS_Store` and any name containing
`.plexus-backup-` so old residue doesn't pollute the list.

### 5.4 MCP / Skills pages

Effective list with toggles. Each row has:

- A "managed kind" badge (team / personal / synced / divergent / native-only).
- Per-(item × agent) checkboxes. Toggling triggers a re-sync of *all native
  source agents* so promoting from native-only to personal stays consistent
  across every agent that already had it.

Both pages include a `<details>` block titled
*"How does checking a box change the file system?"* that explicitly walks
through exclusive vs shared and reminds the user every toggle takes a
backup snapshot first.

### 5.5 Mirror page (`/mirror`)

Replaces the old "Spread" page. Single source dropdown × multi-target
checkbox grid. Each target shows its file mode badge so the user can see
whether their pick will result in a symlink or a partial-write. One Apply
button. `/spread` 307-redirects to `/mirror`.

### 5.6 Backups page (`/backups`)

Lists `listBackups()` output. Each row shows timestamp, file count, and
expand-able details with the originalPath for each entry. **Restore**
button has a destructive confirm dialog, then POSTs to
`/api/backups/<id>/restore` and refreshes the list.

### 5.7 Team page (`/team`)

Stub for the GitHub subscription flow. Currently shows "No team
subscription. Join a team →" but doesn't yet wire up `team/git.ts`. This
is the biggest open feature.

---

## 6. The Version Story

- Started at **0.0.0**.
- v0.0.1 added: agent detail page, Spread→Mirror, version label,
  symlink-direction visibility.
- v0.0.2 (current) adds: restore-from-backup UI, central
  `_collisions/` quarantine, one-shot `_legacy-residue/` cleanup, agent
  inspector hides residue.

Every monorepo `package.json` carries the same version. Bump all four
together on each business-logic commit. The sidebar reads from
`apps/web/lib/version.ts`, which imports `apps/web/package.json`.

```json
// example: apps/web/package.json
{
  "name": "@plexus/web",
  "version": "0.0.2",
  "dependencies": { "@plexus/core": "0.0.2" }
}
```

---

## 7. Conventions

### 7.1 Communication

- **Talk to the user in Chinese.** Code, identifiers, commit messages,
  PR titles → English.

### 7.2 Default git behaviour

- Default branch: `master` (yes, master, not main — the upstream remote
  is configured this way; do not rename without asking).
- After finishing and verifying a substantive change: **commit + push +
  bump patch** without asking. The user has explicitly opted into this.
- Doc-only changes under `docs/**/*.puml` or `docs/presentations/*.html`
  → commit only, no push, no tag, unless the user says otherwise.
- Use small English commit messages with co-author trailer:
  ```
  Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>
  ```
- Never push without running the build first
  (`npm run build --workspace=@plexus/core` and
  `npm run build --workspace=@plexus/web`).

### 7.3 Node version

Next.js 14 requires Node ≥18.17. The user's default `node` on PATH is
18.15, but Node 20 is installed via nvm at
`~/.nvm/versions/node/v20.19.6/bin`. **Always prefix dev/build commands
with `export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"`** or
the build will fail.

### 7.4 Dev server

Port `7777` is reserved for the dashboard. There may be stale
`next-server` processes from previous sessions; check
`lsof -ti:7777` before starting and kill stale PIDs.

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"
cd apps/web && npm run dev   # http://localhost:7777
```

### 7.5 Where the user's real config lives

These are real, sensitive paths on the user's machine. Treat with care:

- `~/.claude.json` — Claude Code (60 KB+ shared file)
- `~/.cursor/mcp.json`
- `~/.codex/config.toml`
- `~/.factory/mcp.json`, `~/.factory/skills/`, `~/.factory/droids/`
- `~/.claude/skills/` — Claude Code skills folder
- `~/.config/plexus/` — Plexus canonical store + backups (the only place
  Plexus owns)

Any code path that writes outside the last bullet must (a) snapshot
first, (b) be reversible from `/backups`, (c) never touch
`~/.ssh/`, `~/.aws/` (the `agent/[id]/file` API has a hard-coded safelist
that blocks those even via path traversal).

### 7.6 Type discipline

`packages/core` is strict TS with no `any` outside genuinely dynamic JSON
parsing. New code there must keep that bar. The dashboard side is
allowed pragmatic `any` in event handlers but should still type its
fetch results.

---

## 8. The Open Roadmap

### 8.1 Confirmed but not started

- **Team subscription flow.** `packages/core/src/team/git.ts` is a stub.
  We need (a) `plexus team subscribe <github-url>`, (b) periodic refresh,
  (c) handling of merge conflicts when team and personal share an id, (d)
  a UI in `/team` that surfaces the team repo state.
- **`npx plexus dev` distribution.** The CLI works locally but isn't
  published. We need a `bin` entry that boots the Next.js app from a
  packaged build, plus an `examples/team-config-template` linked to a
  public repo.
- **Conflict UI when divergent.** Today divergent rows just get a badge.
  We need a small diff viewer to show "what changed where" and a
  one-click "promote native → store" or "push store → native."

### 8.2 Known limitations (documented in README)

- Project-scoped MCP (`<repo>/.cursor/mcp.json`) is **not** considered.
  Plexus only manages the per-user level today.
- Secrets in the canonical store are written in plaintext. The Settings
  page should grow a warning + a "redact for team push" workflow.
- Windows is not tested. Symlink fallback to copy exists but the
  partial-write helpers haven't been verified on NTFS.

### 8.3 Recently fixed (don't undo)

- Wrong Claude path (`~/.claude/claude.json` → `~/.claude.json`).
- Symlink-following `fs.rm` deleting the cache (use `lstat` first).
- Effective-view drift between banner and cards (single
  `getEffective*()` source).
- Inline `.plexus-backup-*` debris in agent dirs (now central).
- Per-skill SKILL.md edit not snapshotting (now `snapshotSingleFile`).

---

## 9. Validation Checklist Before You Commit

Run all of these. They're fast.

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"
cd /path/to/Plexus
npm run build --workspace=@plexus/core      # tsc strict
npm run build --workspace=@plexus/web       # next build
```

Then sanity-test the running dev server:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7777/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7777/backups
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7777/api/backups
curl -s -X POST http://localhost:7777/api/sync | python3 -c "import sys,json;print(json.load(sys.stdin)['results'])"
```

After a sync, verify no inline residue:

```bash
ls ~/.claude/skills | grep plexus-backup || echo "(clean)"
ls ~/.cursor       | grep plexus-backup || echo "(clean)"
ls ~/.factory      | grep plexus-backup || echo "(clean)"
```

If any of those return non-empty, `cleanupLegacyResidue()` regressed.

---

## 10. Quick Reference: Where Does X Live?

| Question                                  | File |
|-------------------------------------------|------|
| What agents do we know about?             | `packages/core/src/store/paths.ts → ALL_AGENTS, AGENT_PATHS` |
| How do we detect installed agents?        | `packages/core/src/agents/detect.ts` |
| How does sync work end-to-end?            | `packages/core/src/sync/index.ts` |
| How do we partial-write `~/.claude.json`? | `packages/core/src/agents/adapters/json-mcp.ts` |
| How do we partial-write Codex TOML?       | `packages/core/src/agents/adapters/codex.ts` |
| Who computes the effective view?          | `packages/core/src/effective/index.ts` |
| Who imports a native MCP into the store?  | `packages/core/src/import/index.ts` |
| Who picks "is this native, personal, team, synced, divergent"? | `packages/core/src/effective/index.ts` |
| Where do we keep the Plexus canonical store? | `~/.config/plexus/` (`PLEXUS_PATHS` in `paths.ts`) |
| Where does the agent inspector come from? | `packages/core/src/agents/inspect.ts` |
| Where's the version label rendered?       | `apps/web/app/layout.tsx` (reads `lib/version.ts`) |
| Where's the snapshot ring-buffer logic?   | `packages/core/src/backup/index.ts` |
| Where's the restore UI?                   | `apps/web/components/backups-panel.tsx` |
| Where's the safelist that blocks `~/.ssh`? | `apps/web/app/api/agent/[id]/file/route.ts` |

---

*Last updated for v0.0.2. If you change the directory layout, the sync
contract, or the backup module, update this file in the same commit.*
