---
verify: strict
---

# Ontology cleanup (Phase F2)

**Pages read:** `ontology-manager/cleanup` in full, with all seven of its images
parsed field by field.

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
9. **Not built from this reading yet.** These Decisions want reciting first.

## Questions

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
