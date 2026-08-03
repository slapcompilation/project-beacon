# AIP UX restructure — the visual-parity roadmap

> **RECORD — closed — Phases 0–3 delivered.** Kept for the reasoning; see
> [`docs/README.md`](./README.md) for what is live.

Status: **Phase 0 (in progress, 2026-07)**. Goal: make Beacon *look almost
exactly like* Palantir Foundry / AIP.

Reference source: Foundry docs — **orientation & navigation**
(`palantir.com/docs/foundry/getting-started/orientation-and-nav/`) and the
surrounding getting-started/AIP pages. When screenshots are added to
`docs/aip-reference/`, this doc's parity board points at them per surface.

## Two axes — keep them separate

This project already has an IA plan. This doc does **not** redo it.

| Axis | Owns | Doc |
|---|---|---|
| **A — Structure / IA** | which surfaces exist and what each reduces to (Object View / Lens / Action / Decisions / Insight / Studio) | [`AIP-RESTRUCTURE.md`](./AIP-RESTRUCTURE.md) (agreed) |
| **B — Visual parity** | making each surface's chrome, layout, density & motion match Foundry screen-for-screen | **this doc** |

Axis B consumes Axis A's target surfaces; it doesn't relitigate them.

## Ordering principle — leverage, not screen-by-screen

One thing done right that many screens inherit, before per-screen work:

```
Phase 0  tokens + parity board      (grounding — nothing ships without it)
Phase 1  the shell / global nav     (the frame every screen sits in)
Phase 2  the Object View            (the ontology primitive — highest leverage)
Phase 3  the Studio builders        (AIP's most distinctive surfaces)
Phase 4  Decisions & Insights       (operator surfaces)
Phase 5  interaction polish         (motion, empty states, slide-overs)
```

Rationale: Foundry is ontology-centric and chrome-heavy. The **shell** and the
**Object View** are the two patterns that repeat on nearly every screen — get
them pixel-right and most of the app matches AIP for free. Per-screen polish is
last and cheap once the primitives are locked.

## The parity gate (the rubric every surface passes)

A surface is "done" only when, placed **side-by-side with its Foundry
reference**, it passes all six:

1. **Regions** — same layout regions in the same positions (rails, header, body, right-rail).
2. **Spacing** — same density + 4px grid; no looser.
3. **Type** — scale, weight, mono for identifiers, tabular numerals for numbers.
4. **Color** — surface ramp, intent colors, borders match the token layer.
5. **Chrome** — headers, breadcrumbs, tabs, chips, buttons, star/favorite affordance.
6. **States** — loading, empty (explains the cycle), error, hover, active, selected.

No surface ships on "close enough." The board records pass/fail per surface.

---

# Phase 0 — reference + tokens (this phase)

## 0.1 Design-token baseline — *already AIP-aligned*

`apps/web/src/styles/globals.css` is a Blueprint/Palantir-derived HSL token
system and is the **single source of truth** — every later phase references
tokens, never raw hex. What's already right (keep):

- **Surface ramp** `--surface-0..3` (page → chrome → hover → pressed) — matches
  Foundry's layered panels.
- **Intents** primary `blue3-deep`, destructive `red3-deep`, success
  `green3-deep`, warning `orange3-deep` — the Blueprint palette AIP uses.
- **Radius** `0.25rem` (4px), compact density, tabular numerals — Palantir house style.
- **Dark mode** with a deepened page + opened surface ramp for clear hierarchy.

**Calibration:** reference images landed 2026-07-06 (42 captures, indexed in
[`aip-reference/README.md`](./aip-reference/README.md)) — dark-mode Foundry
throughout. Sample page/panel greys + accent blue from `Control Tower.png` and
the Use LLM debugger captures and nudge the ramp to match; don't hand-invent hex.

**Gap tokens to add (structural, not colours):**
- a `--rail` width + section spacing scale for the 5-section sidebar (0.2),
- a `favorite/star` affordance treatment,
- `--elevation` popover vs card separation used by Quicksearch + slide-overs.

## 0.2 Foundry → Beacon parity board

