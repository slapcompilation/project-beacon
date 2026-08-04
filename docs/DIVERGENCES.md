# Where we deliberately differ from Foundry

The stage directive says copying Foundry's shape is the default and **"quietly
building a different shape is not"** acceptable. This is where the divergences
live, so "quietly" is impossible.

Until now they were scattered across migration headers, PR bodies and phase
notes. That is fine for the person who wrote them and useless for anyone
checking whether a behaviour is theirs or ours — which is the question this
register exists to answer.

**Every row cites the mirrored page**, not a URL. `docs/foundry-reference/mirror/`
holds 532 pages; a claim about Foundry that cannot be grepped is a claim nobody
will re-check.

## How to read the columns

- **Theirs** — what the documentation says, quoted.
- **Ours** — what we do instead.
- **Why** — the reason, in terms of what would break otherwise.
- **Undo when** — the condition that removes the divergence. A divergence with
  no exit condition is a decision to fork, and should be argued as one.

---

## Structural

| | |
|---|---|
| **Theirs** | Foundry's backend is predominantly Java; errors follow Conjure's `Namespace:ErrorName`. |
| **Ours** | TypeScript throughout, one `packages/reality-graph` shared by browser and edge functions. **Their error naming is adopted.** |
| **Why** | `selectObjectSet`, `searchAround`, `evaluateAutomation` and `decideAutoExecution` run identically client- and server-side from one implementation. A Java backend means a TS client anyway, and then two implementations of ontology semantics — the exact drift the ontology arc exists to remove. |
| **Undo when** | Never for language. Recorded because it is the largest deliberate difference, argued in full in `CLAUDE.md`. |

| | |
|---|---|
| **Theirs** | Generated SDKs (OSDK) give cross-boundary type safety. |
| **Ours** | One shared TypeScript package. |
| **Why** | A shared package gives the same guarantee without a code generator. |
| **Undo when** | A consumer appears that cannot import the package — a third-party integration, or a non-TS runtime. |

---

## Workshop

~~**Thumbnails are optional.**~~ **CLOSED — migration 332.** The undo condition
was "an upload surface exists", and it now does: an `app-art` public bucket and
an upload control in the promote dialog. `thumbnail_url` is `NOT NULL`, so this
matches Foundry exactly. The decision the old row was really waiting on was
*where app art lives* — not `documents` (private, PII-scanned, ingestion-piped: a
thumbnail is chrome, not evidence) and not `product-images` (right visibility,
wrong owner). Zero promotions existed, so nothing needed backfilling.

| | | source |
|---|---|---|
| **Theirs** | Chart XY takes an array of **layers**, each with its own data input and type, so a chart can overlay several series. | `mirror/workshop/widgets-chart.md` |
| **Ours** | One layer. | migration 331 |
| **Why** | Multi-layer exists to overlay a forecast on an actual. Nothing has asked for two series on one axis, and the layer array is the difference between a chart config and a chart *builder*. |
| **Undo when** | A screen wants forecast-vs-actual on one axis — then `config.layers[]` instead of the flat keys, which is a config migration and no renderer change. |

| | | source |
|---|---|---|
| **Theirs** | The Inline Action widget supports **form and table** interfaces; the table does bulk editing and CSV upload. | `mirror/workshop/widgets-inline-action-form.md` |
| **Ours** | The form only. | migration 331 |
| **Why** | Theirs says the form is "recommended for small-scale datasets where guided form interaction is desired" and the table is for "large-scale datasets or when data is sourced from CSV files". We have a CSV import path already; an editable action grid is a different product. |
| **Undo when** | Somebody needs bulk edits inside a module rather than through import. |

| | | source |
|---|---|---|
| **Theirs** | The Object View widget can embed the **full or panel** object view. | `mirror/workshop/widgets-object-view.md` |
| **Ours** | Panel only. | migration 331 |
| **Why** | The full view owns a page — header, metric strip, action bar, right rail — and a module already has one. Embedding it puts two page frames on one screen. |
| **Undo when** | A module is used as a full-page shell rather than a composed screen. |

| | | source |
|---|---|---|
| **Theirs** | An embedded module always uses **"the published version of the child module"**. | `mirror/workshop/embedded-modules.md` |
| **Ours** | Only a **published** module may be embedded at all; a draft renders a notice. | migration 315 |
| **Why** | We do not snapshot module *content* per version — `version` is a pin promotions and installations point at, not an immutable copy. Refusing a draft is the part of their guarantee we can actually deliver: it stops a parent showing a colleague's half-finished work. |
| **Undo when** | Module versions become content snapshots. Then embed the pinned version rather than refusing drafts. |

