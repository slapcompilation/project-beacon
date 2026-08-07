# Reading — Deep Dive: Creating Your First Ontology

The learn.palantir.com course, read to the word with every screenshot parsed
field by field. Read to answer one question: **what is the Ontology itself**,
so object types can be defined into it later from client datasets.

Source: `docs/foundry-deep-dives/source/01-ontology/` (18 PDFs). Read in full:
`Introduction`, `Context: Fresh Air`, `Ontology Manager`, `Create an object
type`, `Create a link type`, `Create an action type`. Cross-checked against
`mirror/ontology-manager/save-changes.md`.

---

## 1 — What the course says the Ontology is

> "The data that is used most regularly in Foundry is presented as **objects**…
> This object's data is typically **aggregated from many different original data
> sources**. For example, an Aircraft object might contain information pulled
> from purchase records, maintenance systems, flight systems, and more."
>
> "The **Ontology** defines the set of **object types** available. **Each instance
> of Foundry has its own unique set of object types** that are specific to that
> organization and the problems they face… the Aircraft object type might have
> different properties and different relationships to other object types at an
> airline than it does for the military."

Four stated benefits: easier data, **a common operational vocabulary across
workflows and across the organization**, operational decisions through
well-defined actions, AI in a day-to-day operational context.

## 2 — The Fresh Air graph, read off the diagram

Seven object types, each a card with an icon, and every edge carries a
cardinality badge:

```
                     [OFT] Airline
                    ↙ ↔1        ↔1 ↘
            [OFT] Route              [OFT] Aircraft
           ↙ ↔2      ↔1 ↘          ↙ ↔1        ↔1 ↘
   [OFT] Airport        [OFT] Flight ——↔1—— [OFT] Flight Alert
        ↓ ↔1
   [OFT] Runway
```

**The `↔ 2` between Route and Airport is the detail.** Two link types over one
pair of object types — origin and destination — which is exactly the airline
diagram in `ontology-core-concepts`. A pair of types is not a pair of *links*.

> "an **Airline** operates a fleet of **Aircraft**. These Aircraft regularly fly
> from one **Airport** to another, where they land or takeoff from a given
> **Runway**. The connection between any two Airports along which Aircraft
> regularly fly is a **Route**. A **Flight** is a specific instance of an Aircraft
> flying along a Route at a particular date and time… These non-standard events
> generate a **Flight Alert**."

And the naming note, which is a namespace by another name:

> "the object types include an **OFT** (Ontology Foundry Training) **prefix to
> avoid any naming conflicts** with any similar types found in your ontology."

Object type API names are globally unique, so a prefix is how two ontologies
coexist. This is `apiNamespace` from `foundry.yml` showing up in the UI.

## 3 — The Ontology is a resource, and we have no such thing

The permissions aside carries the most structural sentence in the course:

> "In the top left corner of the Ontology Manager application, there is a
> **drop-down to select between different Ontologies** (if more than one is
> available). If you explore this drop-down, you may find an Ontology that you
> have permission to edit and that contains the rest of the Fresh Air (OFT)
> Ontology."

The screenshot shows it: **`Palantir (Unmarked) Ontology`** with a folder icon
below reading **`Palantir (Unmarked)`** — a *name* and the *folder it lives in*.
Below that the sidebar: **Discover**, **History**, then a **Resources** section
listing **Object types `9`** and **Properties**.

**Properties are a top-level resource of the Ontology**, listed beside object
types — not only a child of one. That is `shared_properties`, given its proper
place.

And on the object type's own Overview card there is a field reading
**`Ontology: zacht Ontology`**. An object type *belongs to* an Ontology.

> "Some organizations limit edits to the production Ontology via **Ontology
> Proposals**… you may need to create a **custom branch** for the steps below and
> seek approval from your organization's Administrator for merging in the
> changes."

**We have no `ontologies` table.** Object types hang off `organizations`. That is
the gap this reading exists to name.

## 4 — Every field on the object type Overview

From the screenshot, exhaustively.

**Application header:** `Ontology Manager` · search "Search resources… Ctrl+K" ·
**`189 edits`** · **Save** (green) · **New ▾**

**Left rail:** ← Discover · the type with its object count and a green ✓ ·
**Overview** · **Properties `27`** · **Security** · **Datasources** ·
**Capabilities** · **Object views** · **Interfaces** · *Materializations* (greyed)
· *Automations* (greyed) · **Usage** · **History**