Foundry's global nav (from the orientation docs) is a **left sidebar with five
stacked sections + a top bar**, plus a customizable **Home**, a two-mode
**Quicksearch**, an **Applications portal**, a cross-cutting **star/favorite**
system, and uniform **Object Views**. Mapping to Beacon's target surfaces
(Axis A) + current state:

| Foundry surface | Beacon target | Current state | Phase | Ref |
|---|---|---|---|---|
| Left sidebar — **Home / Quicksearch / Notifications** (top controls) | Global rail top controls | Dock is 6 modules (`CommandDock`); no unified quicksearch top-control | 1 | [sidebar](<./aip-reference/shell-sidebar-expanded-marketplace-install.png>) |
| **Recent & Files** section | Recents + Object landing | partial (no recents rail) | 1 | — |
| **Favorited apps / files** (star system) | Star/favorite across objects, lenses, apps | missing | 1 (+ cross-cutting) | — |
| **Bottom tools** — AIP Assist, account, workspace switcher | Copilot entry + account + scope switcher | Copilot is Ctrl+J (done); scope switcher exists; not in one rail foot | 1 | [copilot prompts](<./aip-reference/Copilot - Supply Chain (demo name) Co-Pilot actionable prompts.png>) |
| **Home / landing** (customizable, role-specific) | Home (scope-aware) | exists (`/briefing`) — reframe to Foundry home anatomy | 1 | [control tower](<./aip-reference/Control Tower.png>) |
| **Quicksearch** (jump-to + full-results modes) | Command palette → two-mode search | palette exists; single-mode | 1 | — |
| **Applications portal** (platform + custom apps, usage suggestions) | Studio/apps index | `ApplicationsPage` exists; reshape to portal grid | 3 | — |
| **Object View** (star + metadata + sidebar shortcuts) | canonical Object View component | partial per-type pages | 2 | [airport OV](<./aip-reference/application-sidebar-object-view.png>) · [editor](<./aip-reference/add-application-sidebar-groups.png>) · [rail config](<./aip-reference/configuring-applications-sidebar_applications-sidebar-config.png>) — spec in §0.5 |
| **AIP Logic** (block canvas + debugger) | Logic Tools studio | index only, no canvas/debugger | 3 | [debugger](<./aip-reference/Use LLM - Debugger with chain of thought reasoning and function output.png>) · [blocks](<./aip-reference/Use LLM - Tools, Provide Input data and Output.png>) |
| **AIP Agent Studio** | Agents studio | descriptor view (now catalog-driven) | 3 | [widget setup](<./aip-reference/Copilot - Control tower and Widget setup (Tool name, description and Function RID).png>) |
| **AIP Evals** (cases + version diff + cohorts) | Evals surface | data model shipped (`runVersionDiff`, `evaluatePromotion`); no UI diff | 3 | [eval dashboard](<./aip-reference/Evaluation dashboard - Build Eval + Configure evaluation buttons and model search.png>) |
| **Modeling / model lifecycle** | Modeling Objectives | catalog-driven index + detail | 3 | [models](<./aip-reference/Models.png>) · [deployment](<./aip-reference/Inside the deployment model - Logs&Metrics screen.png>) |
| **Ontology manager** | Ontology | scan/gap surface (portfolio-aware) | 2–3 | — |

> Refs landed 2026-07-06 — full index grouped by surface in
> [`aip-reference/README.md`](./aip-reference/README.md). Rows marked — still
> need captures (shell/sidebar, Quicksearch, portal, Object View, Ontology
> manager); §0.4 covers the sidebar from the orientation docs meanwhile.

## 0.3 Phase 0 exit criteria

- [x] Roadmap + parity rubric written (this doc).
- [x] Token baseline audited; confirmed AIP-aligned; gap tokens listed.
- [x] Foundry→Beacon parity board drafted from the orientation/nav docs.
- [x] Reference received (Foundry orientation screenshots + getting-started text) → the sidebar spec below (0.4) is transcribed from them.
- [x] 42 reference captures landed in `aip-reference/` (2026-07-06) — indexed by surface; parity board now carries a Ref column.
- [ ] Gap tokens (0.1) added as the sidebar component (Phase 1) is built.