| | | source |
|---|---|---|
| **Theirs** | Nesting depth is unbounded; infinite chains are prevented by refusing self-reference. | `mirror/workshop/embedding-workshop-modules-overview.md` |
| **Ours** | Self-reference refused **and** depth capped at 3. | migration 315 |
| **Why** | The cycle guard is theirs and matches almost exactly. The depth cap is **ours** and is stricter than necessary — it would refuse a legitimate four-level composition. |
| **Undo when** | Anyone hits it. It was belt-and-braces on a recursive renderer, and the cycle check is what actually prevents a hung tab. |

| | | source |
|---|---|---|
| **Theirs** | `.cardinality()` returns **"the approximate number of distinct values"** — it runs server-side over an index. | `mirror/functions/api-object-sets.md` |
| **Ours** | Exact distinct count. | `runtime.ts` `aggregateSet` |
| **Why** | The objects are already in hand, so exactness is free. More precise, same meaning. |
| **Undo when** | Aggregation moves server-side over an index. Worth knowing today if a number here ever has to reconcile with one of theirs. |

| | | source |
|---|---|---|
| **Theirs** | The Markdown widget accepts rich content. | `mirror/workshop/widgets-markdown.md` |
| **Ours** | Rendered as text, with `{{variable}}` and `{{variable.property}}` interpolation. | W1, extended in G1 |
| **Why** | Interpreting authored markup is an injection surface, and nothing has needed formatting yet. |
| **Undo when** | Somebody needs formatting — then a sanitising renderer, not `dangerouslySetInnerHTML`. |

| | | source |
|---|---|---|
| **Theirs** | Tabs widget offers four styling presets, active colour, tab height. Filter List offers seven filter components and a pills layout. | `mirror/workshop/widgets-tabs.md`, `widgets-filter-list.md` |
| **Ours** | Direction only (horizontal/vertical); two filter components (pick-from-values, starts-with); vertical layout. | migrations 316, 318 |
| **Why** | Density and radius are decided globally here. Per-widget styling turns a vocabulary into a theme editor. The filter components are demand-gated individually, like the widgets. |
| **Undo when** | A real screen asks for one. Each is a registry entry. |

| | | source |
|---|---|---|
| **Theirs** | ~40 widgets. | `mirror/workshop/concepts-widgets.md` |
| **Ours** | 11. | W1–G3 |
| **Why** | A widget nobody has asked for is the dead vocabulary this codebase keeps removing. Two earned their place by evidence rather than request: Tabs, because three effects existed with nothing able to trigger them; Filter List, because `object_set_filter` was a variable type with no consumer. Chart XY, Object View and Inline Action were asked for. |
| **Undo when** | Per widget, on demand. |

---

## Property base types

| | | source |
|---|---|---|
| **Theirs** | Fifteen base types, including Vector, Geopoint, Geoshape, Attachment, Time series, Geotemporal series, Media reference, Cipher text and Struct. | `mirror/object-link-types/base-types.md` |
| **Ours** | Six: text, number, boolean, date, media_reference, vector. | migration 339 |
| **Why** | The two advanced ones added have consumers — a chunk needs a vector to be searched, a document needs a media reference to be shown beside the chunk citing it. The other seven have none, and a base type nobody stores is the dead vocabulary the guards keep removing. Their **title-key rule is adopted exactly**: neither may title a record. |
| **Undo when** | Per type, on demand. Geopoint is the likeliest next — hotels already carry coordinates in `hotels.config` jsonb. |

| | | source |
|---|---|---|
| **Theirs** | A media reference action parameter renders as a **File picker** with drag-and-drop, and media uploads only commit to the media set on successful submission, so a cancelled form leaves no orphan. | `mirror/media-sets-advanced-formats/upload-media.md`, `media-in-ontology.md` |
| **Ours** | The parameter takes a path as text. | migration 339 |
| **Why** | `ActionFieldKind` has no file kind, and adding one means an upload widget, a staging area and the orphan guarantee — a feature, not a field. |
| **Undo when** | Documents are uploaded through an action rather than the documents page. Then the file picker and the commit-on-submit rule land together, because the second is what makes the first safe. |