**Title block:** icon · `[username] Flight Alerts` · a green ● (unsaved) ·
`Object type · 0 objects` · **`+ Add to group`**

**Metadata card** — the ● marks a field carrying an unsaved edit:

| field | value in the shot |
|---|---|
| Plural name ● | `[username] Flight Alerts` |
| Description | `Type here…` (with a translate icon) |
| Aliases ⓘ | `Add aliases…` |
| Point of contact ⓘ | `None` |
| Contributors ⓘ | `None` |
| Ontology | `zacht Ontology` |
| API name | `UsernameFlightAlerts` |

**Status card:**

| field | value |
|---|---|
| Status | `Experimental ▾` |
| Visibility | `👁 Normal ▾` |
| Edits | `Disabled` |
| ID | `username-flight-alerts` |
| RID | **`Set on save`** |

`ID` and `API name` are **different fields** — `username-flight-alerts` versus
`UsernameFlightAlerts`. And **the RID does not exist until the first save.**

**Properties card `27`** with `⊕ New`, each row a type icon then the name then
its designation chips: `99 Flight Alert Id [Primary key] ●` · `99 Alert Title
[Title] ●` · `99 Root Cause ●` · `12 Priority ●`. The icons encode base type —
`99` for String, `12` for Double.

**Action types card `0`** with `⊕ New`, empty with a gavel illustration.

**Bottom panel:** `[username] Flight Alerts ▾` · 🔍 · **Preview objects** ·
**Preview table ▾** — a live grid of the backing data with a type under each
column header (String, String, String, Double) and `null` visible in Root Cause.

## 5 — The creation wizard, step by step

> 1. **New > Object type**
> 2. **Use existing datasource** → **Select datasource** → search the dataset → **Next**
> 3. Name it; "**The Plural name should update accordingly**" → **Next**
> 4. Set **Primary key** and **Title** → **Next**
> 5. "**Skip creating any generic action types**"
> 6. Click the green **Create** button

Five steps, and step 5 is an offer: "Ontology Manager offers to create a generic
version of these when you create a new object type."

## 6 — Rows, columns and the gap between them

> "When you define a new **object type**, you are defining a kind of **blueprint
> or template**. This object type is backed by one or more datasources. This
> datasource is typically a dataset, but it could also be a **restricted view,
> virtual table**, etc."
>
> "**Each row** of data in the backing datasource will produce **one object**…
> **Each column typically maps to a property**. The **permissions a user has to
> the backing datasource(s) also determines whether they can see the
> corresponding object data.**"

The diagram states it three times over: *Dataset → object "type"*, *Row → object
instance*, *Column → object property*.

Then the qualification that makes objects more than a view over rows:

> "By using actions, it is possible for users to **create additional objects that
> do not exist in the backing datasource**. Users can also delete objects.
> Therefore, over time, **the mapping from rows to objects may not always exist
> for all rows**."
>
> "while datasource columns inform which object properties you have, they **do not
> always map 1-to-1 because object data is separate from datasource data**."

And the worked example: `root_cause` is all null, so

> "the Root Cause would have been a good candidate for an **edit-only property
> without a backing column**. However, creating an empty column as part of the
> data pipeline also works."

## 7 — Primary key and title, in the course's own words

> "Every object must have a **unique identifier that is consistent for the life of
> that object**… you must choose a column that will contain a **unique value for
> each row and that is never null**. **Strings are typically the best data type**."
>
> "you might derive a new column that **concatenates multiple columns** (and
> optionally hashes the result)… This must be a **deterministic repeatable
> process. You should never generate a random ID or GUID** for this purpose as
> part of a data pipeline, because, **if the pipeline is ever rerun, all of your
> object IDs will change.**"
>
> "Every object should also have a **Title**… the user-friendly and human-readable
> name of the object **in search results and in most Foundry applications**."

## 8 — Edits, and the conflict resolution nobody mentions in prose

The **Datasources** tab screenshot, which is where edits are configured:

**Backing datasource** — "Configure the backing datasource for this object type.
**The datasource is required, but can be changed.**" Shows `flight_alerts` with
its full Compass path, **✏ Replace**, `…`, and **`+ Add new backing datasource`**.

**Edits:**

| control | text |
|---|---|
| **Allow edits** ● (toggle ON) | "Disabling edits will not remove existing edits" |
| **Track user edit history** (toggle OFF) | "Logs user edits to objects of this type and displays those logs in Edit History widgets." |
| **Conflict resolution** | "Configure what values to keep for properties of this object type. **Resolution happens on a property-by-property basis.** Properties that have not received user edits will continue to use latest pipeline data. **Regardless of resolution, all values are still written.** **Edit-only properties without a backing column always use the latest user edit.**" |