## 0.4 Sidebar spec — image-grounded (the Phase 1 build target)

Foundry's expanded sidebar is a **dark, ~240px, vertically-stacked, 5-section**
rail. Top: the product orb (left) + a collapse toggle (right, `Cmd/Ctrl+O`).
Row height ~36–40px (comfortable, not ultra-dense); outline icons ~16–18px;
white item text; small-caps letter-spaced grey section headers, each with a
right-aligned muted **View all**; right-aligned muted keyboard-shortcut hints
(`⌘J`, `⌘⇧U`). Active item = a lighter full-width band. Collapsed = a ~48px
icon-only rail.

| # | Section | Foundry items | Beacon mapping |
|---|---|---|---|
| 1 | Top controls | Home · Search… (`⌘J`) · Notifications (bell + badge) · What's New (gift + dot) | Home · Search (`⌘J`, the copilot palette) · Notifications · What's New |
| 2 | Recent & files | Recent · Files · Applications (portal) | Recent · Objects (graph) · Applications (Studio portal) |
| 3 | Favorited **Applications** (`APPLICATIONS · View all`) | pinned apps w/ colour icon + name + optional `Beta` | Beacon "apps": Decisions · Insights · Studio (pin/star-able) |
| 4 | Favorited **Files** (`FILES`) | starred files/objects w/ icon + name | starred objects (variants/hotels) + saved lenses |
| 5 | Bottom tools | AIP Assist (`⌘⇧U`) · Support · Account (avatar) | Copilot (`⌘⇧U`) · Support · Account (avatar w/ initials) |

Star/favorite is cross-cutting (apps, files, objects; a "Manage favorites"
modal with Apps/Files columns + activity suggestions). Empty favorites →
"Your favorited apps will appear here." Object views carry a star next to the
title + a breadcrumb header (trail → **bold current** ★, then a chrome row:
`File ▾ · Help ▾ · branch chip · version chip · catalog chip`).

> Current Beacon nav is a **bottom horizontal dock** (`CommandDock`) — Phase 1
> flips it to this left sidebar. Build it presentational + previewable first,
> calibrate against the screenshots, then wire it in and retire the dock.

## 0.5 Object View spec — image-grounded (the Phase 2 build target)

From `aip-reference/application-sidebar-object-view.png` + the Foundry
"Configure the applications sidebar" docs. Anatomy, top to bottom:

- **Header row** — type icon (colored square) + object title + type label
  beneath; right side: refresh, comment, `Open in ▾ · Actions ▾ · More ▾`.
- **Tab row** — per-type tabs (e.g. Airport / Passengers / Flights / Security
  Overview). Tabs are builder-configured per object type.
- **Property highlight cards** — a few key properties promoted to large
  value-over-label cards (Country, City, Lat, Lng).
- **Properties panel** — two-column key/value; values can render as chips or
  links to other objects; inline edit pencil.
- **Linked Objects table** — search, filter, column config, checkbox rows;
  one table per link type.
- **Right rail: the applications sidebar** — opt-in per Object View, hidden
  until a non-empty group is published. Groups of cards, each embedding an
  object-scoped app (Workshop / Quiver / Slate / Action types) or a
  parameterized URL (`{{objectId}}`, `{{objectTypeId}}`; custom params pass
  current-object properties into the embedded module). Per-card config:
  resource, title/icon override, thumbnail, Card vs Compact. Per-group config:
  title, reorder, remove, **visibility by user profile**. Links open a new
  tab; embedded apps open in-context. Cards stay visible without permission —
  set permissions on each embedded app.
- **The view itself is authored in-place** — an Object View editor (Tabs /
  Sidebar / Settings) with Save & Publish, History, Preview. Config-as-data,
  no deploy (AUTHORING-STRATEGY rung material).

**Beacon mapping:** our Object View right rail currently carries the audit log
(CLAUDE.md). Foundry's carries related apps + pinned actions. Target: the rail
holds pinned Actions + related lenses/reports (our "applications") in groups
with role-scoped visibility, and the audit log as the permanent last group.
Per-profile visibility maps onto our role hierarchy; `{{objectId}}` params map
onto the selection-aware copilot pattern (the node id flows into every tool).

