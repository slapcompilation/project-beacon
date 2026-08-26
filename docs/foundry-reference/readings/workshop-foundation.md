---
verify: strict
---

# Workshop, the foundation: modules, layout, widgets, variables, events

Workshop is the first of the eleven applications on Foundry's Home that we
do not have. It is the most load-bearing of them, because it is the one
that consumes everything already built — object types, object sets,
actions, functions, permissions — and turns it into something an operator
uses.

**What I read, counted rather than asserted.** The section holds **122
pages**, of which **62 are widget pages** — that is the catalogue, not the
foundation. This reading covers the seven that define the model, read
whole: `overview`, `getting-started`, `concepts-layouts`,
`concepts-widgets`, `concepts-variables`, `concepts-events`,
`concepts-permissions`. **Images: those seven reference 44 unique files;
I parsed 6** — `workshop/images/workshop_getting_started_step_6.png`,
`configure_new_page.png`, `layout_selector.png`, `widget_picker.png`,
`add_page.png`, `workshop_variables_panel.png`. The other 38 are on-screen
walkthrough steps and style-option strips (background colours, border
styles, padding, header formatting, the mobile and vertical-header
variants) that this arc does not build; they are named as unparsed here so
the debt is recorded rather than silent. The remaining 115 pages of the
section are unread, and each names its own future arc.

## 1. What a module is

> "**Workshop** enables application builders to create interactive and high-quality applications for operational users."

— `workshop/overview.md`

The three principles the page states, and the first is the whole reason
this arc comes first:

> "Workshop reduces the barrier to entry for application builders by using the Object layer as the primary building block. All data in a Workshop Application is read from the Object Data Layer, allowing application creators to take advantage of rich characteristics such as links between object types."

— `workshop/overview.md`

Writeback is Actions, logic is Functions, runtime values are derived
properties — all three of which we hold. The other two principles are a
unified design system, and interactivity: applications "aim to be as
user-friendly and high-quality as custom React applications".

A module is a **resource in a project**, created from the filesystem:

> "To create a new module, open **Projects & Files** from the left workspace navigation panel, then find your desired Project or folder. Once there, select **New > Workshop module** in the top right to create a new module within the current Project or folder. The new module will inherit the permission of the Project or folder in which it is created."

— `workshop/getting-started.md`

And its permission model is the ordinary resource one:

> "The ability to open or edit a Workshop module is derived from a user's permissions on the Workshop module. This means that a user must satisfy the [Organization](/docs/foundry/security/orgs-and-spaces/) and [Marking](/docs/foundry/security/markings/) requirements and also have a role on the module (directly, via a group, or a default role). By default, users need the Viewer role to open a Workshop module, and the Editor role to edit it."

— `workshop/concepts-permissions.md`

with the separation stated plainly — module access is not data access:

> "The data, actions, or functions used or contained in a Workshop module are permissioned separately from the Workshop module."

— `workshop/concepts-permissions.md`

## 2. Layout: header, pages, sections, overlays

> "Workshop **layouts** allow builders to configure how the user interface of a module is organized. The main layout components of a Workshop module (the header, pages, sections, and overlays) are described in detail in the sections below."

— `workshop/concepts-layouts.md`

**Header** — "a persistent toolbar for module-wide titles, tabs, and
buttons", horizontal at the top or vertical on the left, and the only
thing that survives a page switch: "Only the module header will persist
between pages to provide an overarching toolbar for a given module."

**Pages** — "Each page is a blank canvas on which a module builder can
configure a unique set of widgets to support the targeted workflow."

**Sections** — "the components of each page and overlay that allow module
builders to subdivide the user interface. Each section is configured to
contain one or more widgets, or a layout, which itself may contain one or
more sections." So sections nest, and the nesting is the layout tree.

The six section layouts are an enumeration, and the page prints it:
**Columns**, **Rows** (with an Enable-scrolling option), **Tabs**,
**Flow** ("Turns the current section in a vertically scrolling
container"), **Toolbar** ("optimized for smaller widgets like Button
Groups or Metric Cards"), and **Loop**. `workshop/images/layout_selector.png`
draws them as six labelled tiles under "Layout — Determines how components
will be arranged in this section", confirming the same six and their order.

**Overlays** — "may be used when certain sections should only appear when
contextually relevant in a workflow. Overlays will appear as a layer on
top of the selected page", of exactly two types: **drawers** (slide from
left or right, with a Size) and **modals** (centred, Size only).

