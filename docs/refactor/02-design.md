# Plexus 1.0 — Design Spec

> **Phase:** Designer
> **Owner:** Plexus team
> **Status:** Draft v1 — paired with `mockups/dashboard.html`
> **Source skills:** `anthropics/skills@frontend-design`,
> `anthropics/knowledge-work-plugins@design-system`
> **References:** claude.ai web app, Claude Code web,
> `VoltAgent/awesome-claude-design`

---

## 1. Aesthetic North Star

**"Quiet warmth, not cold tech."** Claude's visual identity reads like a
high-end notebook app — generous spacing, restrained colour, warm
off-black instead of pure black, subtle but human accent colour.
Plexus 1.0 adopts this directly because:

- The audience already lives inside Claude Code; visual continuity reduces
  cognitive load.
- Plexus operates on *trust-sensitive files* (auth tokens, instruction
  docs). A warm, calm interface signals safety where a neon/cyber palette
  would signal risk.
- "100% replicate Claude Code" was a hard product requirement.

What we are **not** doing:

- No purple gradients.
- No glassmorphism.
- No generic "shadcn defaults" look (we override the palette).
- No cyberpunk / neon greens.

---

## 2. Design Tokens

All values exposed as CSS custom properties under `:root` and
`[data-theme="light"]`. Tailwind reads them via `theme.extend.colors`.

### 2.1 Colour — Dark (default)

```css
:root, [data-theme="dark"] {
  /* Surface */
  --plexus-bg:        #1a1a17;   /* page background, warm off-black */
  --plexus-surface:   #262624;   /* cards, sidebar, modals */
  --plexus-surface-2: #2f2f2c;   /* hover state on surface */
  --plexus-border:    #3a3a37;   /* hairline dividers */
  --plexus-border-strong: #4a4a45;

  /* Text */
  --plexus-text:      #f5f4ed;   /* primary, warm off-white */
  --plexus-text-2:    #c2bfb3;   /* secondary */
  --plexus-text-3:    #8a8678;   /* tertiary, captions */
  --plexus-text-mute: #6b6759;   /* disabled / placeholders */

  /* Accents */
  --plexus-accent:    #cc785c;   /* Anthropic warm coral; primary CTA */
  --plexus-accent-2:  #d68b73;   /* hover */
  --plexus-accent-faint: rgba(204, 120, 92, 0.12);

  /* Status */
  --plexus-ok:        #6b9971;   /* muted sage, not bright green */
  --plexus-warn:      #c8a45c;   /* muted amber */
  --plexus-err:       #c4604f;   /* muted brick */
  --plexus-info:      #6b8aa8;   /* muted slate-blue */

  /* Code highlights */
  --plexus-code-bg:   #1f1f1d;
  --plexus-code-fg:   #d4d0c4;
}
```

### 2.2 Colour — Light

```css
[data-theme="light"] {
  --plexus-bg:        #f5f4ed;
  --plexus-surface:   #ffffff;
  --plexus-surface-2: #faf9f4;
  --plexus-border:    #e6e3d8;
  --plexus-border-strong: #d4d0c4;

  --plexus-text:      #1a1a17;
  --plexus-text-2:    #4a4a45;
  --plexus-text-3:    #6b6759;
  --plexus-text-mute: #8a8678;

  --plexus-accent:    #b85f3f;
  --plexus-accent-2:  #a85433;
  --plexus-accent-faint: rgba(184, 95, 63, 0.10);

  --plexus-ok:        #4a7a52;
  --plexus-warn:      #966f2c;
  --plexus-err:       #984032;
  --plexus-info:      #4a6688;

  --plexus-code-bg:   #f0eee5;
  --plexus-code-fg:   #2a2a26;
}
```

### 2.3 Typography

```css
--font-sans: "Inter", "Inter Variable", ui-sans-serif, system-ui, sans-serif;
--font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular,
             Menlo, Consolas, monospace;
--font-serif: "Tiempos", "Source Serif Pro", Georgia, serif;  /* used sparingly */
```

Self-hosted via `next/font` (no Google Fonts call, honours privacy pledge).

| Token | Size | Weight | Line-height | Letter-spacing | Use |
|---|---|---|---|---|---|
| `display`   | 28px | 600 | 1.15 | -0.02em | Page titles |
| `title`     | 18px | 600 | 1.25 | -0.01em | Section headers |
| `body`      | 14px | 400 | 1.55 | 0      | Default body |
| `body-md`   | 15px | 400 | 1.55 | 0      | Reading flow |
| `label`     | 13px | 500 | 1.4  | 0.01em | UI labels, badges |
| `caption`   | 12px | 400 | 1.4  | 0.02em | Captions, table meta |
| `mono-sm`   | 12px | 400 | 1.4  | 0      | File paths, hashes |
| `mono-md`   | 13px | 400 | 1.55 | 0      | Code blocks |