---

# Later phases (summary — expanded when we reach them)

**Phase 1 — shell / global nav.** Rebuild the global rail to Foundry's
five-section pattern (top controls incl. Quicksearch → Recent & Files →
Favorited apps → Favorited files → bottom tools), the two-mode Quicksearch, the
star/favorite system, and the scope-aware Home. Lands with `AIP-RESTRUCTURE.md`'s
dock → Home/Decisions/Insights/Studio reduction so IA + chrome arrive together.

**Phase 2 — the Object View.** One canonical component (header → metric strip →
action bar → body sections → right-rail audit) every node type renders through,
with the star + metadata + sidebar-shortcut anatomy. Highest leverage.

**Phase 3 — Studio builders.** Logic (block canvas + numbered debugger trace),
Agent Studio (config · preview · trace), Evals (cases · version diff · cohorts),
Ontology manager, Modeling lifecycle. The numbered trace (09, 10, 11…) is a
shared signature component.

**Phase 4 — Decisions & Insights.** Confidence-coded review queue, Cases
envelope, read-only reports.

**Phase 5 — interaction polish.** Slide-overs, motion, keyboard, empty-states
that explain the cycle, the copilot slide-over anatomy.

---

# Parity snapshot — Foundry ↔ Beacon (2026-07)

Re-read of the Foundry orientation/nav docs vs Beacon's current shell (left
sidebar + breadcrumb top bar + favorites + Recent panel + IBM Plex Sans).
✅ match · 🟡 partial · ❌ missing.

| Foundry surface | Beacon now | Status |
|---|---|---|
| Sidebar §1 — Home · Search (⌘J) · Notifications · What's New | Same 4, same order + shortcut | ✅ (badge is a placeholder 🟡; What's New → /notifications 🟡) |
| Sidebar §2 — Recent · Files · Applications | Recent (real popover) · **Objects** (→/graph) · Applications (→portal) | ✅ ("Files"→"Objects" rename; fine) |
| Sidebar §3 — Favorited **Applications** | Fixed core apps: Decisions · Insights · Studio | 🟡 (ours is the core-app set, not star-driven favorites) |
| Sidebar §4 — Favorited **Files** | Live from the star store; empty state otherwise | ✅ |
| Sidebar §5 — AIP Assist (⌘⇧U) · Support · Account | Copilot (⌘⇧U) · Support · Account avatar | ✅ |
| Collapse toggle (⌘O) + collapsed rail | Toggle + icon rail + hover-label tooltips + Recent popover | ✅ (⌘O binding not wired 🟡) |
| Home / landing | `/briefing`, scope-aware | ✅ |
| **Quicksearch — two modes** (jump-to / full-results) | Single-mode command bar (⌘J) | 🟡 |
| Notifications panel (chronological, badge, inline actions) | `NotificationsPanel` + live badge (top bar) | ✅ |
| Applications portal (suggested/promoted) | `/applications` index | 🟡 (grid fidelity + promotion) |
| **Favorites/star** (star toggle, Manage Favorites modal, promoted apps) | Star store + `FavoriteStar` (on Variant) → sidebar Files | 🟡 (localStorage; only Variant has the star; no Manage-Favorites modal / promoted-apps) |
| Account menu (id, groups, settings, sign-out) | `UserMenu` (email, role, settings, sign-out) | ✅ |
| Top bar | Location breadcrumb + scope + AIP strip + notif + account | ✅ (Foundry's is thinner; ours adds scope + AIP — Beacon-specific, fine) |
| Product font | IBM Plex Sans (Inter tried) | ✅ (exact Foundry font may be proprietary) |
| **Object-view chrome** (breadcrumb trail + File/Help/version/catalog row + title star) | Object pages have title + star (Variant); no chrome row | 🟡 → Phase 2 |

**Net:** the shell structure now closely tracks Foundry. Remaining gaps, by
leverage: (1) star on more object types + a Manage-Favorites modal; (2) live
notification badge on the sidebar; (3) Quicksearch two-mode; (4) the object-view
chrome row (Phase 2); (5) ⌘O collapse binding + promoted-apps. None are
structural — they're fills within the established frame.
