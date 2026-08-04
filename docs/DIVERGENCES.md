# Where we deliberately differ from Foundry

The stage directive says copying Foundry's shape is the default and **"quietly
building a different shape is not"** acceptable. This is where the divergences
live, so "quietly" is impossible.

Until now they were scattered across migration headers, PR bodies and phase
notes. That is fine for the person who wrote them and useless for anyone
checking whether a behaviour is theirs or ours — which is the question this
register exists to answer.

**Every row cites the mirrored page**, not a URL. `docs/foundry-reference/mirror/`
holds 438 pages; a claim about Foundry that cannot be grepped is a claim nobody
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

| | | source |
|---|---|---|
| **Theirs** | A promotion requires a **thumbnail**. | `mirror/app-building/curating-apps.md` |
| **Ours** | `app_promotions.thumbnail_url` is nullable; the card falls back to the icon. | migration 309 |
| **Why** | We have no upload surface for application art. A required column nobody can populate is a promotion nobody can make. |
| **Undo when** | An upload surface exists — then `NOT NULL`, which is the only change needed. |

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
| **Ours** | 8. | W1–G1 |
| **Why** | A widget nobody has asked for is the dead vocabulary this codebase keeps removing. Two earned their place by evidence: Tabs, because three effects existed with nothing able to trigger them; Filter List, because `object_set_filter` was a variable type with no consumer. |
| **Undo when** | Per widget, on demand. |

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
| **Undo when** | Resource-level roles land — `ONTOLOGY-PARITY-GAPS.md` gap 6, which is where Resource Curator belongs. |

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
| **Undo when** | Resource-level roles land (`ONTOLOGY-PARITY-GAPS.md` gap 6). Resource Curator is the first role that arc should define. |

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