**What the captures add that the prose does not.**
`workshop/images/configure_new_page.png`: a new page is initialised with
**two vertically divided sections**, each empty section offering
**`+ Add widget`** above **`Set layout`**, and a floating card at the
bottom reading "Try a layout template! Hover to preview layout"
(`workshop/images/configure_new_page.png`) with five named templates —
**Details, Grid, Inbox, Overview, Settings**. The prose
mentions a template picker exists; only the capture names the five.
`workshop/images/add_page.png` draws the Layout panel itself: a `Layout`
heading with a `+`, whose menu holds exactly **New page** and **New
overlay**, over a list reading `Header`, then `Page (DEFAULT)`, `Page 1`,
`Page 2` — so the header is a peer of the pages in that tree, and one page
is marked default.

## 3. Widgets

> "**Widgets** display content to Workshop users and are the core building blocks of a module’s user interface."

— `workshop/concepts-widgets.md`

A widget's configuration is three tabs, and the page names them —
**Widget setup**, **Metadata** and **Display**:

> "The core configuration options of a widget live within the **Widget setup** tab. This is where a module builder will configure the input and output variables of a widget"

— `workshop/concepts-widgets.md`

> "The **Raw Widget Configuration** displays how the current widget’s setup is stored in JSON and offers advanced module builders the option to quickly view, edit, or copy this configuration in its raw format."

— `workshop/concepts-widgets.md`

Display sizes a widget as **Auto (max)**, **Absolute**, or **Flex**, the
last being the ratio of this widget's height or width to that of the
others so they scale with the screen.

Data moves through named variables in and out:

> "Input variables define the data passed into a given widget, usually to then be displayed within the widget."

— `workshop/concepts-widgets.md`

> "Output variables define the data passed out of a given widget to then be consumed by a subsequent downstream widget or another variable."

— `workshop/concepts-widgets.md`

**Two enumerations of widget categories disagree, and both are real.** The
prose lists five documentation groupings — Core display, Visualization,
Filtering, Event-triggering & navigational, Embed Foundry apps. The
picker (`workshop/images/widget_picker.png`) draws different tabs:
**All | Properties and links | Visualize | Filter | Writeback | Foundry
apps**, plus a separate **Unused widgets (2)** entry, over a search field
and a `Suggested` band of cards, each card a preview thumbnail with a name
and one-line description (Object table, Metric card, Button group, Filter
list, Chart: XY, Map). The picker is the drawn surface and wins for the
surface; the prose's five are the docs' own grouping.

## 4. Variables

> "**Variables** are used by module builders to configure how data moves through a Workshop module."

— `workshop/concepts-variables.md`

The type list is an enumeration the page prints: Array, Boolean, Date,
GeoPoint, GeoShape, Numeric, **Object set**, **Object set filter**,
String, Struct, Timestamp, **Time series set**. The definition types are
a second enumeration: Static, Function, Object set aggregation, Object
property, Object set definition, Variable transformation.

Two behaviours that are design, not detail:

> "In both view and edit mode, Workshop variables will compute and recompute lazily only when displayed by a visible widget or layout."

— `workshop/concepts-variables.md`

and a three-value recompute setting — **Automatic** (the default), **Only
when triggered by an event**, and **On module load, and when triggered by
an event** — which does not apply to `Object set definition` variables.

Names are unique within a module, case-insensitively:

> "Names must be unique within a module. If a name conflicts with an existing variable, Workshop appends a numeric suffix. Matching is case-insensitive, so `MyVar` and `myvar` are duplicates."

— `workshop/concepts-variables.md`

`workshop/images/workshop_variables_panel.png` draws the panel: a
`Variables (4)` heading with `+` and a lineage-graph button, a search
field beside an `All` filter, then one row per variable showing its name
as a chip with a warning glyph and, beneath, its provenance — `Output from
Object table 1`, `Used in Filter list 1`, `Used in 2 widgets`. The editor
rail beside it holds five icons: layout, layers, `(x)` variables, an
up/down transfer glyph, and a gear.

## 5. Events

> "Events within Workshop modules enable you to trigger specific behavior whenever a user takes a given action."

— `workshop/concepts-events.md`

Ordering is stated, and it is the surprising part:

> "Events in Workshop execute sequentially in their configured order. To reorder two or more events on a widget, drag the event cards up or down in the configuration panel. Events do not wait for dependent computations from previous events to finish before executing."