**Eyebrow labels** (e.g. "DETECTED AGENTS"): `caption` with
`text-transform: uppercase` and `letter-spacing: 0.08em`.

### 2.4 Spacing & radius

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

--radius-sm: 6px;   /* badges, small chips */
--radius:    8px;   /* default — buttons, inputs, cards */
--radius-md: 10px;  /* large cards, panels */
--radius-lg: 14px;  /* modals, hero sections */
```

### 2.5 Elevation (subtle, never harsh)

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.18);
--shadow:    0 4px 12px rgba(0,0,0,0.20), 0 1px 2px rgba(0,0,0,0.10);
--shadow-lg: 0 20px 40px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.15);
```

Light mode uses warmer / softer shadows (`rgba(74, 74, 69, 0.10)` family).

### 2.6 Motion

```css
--ease-out:  cubic-bezier(0.22, 1, 0.36, 1);
--ease-in:   cubic-bezier(0.55, 0, 0.69, 1);
--dur-fast:  120ms;
--dur:       200ms;
--dur-slow:  320ms;
```

Hover transitions: `transition: all var(--dur) var(--ease-out)`. Page
transitions: subtle 8px slide-up + opacity (≤ `--dur-slow`). Avoid spring
animations; Claude Code's web is restrained.

### 2.7 Iconography

- **Library:** `lucide-react`. Outline style only, 1.5px stroke, 16px or
  20px size in UI chrome.
- **Logo:** A 12px filled coral circle followed by the word "Plexus" in
  display weight, mirroring Claude Code's `● Claude` lockup.

---

## 3. Component Inventory (shadcn/ui-based)

We adopt shadcn/ui primitives and override the theme via the tokens
above. Every component below has a Radix primitive backing it.

| Component | Source | Plexus override |
|---|---|---|
| Button | shadcn `button` | Variants: `primary` (coral), `secondary` (surface-2), `ghost`, `danger`. Disabled state uses `--plexus-text-mute`. |
| Input / Textarea | shadcn `input` | 1px border, focus ring `--plexus-accent` at 35% alpha. |
| Select | shadcn `select` | Same as Input, chevron from lucide. |
| Switch | shadcn `switch` | Track `--plexus-border`, thumb white, on-state `--plexus-accent`. |
| Checkbox | shadcn `checkbox` | Same as Switch on-state. |
| Tabs | shadcn `tabs` | Active border-bottom 2px coral, inactive `--plexus-text-2`. |
| Tooltip | shadcn `tooltip` | Surface-2 background, `--shadow-sm`, body-sm. |
| Dialog (modal) | shadcn `dialog` | Max-width 560px (forms), 720px (file viewers). Backdrop `rgba(0,0,0,0.55)`. |
| Sheet (drawer) | shadcn `sheet` | Right side, 480px, used for inspector deep-dives. |
| Popover | shadcn `popover` | Surface-2, `--radius-md`. |
| Toast | shadcn `sonner` | Bottom-right stack. Success uses `--plexus-ok` left bar. |
| Table | shadcn `table` | First col left-aligned, numeric right-aligned, hover row `--plexus-surface-2`. |
| Badge | shadcn `badge` | Variants: `team`, `personal`, `synced`, `divergent`, `native-only`, `beta`. |
| Card | shadcn `card` | Padding 24px, border 1px hairline, no shadow at rest. |
| ProgressBar | shadcn `progress` | Thin (4px), coral fill. |
| Skeleton | shadcn `skeleton` | `--plexus-surface-2` shimmer. |
| Separator | shadcn `separator` | 1px hairline. |
| Command palette | shadcn `command` | Triggered by ⌘K — used for global navigation. |
| Diff viewer | custom on `react-diff-viewer-continued` | Used in inspector when row is `divergent`. |

### 3.1 Plexus-specific composites

- **AgentCard** — shows agent name, install status, sync status pill,
  count of MCPs/skills, last-synced relative time. Click → `/agents/[id]`.
- **EntryRow** — used in MCP and Skills tables. Columns: name, kind
  badge, per-agent checkboxes, last-synced caption, overflow menu.
- **StatusPill** — `in sync` / `drifted` / `out of sync` / `not detected`
  with appropriate dot colour and copy.
- **ImportBanner** — coral accent stripe on left, "we found N candidates
  to import" copy, primary CTA.
- **EmptyState** — centred lucide icon, title, body, primary CTA. Used
  in MCP/Skills/Backups when list is empty.

---

## 4. Page Patterns

### 4.1 Layout shell

