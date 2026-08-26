---
verify: strict
---

# Slate, the foundation: applications, widgets, variables, events, styles

The second of the eleven Home applications, and the one this repository
already depends on without having: CLAUDE.md's Blueprint rule cites Slate's
own styles page, and its page-reading protocol names that same page as the
one I read partially and built wrongly from. So this reading opens by
re-reading it whole.

**What I read, counted rather than asserted.** The section holds **47
pages**, of which **8 are widget-category pages** — the catalogue, not the
foundation. Read whole: `overview`, `applications-types`, `navigation`,
`applications-pages`, `concepts-variables`, `concepts-events`,
`concepts-styles`, `widgets-container`. Read for their enumerations alone:
the other seven widget-category pages (`widgets-text`, `widgets-control`,
`widgets-visualization`, `widgets-chart`, `widgets-time`,
`widgets-platform`, `widgets-advanced`). **Images: the section has 158; I
parsed 2** — `slate/images/slate-ui-annotated.png` and
`slate/images/events-panel.png`. The rest are per-widget property
screenshots and worked examples belonging to arcs this one does not build;
named as unparsed so the debt is recorded. 39 pages remain unread.

## 1. What Slate is, and its two application types

> "**Slate** enables application developers (builders) to construct dynamic and responsive applications with a custom design using a drag-and-drop interface, reducing development time and cost."

— `slate/overview.md`

> "Slate supports two types of applications: Integrated applications and public applications."

— `slate/applications-types.md`

Integrated is the ordinary one — "published to Foundry users within your
Organization and can be viewed or edited based on user permissions".
Public is the striking one, and it is defined by what it cannot reach:

> "Public Slate applications are not able to read data and resources outside of the application itself. The application cannot access objects, datasets, actions, or files (like stored images or videos). Therefore, widgets and components that require access to other elements of the platform are not available in public Slate applications."

— `slate/applications-types.md`

with a permission of its own — the **Manage public Slate applications**
workflow, granted through Control Panel's Organization permissions.

## 2. The editor is four areas

> "There are four main areas of Slate in edit mode:"

— `slate/navigation.md`