— `workshop/concepts-events.md`

with the consequence spelled out: on a Set-variable-value event the target
is up to date for the next event, but "Downstream variables that depend on
the target variable will not be up-to-date before the next configured
event executes." And the limitation is admitted rather than hidden:
"Workshop does not support forcing events to wait for all downstream
updates to complete before proceeding to the next event."

The event families the page enumerates: **Layers** (Open/Close per
overlay), **Layout** (Switch to page, Expand/Collapse/Toggle section,
Switch to tab), **Variables** (Reset value, Recompute, Set variable
value, Stream LLM response into variable), **AIP Assist** (Send to AIP
Assist), and **Applications** (Open Workshop module, Open Quiver
analysis, Open Object view, Open Object Explorer, Open Notepad document).

## 6. What our substrate holds, probed

Nothing: no module, widget, page or section table exists — the live
catalogue answers NONE to every name in that family. What Workshop needs
underneath it, we do have: `object_sets` + `object_set_members` with
`object_set_where`, `object_set_rows`, `object_set_keys`,
`object_set_size` and the traversal validators; `apply_action` with its
form engine and, since 682, its applications and reverts; object types
with their properties, indexes and per-type tables; and the project role
and marking machinery a module resource inherits.

## Decisions

1. **A module is a Compass resource**, not an ontology one:
   `workshop_modules` keyed to a project (and a folder), carrying a RID
   under a `workshop` service, so it inherits project permissions exactly
   as the page says. Viewer opens, Editor edits — the roles we already
   have, not a new vocabulary.
2. **The layout tree is rows, not jsonb.** `workshop_pages` (a module's
   pages, one marked default), `workshop_sections` (self-referencing
   parent for nesting, an ordinal, and a `layout` in the captured six),
   `workshop_overlays` (kind drawer|modal, position, size). A jsonb blob
   would make the tree unqueryable and unconstrainable, and the six
   layouts are a CHECK with the picker as its declared page.
3. **`workshop_widgets`** — one row per widget instance: its section, an
   ordinal, a `kind`, a name, and the sizing triple (auto|absolute|flex
   plus its number). The widget's own configuration is jsonb, because the
   page says so itself — "Raw Widget Configuration displays how the
   current widget's setup is stored in JSON" — so jsonb here is Foundry's
   shape, not our shortcut.
4. **`workshop_variables`** — the twelve types and six definition types as
   declared CHECKs, a unique index on (module, lower(name)) for the
   case-insensitive rule, the three-value recompute setting, and the
   definition as jsonb. Deletion is refused while anything references it,
   which is the page's own "Variables that are unused in a module (by
   widgets or downstream variables) can be deleted."
5. **`workshop_events`** — ordered rows on a widget, since order is the
   semantics and dragging reorders them. The families and their kinds are
   a declared set; the LLM-streaming and AIP-Assist families are excluded
   by name (no LLM binding exists here), and the Applications family is
   built only for the targets that exist — Object Explorer and Object
   view — with Quiver and Notepad excluded because those products are not
   built.
6. **This arc builds the FOUNDATION, and the widget catalogue is its own
   arc or arcs.** Six widget kinds carry the getting-started walkthrough
   end to end — Object table, Filter list, Object view, Button group,
   Metric card, Markdown — and those are what this arc registers. The
   other ~56 are recorded, unbuilt, with the picker's own categories as
   their index.
7. **Recorded, not built, each with a reason**: the style-formatting
   system (background colours, border styles, padding, header formatting
   — a large surface with no engine behind it), mobile and vertical
   headers, loop layouts, embedded modules, scenarios, state saving,
   routing, translations, kiosk/redact modes, and the module interface.
   Each is a page in the 115 unread, and each names its own arc.

## Questions

1. **Does a module belong to a project or to a folder?** The page says
   "within the current Project or folder"; folders are ours since 497.
   Ours: both, folder optional. `blocks: nothing.`
2. **What is the default page when several exist?** The layout capture
   marks one `Page (DEFAULT)` but no sentence explains how it is chosen.
   Ours: the first created, changeable. `blocks: nothing.`
3. **Are the five layout templates fixed?** Only the capture names them
   (Details, Grid, Inbox, Overview, Settings) and no page describes what
   each produces. Ours: not built in this arc, recorded. `blocks:
   nothing.`
