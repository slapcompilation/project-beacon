---
verify: strict
---

# Ontology cleanup (Phase F2)

**Pages read:** `ontology-manager/cleanup` in full, with all seven of its images
parsed field by field.

**Read on the second pass (2026-08-19), because all four open questions were answered in the corpus after all:** `ontology-manager/view-usage` in full — the page that defines what usage *is* — plus the remaining cleanup images.

**Named here but NOT read for this reading:** `ontology-manager/overview` (the
tool is reached from it), `object-link-types/osv1-osv2-migration` (named by the
last flag; the OSv1/OSv2 split is already settled in
`readings/osv2-migration.md`). Nothing below rests on a sentence of either.

**Why now.** Phase F is the only phase left open, and F2 is the part the build
map calls directly buildable. Three readings already cite this page in passing;
none read it.

---

## 1. What the tool is

> "The Ontology cleanup tool is a safe way to delete object types"

and the framing is worth keeping, because it is not a linter:

> "The tool aims to help Ontology editors determine the safety of deleting an object type and provides a deprecation option which informs object type users of its future removal."

It asks whether a type is probably dead and safe to remove — a different
question from `ontology_violations()`, which asks whether one is malformed. An
object type with no description is not broken. That distinction is the whole
reason this is a second mechanism and not more rows in the existing one.

---

## 2. The three verbs, and only one of them is new

> "**Snooze:** Hide object types from your cleanup queue for a configurable amount of time. Snoozing is an action that will affect only the user that performs it."

> "**Deprecate:** Show object types as deprecated in every context that displays object type status. This option informs users to move to different object types or flag that the object type is still useful. You can set a deadline along with a deprecation so users know how long they have to refrain from using these object types."

> "**Delete:** Delete object types from the Ontology and remove associated data from object storage."

**Deprecate and Delete already exist here.** `object_types` carries the
`deprecated` status with a reason and a deadline, and deletion is deletion. What
this page adds to them is *where they are reached from*, not what they do.

**Snooze is the only new state**, and it is per-user:

> "Once you act on an object type in your queue, it disappears from the queue. Use the table filters to view all the actions you have already selected."

---

## 3. Staging is not this tool's problem

> "Deprecation and deletion are staged the same way as normal Ontology modifications."

> "Selecting **Save** in the top right enables saving the changes directly to the Ontology or creating a proposal to request review from another user."

`cleanup-staging-example.png` shows it is the *same modal* as any other ontology
edit, not a cleanup-specific one:

> Review edits · Propose your changes · Selecting this will create a Branch with your Ontology changes and a draft Proposal to approve those changes. Open the Branch to view and add edits. Once all edits are approved, merge the Proposal.
> — ontology-manager/images/cleanup-staging-example.png

with the tab row `All edits (59) · Warnings · Errors · Migrations · Conflicts`
and a `Discard` / `Save to ontology` pair. The three object types in the example
carry their outcomes inline — `[Planning] Work Item` with `57 edits`, and
`[Planning] OOTO` and `[Planning] Support schedule` each badged `Deleted`.

That matches the prose's own worked example, where Work Item "has objects with
user edits, so it can be deprecated, while the other two deleted".

**So Phase D built this half already.** Cleanup needs no staging of its own.

---

## 4. The flags — and the image lists one the prose does not

The prose gives six. `cleanup-configuration-view.png` shows **seven toggles**,
and the page tells you to expect that:

> "The following list of flags is aimed at answering common issues, but is not exhaustive:"

The seven, with the defaults the image shows:

| flag | priority | default | parameter |
|---|---|---|---|
| No registered usage in 30 days | High | on | — |
| Past deprecation date | High | on | — |
| Trashed datasource | High | on | — |
| Phonograph deindexed | High | on | — |
| Datasource not updated in 90 days | Medium | on | days, `90` |
| Description missing | Low | **off** | — |
| Display Name regex matches | Low | **off** | regex, `\[test\|deprecated\]` |

> No registered usage in 30 days · Past deprecation date · Trashed datasource · Phonograph deindexed · Datasource not updated in 90 days · Description missing · Display Name regex matches
> — ontology-manager/images/cleanup-configuration-view.png

**`No registered usage in 30 days` appears in no sentence anywhere.** It is the
highest-value flag in the list — nothing having used a type in a month is the
most direct evidence it is dead — and it exists only as a toggle in a
screenshot. It is also the one flag that needs an index of *usage*, which is
F3's job, so the image quietly establishes that F2 and F3 are coupled.

