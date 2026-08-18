---
verify: strict
---

# Reading — Capabilities (answered), type classes, and Global Branching

Closes the two remaining blocking questions. The Capabilities tab turns out to
have a page after all — not its own, but a **predecessor's**.

Pages read: `object-link-types/metadata-typeclasses`,
`time-series/geospatial-time-series-ontology` (+ both screenshots),
`global-branching/overview`, `core-concepts` (+ the lifecycle diagram),
`branch-security`, `resource-protection-and-approval-policies`,
`devops-release-management/overview`, `aip-analyst/capabilities`,
`ai-fde/modes-and-capabilities`.

---

## 1 — Capabilities is what type classes became

`metadata-typeclasses` has a **Deprecated** column, and some of its entries read
verbatim *"Configure in **Capabilities** page of object type"*.

> "In the Ontology Manager, object types now have a **Capabilities** page to
> configure features **historically defined as type classes**. The configuration
> of **all supported type classes will move to the Capabilities page**."

So the tab has no page of its own because it is a **migration target**. The rows
marked that way enumerate what it holds:

| kind | name | what it specifies |
|---|---|---|
| `geo` | `altitude` | "altitude/elevation, in meters relative to sea level… with 3D mode" |
| `timeseries` | `timeseries_id` | the **series identifier**; "must be globally unique across all timeseries objects, and is the **only type class that is required** for your object to be discoverable in Quiver" |
| `timeseries` | `timeseries_measure` | the measure |
| `timeseries` | `timeseries_units` | "the *value* units… a stock price timeseries might have `dollars`" |
| `timeseries` | `timeseries_internal_interpolation` | "how Quiver **infers series values between adjacent data points**" |
| `timeseries` | `timeseries_root_object_id` | "Each timeseries object can only have **one** root object" |
| `timeseries` | `timeseries_is_enum` | boolean, true for enum-valued series |
| `timeseries` | `timeseries_is_deprecated` | "filter it out of Object Explorer and Object View search results" |
| `timeseries` | `event_id` | the **event identifier**; "Should be globally unique across all event objects" |
| `timeseries` | `event_start_time` / `event_end_time` | "should be a time value (e.g. a `TIMESTAMP`)" |
| `timeseries` | `event_description` | "**required** if the event object type will be used for annotation writeback" |
| `timeseries` | `event_root_object_id` | one per event object |
| `timeseries` | `event_linked_series_id` | "**String arrays as well as single strings** are supported" |

### And the page rendered

`geospatial-time-series-ontology` shows it, and the shape is precise. **A
capability is a panel** — icon · title · one-line description · *Learn more* ·
collapse chevron. The page's own walkthrough names the tab and the flow:

> "In the **Capabilities** tab, scroll down to and select the **Geospatial**
> panel. Next, set your `Latitude Series Id` and `Longitude Series Id`
> properties as the **Track Latitude** and **Track Longitude** properties,
> respectively, before saving your changes to the Ontology."

**Geospatial**, whose panel line and five slot descriptions are read off the
screenshot and appear in no prose:

> "Each Object represents a geospatial feature"
> — time-series/images/set-track-lat-and-long.png

> **Altitude** — "Numeric (or numeric time series) property specifying
> altitude/elevation of each Object in meters"
> — time-series/images/set-track-lat-and-long.png

> **Radius** — "Numeric property specifying the radius in meters, to render
> object as circles - must also have a 'Geopoint' property indicating the
> center of the circle"
> — time-series/images/set-track-lat-and-long.png

> **H3 cell** — "String property, or array of strings, containing H3 cell IDs"
> — time-series/images/set-track-lat-and-long.png

> **Track Latitude** — "Time series property, representing the Object's
> Latitude"
> — time-series/images/set-track-lat-and-long.png

> **Track Longitude** — "Time series property, representing the Object's
> Longitude"
> — time-series/images/set-track-lat-and-long.png

Each is a row with a `Choose a property ▾` dropdown.

**But there are two panel shapes, and I had only modelled one.**

**Time series** is **list-based**, not slot-based — a `Time series properties
[1]` table with **+ Add property** and **Analyze**, columns **PROPERTY NAME ·
TIME SERIES SYNC · BASE FORMATTER**, and a row reading `Longitude Series Id
[Default] · ship-time-series-sync · No formatting ▾`. Its panel line, also from
the screenshot:

> "Set up time series properties or a sensor object type"
> — time-series/images/capabilities-time-series-properties-panel.png

**We already have `time_series_properties` (12 columns).** That is the
list-shaped capability, built before I knew it was one.

The setup flow, step by step: *Capabilities tab (**beneath Observability**) →
Time series panel → **Get started** → choose the **Object type property** →
choose the **time series sync** file → **Standard time series property** →
**Add property***. Then Geospatial → set Track Latitude and Track Longitude to
those same properties.