---

## Tenancy

| | | source |
|---|---|---|
| **Theirs** | Two separate things. **Organizations and Markings are mandatory controls** — *"will always prevent an ineligible user from accessing a resource, regardless of the user's role"* — and are not properties or links. Everything else that relates two objects is a **link type** with a declared backing. | `mirror/security/projects-and-roles.md`, `mirror/object-link-types/` |
| **Ours** | **Two** hardcoded tenant columns: `organization_id` on 52 tables and `hotel_id` on **89 of 120**, both enforced by RLS through `auth_org_id()` / `auth_hotel_id()`. |  |
| **Why** | `organization_id` is the exact analogue of their Organization, and correct as a column. **`hotel_id` is doing two jobs**: it is a mandatory control *and* a domain relationship, because a property is both a security realm and a business object in hospitality. Foundry has no second tenant level, so there is nothing to copy. |
| **Undo when** | Never for `organization_id`. For `hotel_id`, only if properties stop being a security boundary — which would mean a different product. **What should change is the honesty**: `belongs_to_hotel`, `belongs_to_org`, `manages` and `operates` were declared as edge types, and the database refuses all four (absent from the CHECK, zero rows). The relationship is real; the edge never was. |

---

## Logic

| | | source |
|---|---|---|
| **Theirs** | AIP Logic has six block types — Use LLM, Apply action, Execute function, Conditionals, Loops, Create variable — and **executes** them. A Conditional "evaluates a condition and executes different paths based on whether that condition is true or false". | `mirror/logic/blocks.md` |
| **Ours** | One block type: Foundry's Use LLM (a prompt, optionally a tool). | `authoredAgents/index.ts` |
| **Why** | Our procedure **compiles into a numbered task prompt** an LLM follows (`compileAgent`), not into an executed graph. A Conditional block here would become the sentence "if X then Y" and the model would decide — prose wearing a block's clothes, which is the dead vocabulary this codebase keeps deleting. |
| **Undo when** | The runtime executes the procedure rather than prompting it. Then Conditional and Loop are real control flow and the canvas is drawing a graph instead of a list. Adding the block types first would be backwards. |

| | | source |
|---|---|---|
| **Theirs** | AIP Logic is "a **no-code** development environment" — every function is authored in the UI. | `mirror/logic/overview.md` |
| **Ours** | Authored agents are data and editable on the canvas; **shipped agents are code and the canvas stays a viewer** for them. | #330, and the editor above |
| **Why** | A shipped agent's blocks are `BlockDef`s with zod schemas in TypeScript. Editing them from a canvas means generating code, and the generated half would drift from the hand-written half — the exact split the ontology arc exists to remove. |
| **Undo when** | Never, deliberately. The two halves are different kinds of thing and the canvas says so. |

---

## Ontology status

| | | source |
|---|---|---|
| **Theirs** | Three rules: one end `experimental` → the link is experimental; one end `example` → example; one end `deprecated` → deprecated. The table resolves only experimental vs deprecated ("deprecated only"), and has **no `example` column at all**. | `mirror/object-link-types/metadata-statuses.md` |
| **Ours** | Precedence `deprecated > experimental > example`. | migration 322 |
| **Why** | Their three rules collide and the docs settle one collision. `example` asserts provenance — "the resource has been installed as an example" — and a link with one end that was not installed as an example was not either, so the label would be false. `experimental` asserts development state, which is true of the link either way. |
| **Undo when** | Their docs cover the case, or a real ontology package installs an example type next to an experimental one and the operator expects the other answer. |

| | | source |
|---|---|---|
| **Theirs** | Statuses cover object types, **properties**, link types, actions and interfaces. | same page |
| **Ours** | Object types, link types and interfaces. Properties are jsonb on their object type, so they carry the type's status rather than one each. | migration 321 |
| **Why** | "If an object type is changed from `active` to `experimental`, all of its properties will be marked `experimental`" — with properties stored inside the type, that propagation is not a rule to run, it is already true. A per-property status would need properties to become rows first. |
| **Undo when** | Properties become rows. Then a property status is a column, and the propagation is a trigger. |