The prose defines the six it does list:

> "**Past deprecation date:** Object type currently has the `deprecated` status and the deprecation date field is in the past."

> "**Trashed datasource:** Any datasource (whether dataset, restricted view, or other) backing this object type has been trashed in Compass."

> "**Datasource not updated in \[x] days:** Checks with Compass the time of the last modification to the backing datasource."

> "**Description missing:** The object type has a blank description. Does not check for descriptions on all properties of the object type."

> "**Display name regex matches string:** The default value of `\[test|deprecated\]` would match object types that have `[test]` or `[deprecated]` in their display names."

> "Supports ECMA (JavaScript) regex syntax."

And rules the last one out for us, in its own words:

> "**Phonograph deindexed:** Flag only applied to object types in Object Storage v1. There is no equivalent check for Object Storage v2."

---

## 5. Priority is a three-value enum, and only the image says so

The prose says the queue is ordered by priority and never gives the values:

> "By default, the table is sorted by the highest priority among the flags that an object type triggers."

`cleanup-configuration-view.png` shows every flag carrying a `Priority` dropdown
reading **High**, **Medium** or **Low** — five High/Medium and two Low in the
default set. So *highest priority among the flags an object type triggers* is a
`min()` over a three-value ordering, not a numeric rank.

---

## 6. Configuration is per-user, and it is a choice of two modes

> Choose cleanup configuration · Optimized for usage [Default] · Recommended flags for usage optimization · Custom · Choose custom flags to use
> — ontology-manager/images/cleanup-configuration-view.png

> "You can configure flag settings on this page, with a choice of using either the default set or custom flags."

> "Like snoozing object types from the queue, this is an individual customization that does not affect other Ontology editors."

Two consequences the page states outright:

> "When you save changes and return to the main **Cleanup** tab, you will be prompted to recalculate the cleanup queue."

> "Note that if using a custom flag setup, new flags that get added in the future will not be automatically turned on if they are turned on when using the default set of flags."

That second sentence is the reason the two modes cannot collapse into "a row per
user per flag": **the default set has to stay a live reference, not a copy**, or
a new flag never reaches anyone who once clicked Custom. And the image adds the
consequence of saving:

> Saving changes to flag settings will reset previous Cleanup results.
> — ontology-manager/images/cleanup-configuration-view.png

---

## 7. What the images add that the prose does not

Beyond the seventh flag and the priority values, `cleanup-configuration-view.png`
carries the Ontology Manager left nav with live counts, which places this work
among its siblings: `Object types 6,305 · Link types 4,218 · Action types 6,600
· Shared properties 23 · Interfaces 6 · Functions 4,694 · Health issues 1,969 ·
Cleanup 5,632`, then `Flag settings` nested under Cleanup, then `History` and
`Advanced`. **Semantic search** sits above them carrying a beta flask.

Two things follow. **Cleanup carries a count like every other section** — 5,632
candidates out of 6,305 object types — so the queue is a first-class list, not a
report. And **Health issues is a separate section with its own count**, which is
further evidence that "malformed" and "probably dead" are two lists in Foundry,
not one.

---

## Decisions

1. **This is a second mechanism, not more rows in `ontology_violations()`.** That
   function answers "is this malformed"; cleanup answers "is this probably dead,
   and is it safe to remove". A blank description is not a violation. Foundry
   draws the same line by giving Health issues and Cleanup separate nav entries
   and separate counts.
2. **A flag registry with its published defaults**, as
   `derived_aggregations()` and `action_rule_kinds()` are: name, priority,
   default-on, and whether it takes a parameter. Six of the seven; see 4.
3. **`Phonograph deindexed` is NOT built**, on the page's own authority — "Flag
   only applied to object types in Object Storage v1. There is no equivalent
   check for Object Storage v2." We are OSv2. Building it would mean inventing
   the check the page says does not exist.
4. **`No registered usage in 30 days` is registered and NOT computable yet.** It
   needs the usage index that is F3, so it takes the treatment
   `create_or_modify_object` and the interface rule kinds already have:
   expressible, listed, refused at evaluation with a stated reason. Leaving it
   out entirely would hide the strongest signal in the tool; pretending to
   compute it would be worse.
5. **Priority is `high|medium|low`**, and the queue sorts by the highest a type
   triggers — a min() over the ordering, not a number.
