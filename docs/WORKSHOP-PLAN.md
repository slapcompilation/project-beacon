# Application building — adopting Workshop

**Decision, 2026-08-02:** build it. Not as a convenience for one operator
assembling one screen — that framing was wrong and is why the earlier audit
nearly recorded it as a non-goal. The argument is **compounding**:

> A workflow built once at one property is promoted across twelve. Knowledge
> accumulates as operational workflows scale out, instead of being re-coded per
> surface.

That is the multi-echelon thesis this system already rests on (`Organization →
Hotel → Zone`, chain-wide agents, portfolio benchmarks). Workshop is the surface
where it compounds, and today every surface in Beacon is a React file a developer
wrote — which cannot compound at all.

## Source

Fetched live 2026-08-02. **None of `app-building/` or `workshop/` is in the local
mirror** — 139 Workshop URLs sit in `all-foundry-urls.txt` with zero mirrored, so
the decomposition below is transcribed from the source pages and cited. A proper
crawl into `docs/foundry-reference/mirror/workshop/` is the first follow-up;
until then treat this file as the reference and re-check the URL when precision
matters.

- `workshop/concepts-variables/` · `concepts-widgets/` · `concepts-events/`
- `app-building/overview/` · `app-building/curating-apps/`

---

## 1. The decomposition to copy

Per the stage directive: adopt the shape, the names and the limits before
simplifying.

### Module

The unit of an application. **Reusable, self-contained, versioned, published.**
Variables are *module-scoped*. Modules can be embedded in other modules.

### Variables — the state model

Twelve types, exactly as named:

`Array` · `Boolean` · `Date` · `GeoPoint` · `GeoShape` · `Numeric` ·
**`Object set`** · **`Object set filter`** · `String` · `Struct` · `Timestamp` ·
**`Time series set`**

Six ways a variable gets its value: **Static**, **Function**, **Object set
aggregation**, **Object property**, **Object set definition**, **Variable
transformation**.

Two behaviours worth copying exactly because they are performance contracts, not
details:

- **Lazy** — *"variables used in non-visible pages, tabs, overlays, or non-visible
  pages of a looped layout will not be computed until they are shown."*
- **Recompute** — automatic (default), event-triggered, or on-load + event-triggered.

Three of the twelve types map onto primitives we already own: `Object set` →
Tier 1 object sets, `Object set filter` → `SetFilter`, `Time series set` → the
time-series properties registered in 276/292.

### Widgets

Grouped as Foundry groups them:

| group | named types |
|---|---|
| **Core display** | Object Table, Object List, Object View, Property List, Links, Object Set Title |
| **Visualisation** | Chart XY, Vega Chart, Map, Gantt, Pie, Stepper, Markdown, Metric Card, Pivot Table, Timeline, Media Preview, PDF Viewer, Time Series Analysis, Data Freshness, Edit History, Action Log Timeline, … |
| **Filtering** | Filter List, Object Dropdown, String Selector, Date and Time Picker, Text Input, Numeric Input, Exploration Filter Pills, Exploration Search Bar, User Select |
| **Event-trigger / navigational** | Button Group, Media Uploader, Comments, Tabs, Inline Action, Audio Recorder |
| **AIP** | AIP Analyst, AIP Chatbot, AIP Generated Content |
| **Embed** | Iframe |

### Events

Triggered by widget interaction (Button Group, Object Table row selection, String
Dropdown, Tabs). Effects, by Foundry's own grouping:

- **Layer** — open/close overlay
- **Layout** — switch page, expand/collapse/toggle section, switch tab
- **Variable** — reset, recompute, set value, **stream LLM response into variable**
- **Application** — open another module (with variable mapping), open object view
- **Other** — refresh module data, toggle theme

**Copy the concurrency rule verbatim, it is a footgun otherwise:** *"events do not
wait for the downstream computations of previous events to complete before
executing."* Sequential dispatch, not sequential completion.

### Curation — the Applications Portal

Builders **promote** an app; admins gate it. Metadata is required: name, icon,
description, owner, thumbnail. Organised by **collections** (sidebar sections) and
**tags** (filter labels on cards). Promotion also controls **which version is
publicly referenced**, and can be undone.