| | | source |
|---|---|---|
| **Theirs** | Deleting an `active` resource is refused, full stop. | same page |
| **Ours** | Refused for operator sessions (`auth.uid()` present). Service-role paths and cascades are not blocked. | migration 321 |
| **Why** | Deleting an organization cascades to its object types; an unconditional guard makes the org undeletable, which protects the wrong thing. The guard exists to stop a person removing what a live application reads. |
| **Undo when** | Org deletion stops cascading into ontology tables, or grows an explicit teardown path. |

| | | source |
|---|---|---|
| **Theirs** | `promoted` requires the Ontology Owner role, or "a proposal for review and approval by an Ontology Owner". At the platform level, Compass requires **Editor on the resource *and* Resource Curator at the space level**. | `mirror/object-link-types/metadata-statuses.md`, `mirror/compass/resource-status.md` |
| **Ours** | Any org admin or owner, via the existing `admins update object types` policy. | migration 321 |
| **Why** | We have no curator or ontology-owner role, and inventing one for a single status would be a permission tier with one consumer. |
| **Undo when** | A role hierarchy distinguishes ontology stewardship from org administration. Resource Curator is the first such role to define. |

### `promoted` was in the wrong place — RESOLVED (migrations 327/328)

Left here as a record, because the shape it produced is now the one in the code.
Migration 321 made `promoted` a fifth ontology status, which made it **exclusive
with `active`** — promoting a type meant no longer being able to say it was in
use. Compass owns it: a separate binary axis over any resource, so a type is
`active` *and* promoted. `resource_status` now holds it, and all three of its
effects are live — search boost, checkmark, and the promoted-items catalog that
an empty palette shows.

Two real divergences came out of the move:

| | | source |
|---|---|---|
| **Theirs** | Resource status applies to **any** resource — projects, folders, files, datasets. | `mirror/compass/resource-status.md` |
| **Ours** | Three kinds: object types, applications, documents. | migration 327 |
| **Why** | Promotion is only *felt* where quicksearch can surface something, and those are the three kinds it searches. A promotable kind that never appears in a result set is a curation nobody can see. |
| **Undo when** | Quicksearch grows a kind — the two move together, one row in `PROMOTABLE_KINDS` and one `UNION ALL`. |

| | | source |
|---|---|---|
| **Theirs** | Promoting needs **Editor on the resource *and* Resource Curator at the space level** — two grants, one of them scoped above the resource. | `mirror/compass/resource-status.md` |
| **Ours** | Org admin or owner. | migration 327 |
| **Why** | We have neither role, and a curated catalog only works if curation is scarce — the two-grant design is how Foundry keeps it scarce. Ours leans on admin being scarce instead, which is weaker. |
| **Undo when** | A curator role exists. Project roles (migration 330) are the spine it would attach to. |

---

## Not divergences — things we copied that look odd

Recorded because each was nearly "improved" into a different feature.

- **`CONTAIN` is a prefix match, not a substring.** *"Limited to prefixes; matching arbitrary portions of strings is not currently supported"* — their example: `id000123` matches `id0001` but not `d0001`. (`mirror/workshop/object-set-filter-variables.md`)
- **Events dispatch in order but do not wait.** *"Events do not wait for the downstream computations of previous events to complete before executing."* An effect reading what the previous one computed reads the old value. (`mirror/workshop/concepts-events.md`)
- **Lazy computation excludes sections.** The rule names *"non-visible pages, tabs, overlays"* — a collapsed section still computes. (`mirror/workshop/concepts-variables.md`)
- **The Tabs widget derives its selection.** It *"does not hold its own selection state"*; the selected tab is the one whose event would cause **no layout state change**. (`mirror/workshop/widgets-tabs.md`)
- **A loop pages through at most 10,000 objects.** (`mirror/workshop/loop-layouts.md`)
- **`object_set_definition` ignores recompute configuration** and behaves as automatic. (`mirror/workshop/concepts-variables.md`)
- **A new ontology resource starts `experimental`, not `active`.** Everything that existed when statuses arrived was set to `active`, because it was already relied on — but the default going forward is theirs. (`mirror/object-link-types/metadata-statuses.md`)
- **`promoted` sets visibility to `prominent` by itself**, so the visibility control is disabled while it is selected rather than showing a value the write will overrule. (same page)

---

## Adding a row

When you deviate: add the row **in the same change**, cite the mirrored page, and
state the undo condition. If you cannot write the undo condition, the deviation
is probably not one — it is a decision to build something else, and belongs in
`CLAUDE.md` under non-goals with an argument.