6. **Per-user configuration is (mode, overrides), not a row per flag.** Mode is
   `default` or `custom`; overrides only exist in custom mode. The page's own
   warning forces this: under the default set a future flag turns on
   automatically, under Custom it does not. Copying the defaults into rows would
   silently convert every user to Custom.
7. **Snooze is per-user with an expiry**, and is the only genuinely new state.
   Deprecate and Delete already exist on `object_types`.
8. **Staging is reused, not rebuilt.** "Deprecation and deletion are staged the
   same way as normal Ontology modifications", and the screenshot is the same
   Review edits modal Phase D built. Cleanup writes through branches and
   proposals or directly, exactly as any other edit does.
9. **BUILT (578), after two recitations.** The second was worth it: the first
   named F3 as the blocker for `no_registered_usage`, and the second replaced it
   with the Ontology metrics ledger, which is different work entirely.

   `cleanup_flags()` carries all seven with their published priorities, defaults
   and parameters; five compute, two are registered and refused with their own
   reason. `cleanup_configurations` is (user, ontology, mode) with
   `cleanup_flag_overrides` beside it, `cleanup_snoozes` is per-user with an
   expiry, and `cleanup_candidates` is the stored queue with `computed_at` on
   the configuration. A settings change deletes the results and nulls
   `computed_at`, because Foundry prompts to recalculate rather than doing it
   silently.

   **One thing the build sharpened.** Splitting the reset into two trigger
   functions rather than one branching on `TG_TABLE_NAME` is not style: plpgsql
   resolves a record's fields at runtime whichever branch is taken, so a single
   function naming both `NEW.configuration_id` and `NEW.id` fails on whichever
   table lacks the other's column.

## Questions — all four answered on the second pass, kept for the trail

1. **What counts as "registered usage"?** The flag exists only as a toggle
   label. Whether it counts reads, Workshop module references, function calls or
   all of them is unstated, and the Dependents section (F3) lists *kinds* of
   dependent without saying what registers one. `blocks:` the flag being
   computable.
2. **Is priority per-user or global?** The dropdowns sit on the per-user Flag
   settings page, which implies per-user, but the page only says snoozing and
   the flag *choice* are individual. `blocks:` nothing — treated as part of the
   same per-user configuration until contradicted.
3. **Does the queue recalculate on demand or on a schedule?** Being prompted to
   recalculate implies on demand rather than continuous, and the warning that
   the tool "may take time to find cleanup candidates based on the size of your
   Ontology" implies it is expensive enough to persist. Whether results are kept
   between visits is not stated.
   `blocks:` whether the queue is a view or a table.
4. **What does Delete do about dependents?** The tool's whole purpose is
   determining "the safety of deleting an object type", but no flag checks
   whether anything still points at it — the flags are all about staleness, not
   references. That is F3's index again. `blocks: nothing` — the deletion path
   already exists.

---

## 8. The four questions, answered (second pass, 2026-08-19)

All four were answerable. Three from a page this reading had not opened, and one
from the images it had.

### 8.1 "Registered usage" is defined precisely, on its own page

`ontology-manager/view-usage` — titled **Ontology metrics** — defines every term
the cleanup flag leans on:

> "**Reads:** A read is recorded when an application loads objects for a specified object type. This can include displaying objects in a table in Workshop, returning all objects from search for a given object type, aggregating a property on an object type, and so on."

> "Note that one read represents one load request from [Object Storage v1 (Phonograph)](/docs/foundry/object-databases/object-storage-v1/) or the Object Set Service (OSS). Many objects loaded or aggregated at once will only be recorded as a single read. Also note that any object type or link type usage happening in Ontology Manager is not included."

> "**Writes:** A write is recorded when an application makes edits to objects of this type as the result of an [Action](/docs/foundry/action-types/overview/), [Function](/docs/foundry/functions/overview/), Foundry Form, direct Object Explorer edit, or API call."

> "**Interactions:** The total number of reads and writes on objects of this type over the last 30 days."

> "**Active users:** The number of unique user IDs that triggered the reads and writes recorded over the last 30 days."

Three things that a design would otherwise have to guess:

* **A read is a REQUEST, not an object.** "Many objects loaded or aggregated at
  once will only be recorded as a single read." So this is a counter on the
  query path, not a row per object touched.
* **Ontology Manager's own traffic is excluded** — otherwise browsing the
  cleanup queue would keep every object type looking alive.