the **Action bar** ("the application name, the **Actions** dropdown, exit
to view mode, and buttons to open various editing panels"), the **Widget
List** ("where all the widgets in your application are listed"), the
**Canvas** ("the workspace for your application"), and the **Widget
Editor**. The pop-out panels are enumerated by the same page: Queries,
Functions, Platform (Object sets, Object context, Foundry Functions),
Events, Dependency graph, Styles, Variables.

**What the capture adds that the prose does not**
(`slate/images/slate-ui-annotated.png`): the action bar's second row draws
the panel buttons in order — `Datasets  Queries  Functions  Platform
Events  Dependencies  Styles  Variables` — beside a `File` and `Help` menu
and a version chip reading `(v1)`, with `Actions ▾`, `Save` and a close ✕
at the right. The Widget List is a **tree** under a `Widget | Workflow`
toggle and a "Search widgets…" field, rooted at `canvas` → `w_document` →
`w_toolbar`, each node carrying a per-type glyph. And the Widget Editor
draws a **CONTAINER TYPE** dropdown open on five values: `Basic`, `Flex`,
`Repeating`, `Split`, `Tabbed`.

The Widget Editor's tabs are named in prose: **Property** ("the main
editing tab"), **Layout** ("Set the position and size of your widget, and
apply custom styling"), **JSON**, and **Events**. The JSON tab is not an
escape hatch bolted on — it is documented as the intended overflow:

> "If the **Property** tab does not provide the setting you need, edit the widget's raw JSON configuration in this tab. Each widget starts with template code containing the most commonly used attributes, and fields changed in the **Property** tab also appear in the **JSON** tab."

— `slate/navigation.md`

with a warning that state not exposed through Property "is managed
internally by Slate".

## 3. Everything is named, and the name is the wire

The events panel makes Slate's whole grammar visible
(`slate/images/events-panel.png`): a list headed `Events & actions 4`,
grouped by event — `w_button_1.click` → `q_query.run`;
`w_buttonConditional.click` → `q_queryConditional.run`;
`w_selectionDropdown.selectedValue.changed` → `v_selectionHistory.set` and
`v_doubleSelection.set` — over an editor pairing an **EVENT** dropdown with
an **ACTION** dropdown and a JavaScript body referencing
`{{w_input_1.text}}` and `{{slDisableAction}}`.

So an identifier is `<prefix>_<name>`, an event is `<identifier>.<event>`
and an action is `<identifier>.<action>`. The prose confirms it:

> "Choose `w_button.click` for the triggering event, and `q_query.run` for the triggered action, and select **Update** to persist your change. No JavaScript is necessary for this pairing."

— `slate/concepts-events.md`

and defines the two halves:

> "[Actions](/docs/foundry/slate/concepts-events-and-actions-index/) are changes to the behavior of the application, including opening or closing dialogs/toasts, running queries, or setting variable values."

— `slate/concepts-events.md`

> "[Events](/docs/foundry/slate/concepts-events-and-actions-index/) are triggers, such as a user interaction with the application (a user click, change of value, or opening and closing of dialogs) or data loading state (query run completion) that execute an action."

— `slate/concepts-events.md`

Event JavaScript is sandboxed by the same rule as functions: it "does not
have access to the DOM or the Slate [space]... and no state is saved".

## 4. Variables, and their two scopes

> "The valid types for variables are `Number`, `String`, `Boolean`, `Array`, `Object`, and `Null`."

— `slate/concepts-variables.md`

Scope is per page or per application, and the uniqueness rules differ:

> "Shared variable names must be unique across all pages, widgets, events, queries, and functions."

— `slate/concepts-variables.md`

— so a shared variable's name competes with every other identifier in the
application, which is what makes the `w_`/`q_`/`v_` prefixes load-bearing
rather than stylistic. Local names need only be unique within their page.

And the default is non-persistence:

> "The values of variables do not persist across page loads. When the Slate application is reloaded, it will use the default variable values."

— `slate/concepts-variables.md`

A note worth carrying: the **Datasets** panel the capture still draws "has
been migrated to the **Variables** panel", where tabular data is now a
shared variable.

## 5. Pages

> "Pages offer application builders the ability to split application UI, logic, and resources (for example, [queries](/docs/foundry/slate/concepts-queries/), [variables](/docs/foundry/slate/concepts-variables/), [functions](/docs/foundry/slate/concepts-functions/), and [events](/docs/foundry/slate/concepts-events/)) into different pages within a single application, providing isolated scope for each page that loads separately."

— `slate/applications-pages.md`

So a page is a scope boundary, not just a screen — which is why variables
have a page scope at all.

## 6. Styles — the page CLAUDE.md names, read whole this time

> "Slate is built on top of the Palantir open source Blueprint framework and, like any other website, styles the DOM using CSS. This provides a consistent look and feel to widgets and a built-in toggle to “Dark Mode”. These are not “skins” or “templates”, but rather built in to each Slate widget."

— `slate/concepts-styles.md`

The page carries five things beyond that sentence, and the prior failure
was taking only the sentence:

1. **Three scopes.** Per-widget styles ("These styles are only available on
   the selected widget. If the widget is a container, the styles will also
   be available by all of its nested children"), a **local stylesheet**
   ("Each Slate application has exactly one local stylesheet"), and
   Blueprint's own. The page says "There are two different types on
   stylesheets available" and then documents only the local one; the second
   is `slate/styles-global-stylesheet.md`, unread here.
2. **The named-classes pattern**: "The cleanest pattern is to define new
   classes in the **Styles** panel and apply them to individual widgets
   using the **Additional Classes** configuration."
3. **Blueprint's CSS API specifically**: "pay attention to the **CSS API**
   (rather than the JavaScript API) section for each component", with
   colours "chosen with WCAG 2.0 compliance in mind".
4. **Static CSS, with three escapes.** "Since Slate's styling needs to be
   determined at page load, all CSS styles must be static" — and then
   dynamic Additional Classes, the templated `style` attribute on HTML
   widgets, and the `?$theme=dark` query parameter.
5. **Custom fonts**, uploaded as otf and referenced by RID, and the whole
   CSS is really **LESS**, compiled at page load.

## 7. Two enumerations of containers disagree

`widgets-container` lists the category as **seven**: Basic, Dialog, Flex,
Repeating, Split horizontally, Split vertically, Tabbed. The Widget
Editor's CONTAINER TYPE dropdown draws **five**: Basic, Flex, Repeating,
Split, Tabbed (`slate/images/slate-ui-annotated.png`). They are not in
conflict about the product — the dropdown collapses the two Splits into
one type with an axis, and Dialog is a container widget rather than a
container *type*. Both are recorded; the dropdown is what a builder picks
from.

## 8. What our substrate holds, probed

Nothing named slate, application, or query exists. What Slate would sit on
we do have: object types, object sets and their traversal engine, action
types with their form and revert engines, functions as versioned code in a
QuickJS isolate (501/502), projects and their roles, and — since 685 — a
widget-tree precedent in Workshop, whose sections/widgets/variables/events
shape this one closely resembles without being the same thing.

## Decisions

1. **A Slate application is its own resource, not a Workshop module.** The
   two products differ where it matters: Workshop's data is the object
   layer by principle, Slate's is queries against anything including
   external sources; Workshop lays out sections, Slate positions widgets on
   a canvas. Sharing tables would force one shape onto both. `slate_apps`,
   keyed to a project, with `kind` in (integrated, public).
2. **The `w_`/`q_`/`v_`/`f_` namespace is one table's uniqueness rule, not
   four.** Because shared names "must be unique across all pages, widgets,
   events, queries, and functions", identifiers live in one
   `slate_identifiers`-shaped space — enforced by a unique index over the
   application, not by four separate ones that could collide.
3. **Widgets are a tree with a container type**, the dropdown's five, and
   `axis` for Split. Position and size live on the widget (the Layout tab),
   configuration in jsonb (the JSON tab is Foundry's own documented
   overflow, exactly as Workshop's Raw Widget Configuration was).
4. **Events are `(event_identifier, event_name) → (action_identifier,
   action_name)` pairs** with an optional JavaScript body — the grammar the
   panel draws. Running them is a later arc; storing and validating the
   wiring is this one.
5. **Variables carry a scope** (shared or page-local) and the six types the
   page names, with the two different uniqueness rules enforced rather than
   documented.
6. **Styles: the local stylesheet is a column on the application, and
   per-widget styles plus Additional Classes are columns on the widget.**
   LESS compilation is NOT built — recorded, with its reason: we have no
   LESS compiler and inventing one is not this arc.
7. **Public applications are recorded, not built.** Their whole definition
   is an isolation boundary — no objects, datasets, actions or files — plus
   an organization permission we would have to add. Building the isolation
   half-way would be worse than not building it.
8. **The widget catalogue is indexed, not built**, as Workshop's was: the
   eight categories and their ~40 widgets recorded with the page that
   documents each, and a small set built to carry the foundation.

## Questions

1. **Does a Slate app have one canvas per page, or one shared?** Pages
   "load separately" with "isolated scope", which implies per page. Ours:
   per page. `blocks: nothing.`
2. **What are the event names per widget type?** Each widget page lists its
   own; this reading did not enumerate 40 widgets' events. Ours: stored as
   text and validated against the widget's kind when the catalogue reaches
   it. `blocks: nothing.`
3. **Is the second stylesheet type global-per-enrollment?**
   `styles-global-stylesheet` is unread. Ours: local only, for now.
   `blocks: nothing.`