So the Capabilities tab is: **an object type nominating its properties against
platform contracts**, in two shapes — *named slots* (Geospatial, Event) and
*configured lists* (Time series).

## 2 — Type classes, precisely

> "Type classes can be applied to **properties, link types, and action types**."

**Not to object types directly** — the legacy group type class went on "the
**primary key property** of an object type", which is how an object-level fact
was expressed through a property.

Two user-set fields, **Kind** and **Name**. Everything is inert metadata "that
can be interpreted by user applications" **except one**:

> "With the exception of the `analyzer` type class kind, **which affects
> indexing behavior**…"

Consumers, by kind: `hubble` → Object Explorer and Object Views; `timeseries` →
Quiver; `vertex` → Vertex/Vortex; `geo` and `choropleth_map_config_id` → Map;
`schedules` → dynamic scheduling widgets; `actions` → action parameter
pre-filling (`generate_uuid`, `prefill_current_user`).

A **render hints** mechanism sits beside it — `selectable`, `sortable`,
`searchable` — and now owns what `analyzer.not_indexed` used to.

**The other two "capabilities" pages are a different word**, and each says so
in its own first sentence. AIP Analyst's is a set of **tool checkboxes**:

> "AIP Analyst uses tools to search, analyze, and present answers to your
> questions. You can customize which tools are available by selecting
> checkboxes from the **Tools** menu."

AI FDE's is an agent's context management:

> "AI FDE uses modes and capabilities to accomplish tasks and provide an easy
> way to manage the agent's context. *Modes* are the broad task at hand, such
> as data integration or ontology editing, while *capabilities* are granular
> abilities that can be used across different modes."

Neither is the object type tab.

## 3 — How a branch stores a change

> "Global Branching **auto-resolves any non-conflicting changes** during a rebase.
> For true conflicts — **where the same property of the same resource was edited
> on both `main` and your branch** — there is no automatic resolution; you must
> pick one version manually before the rebase can proceed."

**Conflict granularity is the property of a resource.** So a branch tracks
**per-resource, per-field** state — not a whole-resource copy, which could not
distinguish a conflicting edit from a neighbouring one.

Confirmed from the other direction:

> "**Removing a resource from a branch returns its state to the version of the
> resource on the `main` branch.**"

A resource is either *on* the branch, carrying its changed fields, or not on it
and therefore main's.

**An asymmetry I would have got wrong:**

> "creating or deleting Foundry resources on a branch **will affect `main`**.
> **This does not apply to ontology resources**: you can create, modify, or
> delete entities on the branch **without affecting the `main` branch**."

And how a resource joins a branch: "some applications require you to **add the
resource to your branch upfront**; others add it automatically after you save
your first changes."

### The branch lifecycle, off the diagram

Four states. **Merged has no outgoing edges.**

```
            ┌── activity ──┐
            ↓              │
         ┌──────┐ ──merge──→  Merged  (terminal)
         │Active│
         └──────┘ ──archive──→ Archived ──restore──→ Active
            │  ↑
 no activity│  │ manually activate
  for X days│  │ or action on branch
            ↓  │ or action on proposal
        ┌────────┐ ──merge──→ Merged
        │Inactive│ ──archive──→ Archived
        └────────┘
```

- **Inactive**: "ontology resources are **de-indexed**… Builds… will **immediately
  fail**." Configurable in **Control Panel > Spaces > Actions > Global branch
  retention policy** — "By default, branch inactivity is set to **35 days**, and
  branch data deletion is triggered after **7 days**."
- **Archived**: "archiving is always **manual**"; metadata retained; restorable.
- Recovering either needs "a **no-op change** such as a minor update to the
  description… to trigger re-indexing."

**Proposal states: Open · Merged · Closed.** And the rule that matters:

> "A **single rejection from any user** during the review process will cause the
> resource's changes to be `Rejected`. This will **prevent the entire proposal
> from merging**."

Merging offers three build options — **build all affected resources / build
modified resources only / do not build**. On partial failure, "**You cannot
currently revert a partially-failed merge**."

### Roles, and a separation worth copying

> "Branch roles control access to **branch management actions only** and **do not
> grant permissions to edit resources** on the branch. To modify resources, a
> user must have the appropriate permissions at the project or resource level."

`Owner` (≥1 per branch, the creator by default) manages branch and proposal
metadata, roles, organizations, archive/restore, the inactive label, and a **Do
not merge** setting. Space `Administrators` have the same powers.

> "Any user who can view a proposal can merge it, as long as resource-level
> approvals and checks are satisfied and the **Do not merge** setting is not
> applied."

> "The person who merges may be submitting changes to resources that they
> cannot edit themselves. This is by design: edit permissions are still
> required to modify the branched resource in the first place; reviewers can be
> designated to verify and approve the change; and merging only applies
> pre-authored and approved changes."