* **30 days is the window everywhere**, which is exactly the cleanup flag's
  window. The flag is `Interactions = 0 over 30 days`.

**And it is off unless an administrator turns it on:**

> "Usage on the **Overview** tab and detailed usage metrics in the **Usage** tab are configured from the **Ontology settings** tab in Control Panel using the **Ontology metrics** toggle. This toggle can only be enabled or disabled by Ontology administrators and changes may take up to 60 minutes to take effect in Ontology Manager."

> "If you see “No usage for the last 30 days” in the usage graph when you would expect to see usage statistics, then it is possible that internal tables may not have been configured."

That warning is the hazard in one line: **when metrics are off, every object type
looks unused**, and a flag reading "no registered usage" would flag the entire
ontology. Foundry's answer is that the flag is a toggle and the data is opt-in.

### 8.2 The blocker is a usage ledger, not the Dependents index

This reading previously said the flag needed the usage index that is F3. **That
was wrong, and the two are different mechanisms.** F3's Dependents section counts
*resources that reference* an object type — Workshop 9, Function 2, and so on.
Usage counts *requests* — reads and writes over 30 days. A type can have nine
Workshop modules pointing at it and zero reads.

`cleanup-filter-example.png` settles it from the queue side: the table has a
**READS** column, showing `1`, `1` and `43` for the three example types — and the
one with 43 is the one the prose deprecates rather than deletes. Cleanup consumes
usage metrics directly.

### 8.3 Priority is per-user, by construction

The `Priority` dropdown lives on the per-user **Flag settings** page, and a row's
priority is the highest among the flags it triggers. `cleanup-filters.png` shows
the filter panel offering `High · Medium · Low` as a Priority facet. Since the
values are set per user and the row value is derived from them, priority is
per-user without the page needing to say so.

### 8.4 The queue is computed on demand and stored

Four statements agree, and the counts in the images are the proof:

> "When you opt to **Start cleanup**, the tool may take time to find cleanup candidates based on the size of your Ontology."

> "When you save changes and return to the main **Cleanup** tab, you will be prompted to recalculate the cleanup queue."

> Saving changes to flag settings will reset previous Cleanup results.
> — ontology-manager/images/cleanup-configuration-view.png

The nav carries `Cleanup 5,632` beside `Object types 6,305` — a stored count, not
a figure recomputed on every render — and the header reads `Object types
5,632/5,633` under a filter. Results are **materialised, invalidated by a flag
settings change, and recalculated on request.**

### 8.5 The filter panel only lists the flags that are ON

`cleanup-filters.png` offers five flags to filter by, each with a count and a bar:

> No registered usage in 30d 3167 · Past deprecation date 16 · Trashed datasource 112 · Phonograph deindexed 735 · Datasource not updated in 90d 5035
> — ontology-manager/images/cleanup-filters.png

**Description missing and Display Name regex are absent** — the two that ship
toggled off. So the queue evaluates only enabled flags, and the filter facets are
built from the same set. It also lists an **Actions** facet with `Snoozed 1`,
which is where "Use the table filters to view all the actions you have already
selected" lands.

### 8.6 Cleanup does not check dependents, and does not need to

No flag asks whether anything still points at the type. That is not an omission:
deletion is "staged the same way as normal Ontology modifications", and the
Review edits modal carries `Warnings · Errors · Migrations · Conflicts` tabs.
Whatever refuses an unsafe deletion refuses it there, for every deletion, not
only ones reached through cleanup. The safety signal cleanup itself contributes
is the READS column.

## Decisions, revised by those answers

1. **Decision 4 is replaced.** `No registered usage in 30 days` is not blocked on
   F3. It is blocked on **Ontology metrics** — a reads/writes ledger with a
   30-day window, defined by `view-usage`, which is its own piece of work and has
   its own Control Panel toggle in Foundry. Registered-and-not-computable still
   stands; the reason and the unblocking work both change.
2. **A read is a request-level counter**, incremented on the object-read path,
   with Ontology Manager's own traffic excluded. Anything per-object would be a
   different number from Foundry's.
3. **The flag must be off when metrics are off.** "When metrics are off, every
   object type looks unused" is a way to flag an entire ontology for deletion.
   Whatever computes it has to distinguish *no usage* from *no usage data*.
4. **Priority is per-user**, carried with the rest of the per-user flag
   configuration.