That last cell is the whole object-storage model in four sentences: an object's
value for a property is **the pipeline's or the user's, decided per property**,
and *both are stored*.

## 9 — Object Storage: saving is not the end

> "Once you save, you'll see a little progress spinner… This indicates that
> Foundry is currently **building an index of all of your object data** for this
> object type in **Object Storage v2**."
>
> "**Only once this indexing pipeline completes successfully** will you be able to
> see your new objects in Object Explorer and other Foundry applications. Once
> it's done, you can refresh the page to see an object count in top left of your
> screen: *183,999 objects*."
>
> "If Foundry encounters any issues — **such as non-unique primary keys** —
> you'll be able to get to detailed job details and error messages from here."

The Datasources tab carries a **Replacement pipeline** — "Resync the data in the
backing stores using the latest object type definition" — drawn as three nodes:

```
▤ flight_alerts  →  ✓ Changelog  →  ⊘ Merge changes
```

**An object type is not live when it is saved. It is live when its index is
built**, and the index is a pipeline with its own status and failures.

## 10 — Link types have two ends, each separately named

From the screenshot:

**Join method** — two choices as buttons: **🔑 Foreign key** (selected) | **▤
Dataset**. "Choose the object types you wish to link, and the property to use as
a foreign key."

The mapping row: `Flight Alert ▾` / `99 Flight Id ▾` — **⇄** — `[OFT] Flight ▾` /
`99 Flight Id [Primary key]`.

Then **one section per direction**, and this is what we do not have:

| direction | sentence | API Name | Visibility |
|---|---|---|---|
| `Flight Alert → [OFT] Flight` | "Each `Flight Alert` has **one** `[OFT] Flight`" | `FlightAlert.` **`oftFlight`** `.get()` | `👁 Normal ▾` |
| `[OFT] Flight → Flight Alert` | "Each `[OFT] Flight` has **many** `Flight Alerts`" | `oftFlight.` **`FlightAlerts2`** `.all()` | `👁 Normal ▾` |

**Each end carries its own API name and its own visibility**, and the generated
accessor's suffix follows the cardinality: `.get()` for one, `.all()` for many.
A link type is not one name — it is two.

Rail for a link type: **Overview · Security · Datasources · Usage**. Status
`Experimental`, `ID username-flight-alert-flight1`, `RID Set on save`.

> "a **foreign key** property in one object type contains values that appear as a
> **primary key** value in another object type."

Cardinality is a modelling choice, not a fact about the data:

> "if you are modelling the relationship between an Airline and its Aircraft as
> 'present-day ownership', it would be **one-to-many**… if you are modeling
> ownership over time… then the relationship would be **many-to-many**."

## 11 — Action types

Created via **New > Action type**, and the wizard is:

> Select **Object** from among the available tabs (default) → Select **Object
> type** → Select **Modify object(s)** → **Add property > Root Cause** → name it →
> **Give yourself permission to execute this action**: switch to the **User** tab →
> **Create**

So the verbs are **Create / Modify / Delete object(s)**, and an action declares
**which properties it touches**. That declaration is the permission:

> "Because we've only defined one action that touches only the Root Cause
> property, **this is the only property that users can edit**."

Rail: **Overview · Rules · Form · Capabilities · Security & Submission Criteria ·
Automations**. Overview shows `Name`, `Description`, `Status`, **`API
username-assign-root-cause`** and **`RID ea08db6e-7355-d751-a37a-cc4a24ca4ebb`**
— a real RID this time, because it has been saved.

The **Action type overview** canvas draws the action as two boxes:

```
Input                          Rules
 ▪ [username] Flight Alert      ▪ Modify object
 ▪ 99 Root Cause                   ▪ [username] Flight Alert
                                   ▪ Modify Root Cause
```

> **Action Form** — "Every time you invoke this action from different contexts in
> Foundry, a **common input form** will collect the necessary input from a user."
> You can "rename input fields, assign default values, hide fields", or constrain
> a parameter "to a list of multiple choices that you either enter manually or
> **derive from a dataset**."
>
> **Submission Criteria** — "specify **who can invoke the action at all**."
>
> **Rules** — "you could add other rules that **send a Foundry notification**…
> **invoke a webhook** to call out to an external system, or **create and delete
> other objects**." Or "back your action **with a function**."

