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

**Mirrored 2026-08-03**: 127 pages under `docs/foundry-reference/mirror/workshop/`
and `mirror/app-building/`, via `node scripts/mirror-foundry-docs.mjs`. Grep those
before re-fetching anything.

W1–W7 and G1 were designed from *live* fetches summarised page by page, so the
mirror was also an audit of what was built from them. Two corrections came out of
it, both recorded below where they belong: the Tabs finding under W2, and the
self-embed attribution under G1. Everything else checked out verbatim — including
the non-blocking dispatch rule and the lazy-computation rule, which are quoted
exactly as written.

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

### W2 — events and layouts ✅ shipped

Layouts (pages, sections, tabs, overlays). The event model with Foundry's effect
groups and its **non-blocking dispatch semantics**. Variable recompute modes and
lazy evaluation.

**Exit:** a Button Group sets a variable, an Object Table row selection drives a
Metric Card. — *met; `low_stock_triage` does exactly this, covered by
`e2e/module.spec.ts` in a real browser.*

Notes worth keeping:

- The full 13-effect vocabulary is in the CHECK; the runtime implements the
  Layer, Layout, Variable and refresh groups. `open_module` / `open_object_view`
  belong to W3–W4 and are **reported on screen** when an author wires one, rather
  than silently doing nothing.
- The lazy rule copies Foundry's list exactly — pages, tabs, overlays. **Sections
  are not on it**, so a collapsed section still computes. Deliberate: an operator
  expanding a section expects data, not a spinner.
- Two widgets added (Button Group, Tabs) because an event model with nothing to
  press cannot fire. Six of ~forty; each consumed by the renderer in the same change.

**Correction, from the 2026-08-03 mirror.** Migration 313 deleted our `tabs`
widget on the grounds that *"Foundry's Tabs is a layout option on a section, not
a widget you place."* **Half of that is wrong: Foundry has both**, and they do
different jobs.

- **Tabs as a section layout option** — *"adds tabs to the top of a section and
  allows module builders to configure different configurations of widgets within
  each tab"*. This is what our containers now draw, and 313's *behaviour* was
  right.
- **The Tabs widget** — *"displays configurable tabs that trigger Workshop events
  to navigate throughout pages and overlays of a module"*, each tab carrying a
  label, an on-click event, an icon, a badge and conditional visibility.

So we were **missing a real widget** — ✅ **built** (migration 316). The runtime
had implemented `switch_page`, `switch_tab` and `open_overlay` since W2 with only
a Button Group able to trigger them.

**The part nobody would have invented correctly**, copied verbatim: *"the Tabs
widget does not hold its own selection state. Instead, selection state is derived
from events configured for the widget. Switch to tab and Switch to page events
that lead to **no layout state change** will be used to determine the selected
tab."* A tab reads as selected when pressing it would do nothing. Their two limits
come with it — most no-op events wins, earliest tab on a tie, and *"set variable
value events are not currently used to check for selected tab state"*.

Also copied: label, icon, badge, and conditional visibility gating a tab to
`disabled` or `hidden` on a boolean. **Not copied:** the four styling presets
(Outline / Block / Prominent / Grouped), active colour, tab height. Density and
radius are decided globally here, and per-widget styling is the thing that turns
a vocabulary into a theme editor. Direction (horizontal / vertical) *is* kept —
that one is structural.

**A deliberate divergence:** Foundry's badge takes *"text via a string variable or
a numeric value via a number variable"*. Ours also accepts an **object set** and
shows its count, because a count is the obvious badge and Foundry reaches it
through an `object_set_aggregation` variable — a definition kind we have not
built. This narrows back to string/numeric the day we do.

### W3 — actions and functions in widgets ✅ shipped

Bind the Action Registry to Button Group / Inline Action, and Logic Tools to
Function-defined variables. Every write still goes through `dispatchAction` and
the constraint gate — **a module is a new caller, never a new write path.**