5. **The queue is a stored table, not a view**, recalculated on request and
   invalidated when flag settings change — which also means it needs an
   `is_stale` notion, because Foundry prompts rather than recomputing silently.
6. **Only enabled flags are evaluated**, and the filter facets derive from the
   same set rather than from the registry.

---

## The three images I claimed and had not opened (2026-08-20)

This reading's header says `ontology-manager/cleanup` was read "in full, with all
seven of its images" parsed. I had parsed four. The three below are the ones I
asserted and skipped, found by auditing my own coverage claims after being
pulled up for describing a skipped image as one nobody had read. There is no
nobody; every reading here is mine.

They are not navigational filler, which is presumably the assumption that let me
skip them. Two of them carry the page's own definition of what Cleanup is, and
all three carry a sidebar inventory that differs from the one
`home-and-navigation.md` recorded.

### `cleanup-start-cleanup-button.png` — the empty state, and the definition

> Ontology Cleanup … Cleanup helps you identify and manage ontological resources that may no longer be useful. … Cleanup indicates which of the ontological resources are likely safe to deprecate or delete based on a number of checks. Once flagged you can decide the most appropriate way to handle resources individually or in bulk. … Start cleanup
> — ontology-manager/images/cleanup-start-cleanup-button.png

Two things follow. The page's title is **Ontology Cleanup**, not "Cleanup". And
"individually or in bulk" is the sentence behind the toolbar: the verbs act on a
checkbox selection, which is why the table has a select-all in its header.

### `cleanup-configuration-navigation.png` — the table I built differently

The candidate table's columns here are **NAME · PRIORITY · FLAGS · SNOOZED**,
with a **gear** at the right of the header row, and a toolbar reading
**Snooze · Deprecate · 🗑** beside a `1 Filter ✕` chip.

`cleanup-filter-example.png`, which I did parse, shows **NAME · GROUPS ·
PRIORITY · FLAGS · READS · ACTION**. Two captures, two different column sets,
and a gear in the header of one: **the columns are configurable**. Neither
capture is the shape; the gear is.

What ours is missing, recorded rather than fixed in this pass:
- a **SNOOZED** column — we store the snooze and never show it;
- **Deprecate** and delete as toolbar verbs. This reading decided they route to
  the object type because "deprecation and deletion are staged the same way as
  normal Ontology modifications". That decision stands — but the verb still
  belongs in the toolbar, staging rather than acting, and ours has only a
  sentence telling the user to go elsewhere.

### The sidebar, in all three, and it is not the one already recorded

> Overview … Semantic search … Object types 306 … Link types 117 … Action types 266 … Shared properties 14 … Interfaces 9 … Functions 4,531 … Health issues 79 … Cleanup … History … Advanced
> — ontology-manager/images/cleanup-start-cleanup-button.png

Against `home-and-navigation.md` §6.3's inventory this one **adds** `Semantic
search`, `History` and `Advanced`, and **omits** `Proposals`, `Properties`,
`Groups`, `Value types` and `Ontology configuration`. Two real captures of the
same sidebar disagreeing means the entry list is not fixed — it varies by
enrollment or by what the ontology has.

Three details worth keeping:

1. **`Health issues` sits directly above `Cleanup`, carries a heartbeat icon and
   a count (78, then 79).** I built exactly that in #696 — icon `pulse`, a count,
   above Cleanup — by inference from a different screenshot's grouping. Here is
   the direct evidence, in an image I had already claimed to have read.
2. **`Cleanup` carries a count too** when there are candidates (`Cleanup 3` in
   `cleanup-configuration-navigation.png`, bare on the overview where there are
   none). Ours has no count on that row.
3. **A `Select branch / Main / Default` control sits at the top of the sidebar**,
   not in the top bar. Recorded, not adopted: our branch control is in the top
   bar and `home-and-navigation.md` §6 has it there from its own screenshot.

### `cleanup-navigation-from-homepage.png` — the Overview page

> Welcome to the Ontology … Build and manage your organization's digital twin
> — ontology-manager/images/cleanup-navigation-from-homepage.png

Four stat cards (Object types, Link types, Action types, Functions), each with a
**+ New …** footer, over a **Recently viewed object types** panel with its own
gear, whose rows carry the type's icon, its name, and its **group tags**. Cleanup
is reached from the sidebar, not from this page — which is all the file name
promised, and about a tenth of what the image contains.