---

## 2. What we already have, and what is genuinely new

| Workshop needs | Beacon today |
|---|---|
| object sets | ✅ Tier 1 — named, stored, `selectObjectSet`, traversal capped at 3 |
| actions | ✅ Action Registry — typed `BeaconAction`s, audited, `open-form` / `apply-immediately` |
| functions | ✅ Logic Tools — dual-callable, `basis` + `confidence` |
| permissions | ✅ RLS, role hierarchy, per-app access levels |
| object views | ✅ generated from registration (G1–G3) |
| time series | ✅ four registered series |
| **module** | ❌ |
| **variables** | ❌ |
| **widgets** | ❌ |
| **layouts** | ❌ |
| **events** | ❌ |

**Every binding exists. The composition layer is the whole build.**

One consequence worth stating: our object views are *generated from
registration*, which is the part of Workshop that already pays for itself. A new
object type gets a page with nobody composing one. **Workshop does not replace
that** — generated views stay the default, and modules are for composed
workflows that span types.

---

## 3. Phases

Each phase must satisfy the governing rule: **authored as data, not code.** A
module that is a React file cannot be promoted, versioned, or scaled to twelve
properties — which is the entire reason for building this.

### W1 — the module spine

`modules`, `module_variables`, `module_widgets`, `module_layouts` as tables. A
renderer that reads them and draws. Variable types limited to the ones we can
already source: `Object set`, `Object set filter`, `String`, `Numeric`,
`Boolean`, `Date`. Widgets limited to **Object Table, Metric Card, Markdown,
Object Set Title** — enough for a real operational screen.

Scope columns from day one: `organization_id` + nullable `hotel_id`, because W5
depends on it and retrofitting tenancy is the migration this codebase has already
paid for twice.

**Exit:** an admin composes a module over an existing object set and it renders.

### W2 — events and layouts

Layouts (pages, sections, tabs, overlays). The event model with Foundry's effect
groups and its **non-blocking dispatch semantics**. Variable recompute modes and
lazy evaluation.

**Exit:** a Button Group sets a variable, an Object Table row selection drives a
Metric Card.

### W3 — actions and functions in widgets

Bind the Action Registry to Button Group / Inline Action, and Logic Tools to
Function-defined variables. Every write still goes through `dispatchAction` and
the constraint gate — **a module is a new caller, never a new write path.**

**Exit:** a module can propose a typed action, and it lands in the same audit
trail as every other proposal.

### W4 — the portal becomes real

Promotion flow, required metadata, collections and tags **as data**, version
pinning, un-promotion. `ApplicationsPage` stops listing hardcoded routes and
starts listing promoted modules alongside the built-in apps — Foundry's *basic*
vs *advanced* mode distinction.

**Exit:** a built module appears in the portal for the roles it is granted to.

### W5 — the compounding phase, and the actual point

Promote a module **across properties**. An org-scoped module installs at each
hotel; a hotel-scoped one stays local. Hotel overrides org, as everywhere else in
this system.

**Exit:** a workflow authored at Valinor runs at Rivendell without being rebuilt
— and the org can see which properties have adopted it.

---

## 4. What this does not include

- **Slate** — drag-drop with custom HTML/CSS/JS. Already a reasoned exclusion;
  Workshop's widget model covers the need without an escape hatch into arbitrary
  markup.
- **OSDK** — reasoned in CLAUDE.md; one shared TS package, no generated SDKs.
- **The full widget catalogue.** Foundry lists ~40. W1 ships four. The rest are
  demand-gated individually — a widget nobody has asked for is the same dead
  vocabulary this codebase has spent a week removing.

## 5. The risk to name up front

This is the largest surface in the map and the one most able to grow without
limit. Two guards, both borrowed from what already works here:

1. **Data, not code.** If a module cannot be exported as rows and installed
   elsewhere, it is not a module. `export_ontology_package` already sets the
   precedent — modules should travel the same way.
2. **A widget earns its place by being asked for.** The shape ratchet exists
   because unreachable capability accumulated silently; a widget catalogue is
   exactly where that would happen again.