```
┌────────────┬─────────────────────────────────────────────────────────┐
│            │  Top bar:                                                │
│            │  ─────────────────────────────────────────────────────── │
│  Sidebar   │  breadcrumb / title …………………… ⌘K  theme-toggle  avatar │
│  56px      │                                                          │
│  collapsed │                                                          │
│  240px     │                  Main content                            │
│  expanded  │                  (max-width 1180px, centred above 1280)  │
│            │                                                          │
│            │                                                          │
└────────────┴─────────────────────────────────────────────────────────┘
```

Sidebar is collapsible. Collapsed mode shows icons only with tooltips.
Persists to `localStorage`.

### 4.2 Sidebar contents

```
●  Plexus          v1.0.0
   team agent config

┌ Workspace ─────────────┐
│ ▣ Dashboard            │
│ ▢ MCP Servers          │
│ ▢ Skills               │
│ ▢ Mirror               │
└────────────────────────┘

┌ Configuration ─────────┐
│ ▢ Backups              │
│ ▢ Team       [1.1 beta]│
│ ▢ Settings             │
└────────────────────────┘

╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴
4 agents synced  ●           ← footer status pill
last: 2 min ago
```

### 4.3 Dashboard composition

1. **Hero strip** (top): page title "Dashboard", subtitle, primary CTA
   (`Sync All Agents`) on the right.
2. **Status pill row** (under hero): a single line summarising
   "**4 agents synced** · 12 MCPs · 8 skills · last sync 2 min ago".
3. **Import banner** (only when candidates exist): coral accent stripe.
4. **Detected Agents** section: 2-column responsive grid of
   `AgentCard`s.
5. **Quick stats** section: 2-column stat cards for MCPs and Skills,
   each click-through.
6. **Activity** section (NEW in 1.0): the last 10 sync / restore events
   in a compact timeline. Reuses backup snapshots metadata.

### 4.4 MCP / Skills page composition

- Tabs at top: `All` / `Team` / `Personal` / `Native-only` / `Divergent`.
- Search box + per-agent filter chips.
- Table with sticky header. Per-row checkboxes per agent.
- Right-side sheet opens on row click for inspector + diff viewer.

### 4.5 Inspector (per-agent page)

- Top: agent name + breadcrumb back to Dashboard, sync status pill.
- Tabs: `MCP File` / `Instruction Files` / `Skills`.
- Each tab uses an `EntryRow`-style table with view/edit affordances.

### 4.6 Backups page

- Hero with `Snapshot now` ghost button (manual trigger).
- Timeline list of the 20 most recent snapshots, each row expandable.
- Restore action behind a destructive confirm dialog.

---

## 5. Voice & Microcopy

- Sentence case everywhere. No SHOUTING.
- Empty states say "Nothing here yet." not "No data found."
- Error toasts say what failed and what to do, e.g. *"Couldn't write to
  ~/.claude.json — agent may be locking the file. Retry, or open Claude
  Code → quit → retry."*
- Avoid "users", "the user". Speak directly: "you have 3 unsynced MCPs."

---

## 6. Accessibility

- All interactive elements keyboard-reachable. `:focus-visible` ring
  uses `--plexus-accent` at 60% alpha, 2px offset.
- Colour contrast ≥ 4.5:1 for body text (verified for both themes).
- All status uses both colour *and* a label / dot — never colour only.
- `prefers-reduced-motion` disables non-essential transitions.
- Modal focus trap via Radix.

---

## 7. Mockup Coverage Plan

We produce static HTML mockups (Tailwind via CDN, no build) for direct
review. Each lives at `docs/refactor/mockups/<page>.html`.

| File | Status |
|---|---|
| `index.html` | ✅ navigation hub for the gallery |
| `dashboard.html` | ✅ |
| `mcp-servers.html` | ✅ |
| `skills.html` | ✅ |
| `agent-detail.html` | ✅ |
| `backups.html` | ✅ (includes restore-confirm modal) |
| `settings.html` | ✅ |
| `empty-state.html` | ✅ (gallery: empty / loading / error / toast) |

Open `mockups/index.html` in a browser; every page links from the nav.
Each page exposes the dark↔light theme toggle in the top bar.

---

## 8. Open Questions for Architect Phase

1. Are we committing to **shadcn-cli** generation flow (copy primitives
   into our repo, no runtime dep), or treating shadcn as a vendored
   library?
2. Where does the theme switch live in code? (Suggest:
   `apps/web/components/theme-provider.tsx` + `next-themes`.)
3. Will font self-hosting via `next/font` constrain `npx plexus`
   packaging? (Validate during Architect spike on packaging.)
4. Do we adopt `tailwindcss/v4` (CSS-first config) or stay on v3?
   Recommend **v3** for shadcn parity in 2026-04.

---

*End of Design v1 draft.*