**Approval policies** are set at the **project** level and satisfied one of two
ways: "**Automatically**, when the contributor's own permissions cover the
policy" or "**Through review**, when a separate user with the required permission
approves." Protection is per-resource, set by resource owners, shown as a **branch
lock icon in the Compass file system**, and a project can "**automatically protect
all new files**".

## 4 — Release management: spaces are the environments

**Corrected 2026-08-18.** This section previously quoted "A typical environment
setup consists of… Development, Test, Production, each represented as a
'space'." **No page says that** — it was a paraphrase wearing quotation marks,
and the citation gate caught it. What the page actually says:

> "Spaces are a flexible primitive in the Palantir platform that allow for
> environment separation in Foundry. Environment separation is the practice of
> maintaining distinct spaces for different stages of development and
> deployment, such as development, testing, and production."

This interlocks with "**a space can hold a single ontology**": each environment
has **its own ontology**, and promotion between them is Marketplace, not
branching.

> "Global Branching is ideal for **rapid iteration**… However, due to the
> **short-lived nature of branches** and limited coverage of resource types, it
> does not always fulfill all of the needs of release management."
>
> "They should **not be seen as alternative solutions to the same problem**, but
> rather **complementary solutions to different problems**."

Branching works *within* an environment; release management moves *between* them,
and only the latter offers "**Roll back to a previous release**".

---

# What changes in the map

**B4 · Capabilities** — two shapes, not one:

- **slot-based**: `object_type_capabilities(object_type_id, capability, slot,
  property_id)`, one row per nominated slot. Geospatial has five slots, all now
  quoted with their type constraints.
- **list-based**: a table per capability with its own columns. **We already have
  `time_series_properties`** — it *is* this, and it needs a `sync` reference and
  a `base_formatter` to match.

The vocabulary is now enumerable from the type-classes table rather than guessed.

**B6 · Type classes** — narrows usefully: applied to **property, link type,
action type**; `kind` + `name`; inert *except* `analyzer`, which affects
indexing. Render hints are a sibling mechanism.

**D1 · Branches** — unblocked. **Per-resource, per-field** state; removing a
resource reverts it to main; ontology create/delete is branch-local where other
resources' is not.

**D · Lifecycle** — four branch states with a terminal Merged, three proposal
states, one rejection blocking the whole proposal, and de-indexing on inactivity.

**D · Roles** — branch roles govern *the branch*, never the resources. Merge
rights are deliberately wider than edit rights.

**A1 · One ontology per space** gains a second reason: the space is also the
**environment**, so dev/test/prod each have their own ontology by construction.

## Built (2026-08-18) — the Capabilities tab, and what the audit found

**B4's slot half was already built and had never been used.** Migration 415
created `object_type_capabilities`, the `capability_slots()` registry (11 slots
across Geospatial and Event, each with its `accepts` list and its screenshot
description), `guard_object_type_capability` and both RLS policies. Production
held **zero rows**, no function read the table, and no surface wrote it — so
the guard's three refusals had never once fired.

So this phase built the missing half rather than the engine: a **Capabilities
tab** on the object type (`features/objectTypes/CapabilitiesTab.tsx`), shaped
as the screenshot has it — one collapsible panel per capability with its icon,
title and one-line description, each slot a row with a `Choose a property ▾`
dropdown. **The picker offers exactly what the guard accepts**: both read
`accepts` from `capability_slots()`, so the vocabulary is never restated in the
surface.

`capabilities.test.ts` now fires each refusal — unknown slot, a property of
another object type, a base type the slot does not take — and the nomination
that must succeed. The whole CRUD path was also run **as `authenticated`**
against production, because "authors write capabilities" had never admitted a
row and a policy nobody has exercised is a guess.

**Deliberately not built.** The list-shaped panel (Time series) needs a `sync`
reference and a `base_formatter` that `time_series_properties` does not carry,
and nothing stores a time series yet. Type classes as a *general* mechanism
stay unbuilt: the page says "the configuration of all supported type classes
will move to the Capabilities page", so building a generic kind/name bag would
be building the thing Foundry is retiring. **Render hints are separate and
already real** — `searchable`, `sortable`, `selectable` and `analyzer` are
columns on `object_type_properties`, the published dependency rule is a CHECK
(`hints_need_searchable`), and they are consumed by `object_set_where`,
`evaluate_object_set`, `aggregate_object_set` and `search_index_payload`. The
seven hints we lack are recorded in the map, not here.

## Open questions

1. **RID forms for link type, shared property, action type, interface, value
   type.** The spec is exact; only the `<type>` segment's spelling is unknown.
   Weakly blocking — a renamed RID is a stored generated column across every row.
2. **Object type `ID` vs `API name`** — both exist and differ; no page read says
   which one a link resolves against.
3. **Ontology configuration** — the bottom-left settings entry.
4. **Where function code lives** — G2's dependency, a product decision.