## 12 — Saving is a session, not a write

Every lesson ends with the same three clicks — **Save → Save to ontology → Save
changes** — and the header carries a running count (`189 edits`, `22 edits`,
`1 edit`). `mirror/ontology-manager/save-changes.md` gives the model:

> "Any changes you make in the Ontology Manager are stored locally in a
> **work-in-progress state**. For these Ontology changes to be available for
> others and reflected in user-facing applications, **you must save your
> changes**."
>
> "Open the **Review edits** dialog to review all your changes."
>
> "If the **Save** button is grayed out, you may have an **error** that is stopping
> you from saving… **While errors need to be handled in order to save, warnings
> will not prevent you from saving.**"
>
> "The Save button may also be grayed out if the Ontology has been **saved by
> another user** since you began… You will need to select **Update**… It is
> possible that there are **merge conflicts**… You can choose between keeping the
> changes in the latest version of the Ontology or **overriding them** with the
> changes in your working state."
>
> "**Each resource** in the Ontology that you edit will have **its own entry** in
> the Review edits dialog. You can **discard the changes you made to a resource**
> by hovering over the entry and selecting the trash icon."

Ours writes straight through. There is no working state, no review, no
errors-versus-warnings, and no merge.

---

# Implementation map

Ordered so each step is verifiable on its own. **Nothing here creates an object
type** — those come from client datasets, which is the point of building the
container first.

### S1 — The Ontology as a resource *(the gap this reading was written for)*

`ontologies` — name, api name, a **folder** it lives in (`projects`/Compass,
already RID-bearing), org, RID, description. Then `object_types.ontology_id`,
`link_types.ontology_id`, `shared_properties.ontology_id`, replacing the direct
`organization_id` reach where it stands in for containment.

Carries: the top-left picker, the `Ontology:` field on every type, and the
namespace that lets `[OFT] Flight` and `Flight` coexist. **Uniqueness of an
object type API name moves from per-org to per-ontology**, which is what the
course's `OFT` prefix is working around.

### S2 — The edit session

`ontology_edit_sessions` + `ontology_edits` (one row per resource touched, with
its before/after). The header count, the Review edits dialog, per-resource
discard, and **errors block the save while warnings do not** — `ontology_violations()`
already computes both, so this is where its two severities land.

Then `save_object_type` (409) stops being a direct write and becomes an edit
against the open session; the save applies the batch in one transaction.

### S3 — Optimistic concurrency

`ontologies.version`, bumped on save. A session opened against version *n*
refuses to apply at *n+1* and asks to **Update** — the "saved by another user"
path, and the merge-conflict resolution that follows it.

### S4 — Object type metadata to completion

`plural_label`, `aliases text[]`, `point_of_contact`, `contributors`, `groups`,
and **`id` as a field distinct from `api_name`** (`username-flight-alerts` vs
`UsernameFlightAlerts`). Plus `edits_enabled`, `track_edit_history`.

### S5 — Link ends

`link_type_ends` — two rows per link type, each with `api_name`, `visibility`,
and its cardinality side. Replaces the single `api_name` on `link_types`. The
`.get()` / `.all()` suffix is derived, never stored.

### S6 — Action types

`action_types` (name, api name, RID, status), `action_type_rules` (verb ∈
create/modify/delete, target object type, touched properties), `action_type_parameters`
(the Form), and submission criteria. **An action's declared property set is the
edit permission** — that sentence is the whole design.

### S7 — Object storage *(O3, and it depends on S6)*

The instance table per object type, `edits_enabled`, per-property conflict
resolution (pipeline value and user edit **both stored**, one chosen per
property), and the index build with its status, object count and failures —
non-unique primary keys being the named one.

---

## Open questions

1. **Is an Ontology inside a Project, or beside one?** The picker shows a folder
   under the name, and `rid-grammar` established a project *is* a folder. So an
   Ontology plausibly lives in a Compass folder like any resource — but no page
   read so far states an Ontology's RID form. Worth settling before S1.
2. **Ontology Proposals / branches** are named but not covered by this course.
   `pipeline-builder/branches-*` (6 pages) describes the mechanism for pipelines;
   whether the Ontology reuses it is unread.
3. **Capabilities** and **Object views** are rail entries in every screenshot and
   neither is explained here.
4. **`Materializations`** is greyed for this type — presumably needs something we
   have not built. Unread.