**Exit:** a module can propose a typed action, and it lands in the same audit
trail as every other proposal. — *met; verified in the database, not just the UI:
`quantity_needed 156` (the tool's number), requestor `smoke@beacon.test`, one
`relationship_edge`.*

**Checked before designing, and it changed the design.** `workshop/actions-use`:
*"actions apply through **widget configuration**, not event effects."* So the
action lives on the Button Group's config, and W2's event vocabulary was left
alone. Parameters take their value from a **variable**, a **static** default or
**user input**, and each is **visible / hidden / disabled** — all three copied,
which is why `ActionFormModal` gained read-only fields.

Foundry's fourth source, the Object Table's *active object*, **is itself a
variable** in their model and in ours (a `row_select` event sets one from the
row). No fourth source to invent.

Two things the runtime supplies that no author should have to bind:

- **Ambient context** — `hotelId`, `requestorId`. A module knows where it runs.
  Without this the action fails validation on a field that is never rendered, so
  the error had nowhere to appear.
- **Binding validation** — a parameter name the action doesn't have, or a
  variable the module doesn't have, is reported on screen. Foundry validates
  this when the module is built; we validate it when it resolves.

**Deferred with a reason:** the *Inline Action Form* widget. It is the same
action machinery rendered in the page instead of a modal — presentation, not
capability. It gets built when someone wants a form that is always open.

### W4 — the portal becomes real ✅ shipped

Promotion flow, required metadata, collections and tags **as data**, version
pinning, un-promotion. `ApplicationsPage` keeps its hardcoded built-ins *and*
lists promoted modules under a "Built here" section.

**Exit:** a built module appears in the portal for the roles it is granted to.
— *met; `low_stock_triage` is published to the Inventory collection, and the e2e
publishes, filters by tag, and unpublishes through the real UI.*

**Promotion is its own resource**, per `app-building/curating-apps` — it points
at the module and pins the version the portal serves, so *"you can change the
resource that a promotion references to release new applications in a controlled
manner"*. Un-promoting deletes the promotion, never the module; the migration
asserts exactly that.

Required to promote: **name, icon, owner, collection**. Optional: tags,
description. Collections section the portal; tags filter the cards — different
jobs, kept apart as Foundry keeps them. A collection with nothing the viewer can
reach produces no rows, which is their *"only appear if they contain promoted
apps accessible to the user"* enforced in SQL rather than as an empty heading.

**Deliberate divergence:** the thumbnail is nullable. Foundry requires one; we
have no upload surface for app art, and a required column nobody can populate is
a promotion nobody can make. The card falls back to the icon, and the column
becomes `NOT NULL` the day an upload surface exists.

A card whose module has moved past the published version says so. A promotion is
a release, and a stale one is a decision nobody has made yet.

### W5 — the compounding phase, and the actual point ✅ shipped

Promote a module **across properties**. An org-scoped module installs at each
hotel; a hotel-scoped one stays local. Hotel overrides org, as everywhere else in
this system.

**Exit:** a workflow authored at Valinor runs at Rivendell without being rebuilt
— and the org can see which properties have adopted it. — *met; `morning_par_check`
is authored at Valinor and installed at Rivendell, and the adoption panel counts
it.*

**Foundry's installation model** (`marketplace/installations`): an installation
is a deployed instance that **tracks a version**, and newer ones *"surface as new
versions available for upgrade"*. **Locking** is the divergence rule — locked
projects can't be edited and *"edits to installed content will be overwritten
when a new product version is applied"*; unlocking lets you *"fork the content
you installed"*.

Ours reads the same and is structural rather than advisory:

| | |
|---|---|
| `forked_module_id IS NULL` | **locked** — runs the source at its pinned version, cannot drift, can be upgraded |
| `forked_module_id` set | **forked** — owns a copy, may be edited, receives no upgrades |

**One place we deliberately improve on the description rather than copy it:**
nothing is silently overwritten. An upgrade re-points the pin explicitly, and a
fork is an act that costs you upgrades. Foundry warns; we make the two states
different objects so the warning can't be ignored.

Forking remaps ids — variables, layouts, widgets, **and the variable ids inside
event configs**. A fork whose buttons still set the source module's variables
would render perfectly and drive the wrong screen; migration 311 asserts against
exactly that.

**Two scope findings, both real:**

- `hotels` is protected by `id = auth_hotel_id()` — *nobody* can read a sibling
  property's row. An org-wide adoption view is impossible under invoker rights,
  so `get_module_adoption` follows `get_chain_overview`: SECURITY DEFINER, an
  owner/admin gate inside the function, org-scoped (migration 312). The panel had
  been rendering one property in a two-property org — a wrong answer that read
  like a real one.
- `hotel_is_in_user_scope()` returns true for **every** hotel in the org once
  `auth_org_role()` is set. So an org-level user could see a hotel-scoped module
  either way, and a browser test would prove nothing. The scope rule is proved in
  `rls_contracts.sql` **C28** under a hotel-scoped role instead: invisible at
  hotel B, visible after B installs it, and still invisible to a third property.

### W6 — the builder ✅ shipped

W1–W5 shipped the model, the runtime, the portal and cross-property adoption.
**A module is still composed by writing SQL.** That is the honest limit of the
arc: every application in the system was authored by a developer with database
access, which is the thing this arc exists to stop.

#### Foundry's builder, by its own names

From `workshop/getting-started` and `workshop/module-interface`:

| region | what it does |
|---|---|
| **Left workspace navigation panel** | *Projects & Files* → **New › Workshop module** |
| **Canvas** | the module layout, centre |
| **Configuration panel** | right side, appears when a widget is selected |
| **Top bar** | resource name and publishing controls |
| **Section toolbar** | layout options, e.g. **Add — Right** |
| **Variables menu** | left sidebar; each variable has a **Settings tab** |

A widget arrives via **Add widget** → a widget-selector popup → configuration on
the right. Sections carry the layout: column width in absolute pixels, plus
**Section Header** and **Collapsible** toggles.

**This is a CRUD surface over tables we already have.** The config panel edits
`module_widgets.config`; the Variables menu edits `module_variables`; the canvas
is `ModuleRenderer` with selection affordances. No new vocabulary, no new write
path — admins already hold `FOR ALL` policies on all five tables.

#### Two model corrections the builder forces

Reading `concepts-layouts` *after* building W2 surfaced both. Recording them
rather than quietly building around them:

**1. There is no way to put two widgets side by side.** Foundry's layout types
are pages, sections, tabs, **rows**, **columns**, flow, toolbar, loop, overlays.
Ours are `page | section | tab | overlay`. Arrangement lives in rows and columns,
and without them every widget in a module stacks vertically forever. A builder
whose only layout act is "append to the bottom" is not a builder.

→ **Add `row` and `column` to the CHECK, consumed by the builder in the same
change.** `flow`, `toolbar` and `loop` stay out until asked for — `loop` in
particular means embedded modules, which is its own phase.

**2. Our `tabs` widget should not exist.** Foundry's Tabs is a *layout option on
a section* — *"adds tabs to the top of a section"* — not a widget you place. W2
built tab layouts (correct) plus a `tabs` widget to draw the bar (ours). A
section with tab children should render its own tab bar.

→ **Sections render their own tab bar; the `tabs` widget is deprecated.** It was
invented shape with no citation, which the stage directive says not to keep.

#### What W6 builds

- **Route** `/modules/:apiName/edit`, admin/owner only, mirroring the three
  regions above. `ModuleRenderer` gains a `selection` prop rather than being
  forked — one renderer, or the builder and the runtime will drift.
- **Widget picker** driven by a registry keyed on widget type, so a new widget
  type means one registry entry, not edits in five places. Each entry declares
  its config form fields and whether it needs a variable binding — the same
  `needs_binding` rule the CHECK already enforces.
- **Variable editor** per definition kind: `static` (a value), `object_set_definition`
  (pick a saved set), `function` (pick a Logic Tool, then bind its args with the
  W3 grammar). The kinds not yet implemented stay listed and disabled, with the
  phase that owns them named.
- **Event editor** — trigger, then ordered effects, reusing `effectsFor`'s shape.
  The dispatch-order-not-completion-order rule is shown in the UI, because an
  author who does not know it will write the bug it describes.
- **Layout tree** with add/remove/reorder and row/column nesting. Reordering is
  `position` arithmetic — up/down buttons before drag-and-drop, which is
  presentation over the same writes.
- **Publishing** — the top bar bumps `modules.version`. Promotions pin a version
  (W4) and installations pin one (W5), so both already show "vN available" the
  moment a builder publishes. **The builder is the thing that finally makes those
  pins move.**

#### Deliberately not in W6

Pixel-precise column widths, background colours, border styles, header
formatting (Block/Contained/Floating), conditional section visibility, drop
zones. All real Foundry features, all presentation, none of which changes what a
module can *do*. Density and 4px radii are already decided globally in this
codebase and should not become per-section settings.

**Exit:** an admin creates a module from nothing in the UI — variables, layout,
widgets, an action button, an event — publishes it, and it appears in the portal
for another property to install. **Zero SQL.** — *met; `e2e/module-builder.spec.ts`
adds a variable, adds a text widget, interpolates the variable, watches the canvas
update, publishes, and reads the result at the operator's own route.*

**One defect, and it had been there since W1.** `modules.organization_id` is NOT
NULL with no default while the admin policy requires
`organization_id IS NOT DISTINCT FROM auth_org_id()` — so **a module has never
been creatable from a browser.** Nobody hit it because every module in the system
was made in SQL, which is the exact gap this phase closes. Fixed in migration 314,
which also asserts the same default across every tenant-scoped table the builder
writes to, so there is no fourth discovery.

**The pattern worth naming** (third time in this arc, after 310 and 312): a
scope-aware RLS policy on a NOT NULL tenant column is only satisfiable if that
column carries a matching DEFAULT. Writing the policy is half the work; the other
half is making a legitimate caller able to pass it.

---

## 3a. The NL case, argued properly

W6 is Foundry's shape and has a citation. **NL authoring is ours, and by this
repo's own rule invented shape needs a consumer today.** So it has to be argued,
not assumed — `AUTHORING-STRATEGY.md` asserts *"NL is the builder"* and
`STUDIO-AUTHORING-PLAN.md` asserts *"copy what Foundry IS"*, and on this surface
those two disagree.

#### What Foundry actually does here

**AIP Assist does not author.** It is documentation Q&A and navigation; its one
documented suggested action is directing users to the developer forum. The three
AIP widgets — Analyst, Chatbot, Generated Content — put AI **inside the built
app**, not into the building of it. There is no NL app-generation in Foundry to
copy.

#### Why that is not the end of the argument

Foundry's absence here is explained by its distribution model, not by the idea
being wrong. Foundry ships with forward-deployed engineers who build Workshop
apps for customers. **Our operators have nobody.** An F&B manager who wants a
morning par-check screen will not open a widget picker, and there is no
implementation team to open it for them. That is a real difference in who is
holding the mouse, and it is the same reason `project_hospitality_niche` records
NL-native authoring as the leapfrog rather than the imitation.

Three things make it tractable here specifically, and they are all already built:

1. **The target grammar is tiny and validated.** Six widget types, six variable
   types, thirteen effects, an action registry with typed descriptors. An LLM
   emitting into that can be checked *deterministically before any write* —
   unlike NL → code, where the only check is running it.
2. **We already do exactly this pattern.** Constraints are NL categorised into
   typed buckets; principles are NL folded into agent prompts; authored tools and
   agents are NL-shaped rows behind a grammar check. NL → typed rows is the
   house style, not a new bet.
3. **W3 proved the failure mode is catchable.** A binding naming `quantity`
   instead of `quantityNeeded` resolved to a real number and went nowhere — the
   exact class of mistake an LLM makes. It is now reported against the
   descriptor. **That report is the precondition for trusting a generator**, and
   it exists because a human made the mistake first.

#### Why it must come second

- **An NL mistake needs somewhere to be corrected.** Without W6, the only repair
  for a wrong generated module is SQL — which is the situation we are in now, and
  the reason the arc is incomplete. NL-first without an editor is a trap.
- **The builder is the audit surface.** A generated module the operator cannot
  inspect field-by-field is a proposal without a trace, which this codebase
  already calls a defect.

#### W7 ✅ shipped — it proposes, it does not write

Not "describe an app and it appears." **The generator emits rows, and the rows
open in the builder as a draft for approval** — the same Proposal pattern
everything else here uses. `status = 'draft'` already exists on `modules`, so the
generator has a landing state and no new column is needed.

That satisfies the AIP-native test — a tunable capability over config-as-data,
loop-closing, with a human gate — while keeping the invented shape honest: **the
consumer of NL authoring is the builder, and the builder has to exist first.**

An eval suite is not optional here — **29 cases** in
`packages/reality-graph/src/authoring/moduleSpec.eval.ts`, graded on structure
rather than prose, and **no model runs in them**. Six specs that must be
accepted, ten that must be refused with a code a caller can branch on, the
parser, and the row conversion. *The refusals are the point:* a generator trusted
because nothing checks it is the failure this phase was designed around.

**What shipped:** `authoring/moduleSpec.ts` holds the grammar, `validateModuleSpec`,
`parseModuleSpec` and `moduleSpecToRows`. The `module-author` edge function is a
**thin adapter that only holds the API key** — the lesson from #340, where a
guard inlined into an edge function was eval-unreachable and drifted. Validation
is not the security boundary either way: the `module_*` CHECK constraints refuse
malformed rows whoever sends them, so it lives where one implementation serves
the dialog, the tests and any future caller.

**Two things the first live generation taught, both fixed:**

- The prompt never named the per-item JSON keys, so the model answered entirely
  in **snake_case** — every field read `undefined` and all ten elements were
  refused. The validator did its job; the prompt hadn't done its own. It now
  states the exact shape, *and* the parser normalises snake_case, because models
  send it perhaps a third of the time regardless of what the prompt says.
  `config` keys are left alone — those belong to the application, not to us.
- One model call, no retry loop. A retry on a paid call is how a bad prompt
  becomes a bill, and the operator can simply ask again.

**Verified live** with a real request — *"a morning screen for the F&B manager:
what is below par right now, how many lines that is, and a way to request a
restock for the one they pick"* — which produced a clean three-widget screen with
a row-selection event in 5.5s. And covered by `e2e/module-author.spec.ts`, which
**intercepts the model call** so the test is free and deterministic: what it
proves is everything after the model — parse, validate, resolve names into ids,
land in the builder as a draft.

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
