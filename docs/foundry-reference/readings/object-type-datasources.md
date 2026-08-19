---
verify: strict
---

# What backs an object type — the datasource layer, read from the API and the MDO page

**Pages read:** `api/v2/ontologies-v2-resources/object-types-get-object-type`
in full (616 lines — the response schema for a full object type), and
`object-permissioning/multi-datasource-objects` in full including both images.

**Why these two together.** The api page is the first reading written from the
`api/` corpus at all. It publishes what the prose omits: every field of an
object type and a property, with their enums and required-ness. The MDO page is
the only prose page that describes *more than one* datasource on a type, and it
carries the rule the api cannot state — a numeric limit with an exclusion.

This reading found one falsification of shipped code, two gaps, and six
corroborations. The corroborations matter as much as the gaps: they are the
first time the base type vocabulary and the property status vocabulary have been
checked against a specification rather than inferred from prose and screenshots.

---

## 1. The falsification: our 70-datasource counter counts the wrong rows

> "Object types are limited to a maximum of 70 datasources. Only datasources that are synced to object storage count towards this limit, so it does not include media sets or time series syncs."

— `object-permissioning/multi-datasource-objects.md`

`guard_object_type_datasource` counts every row in `object_type_datasources`
for the object type. Until migration 585 that was correct, because every row was
a dataset or a restricted view. 585 added the media set view as a third arm of
`one_backing` — and the counter has been counting media sets ever since.

The bug is small in effect and exact in kind: **a limit whose scope the page
states, applied to a set the page excludes.** It is also the third rule in that
one function written when there was only one datasource kind: 585 had to skip
the organization check and the MAP-column check for media datasources, and this
one was missed because it reads no column that distinguishes the kinds.

**Decision 1.** The counter counts rows that are synced to object storage —
today, `media_set_rid IS NULL`. When a time series sync datasource is added it
joins the exclusion, and the predicate is written so that is a one-line change.

---

## 2. The gap the API states outright: an icon has a colour

> "A union currently only consisting of the BlueprintIcon (more icon types may be added in the future)."

and its single member:

> "A hexadecimal color code."

> "The [name](https://blueprintjs.com/docs/#icons/icons-list) of the Blueprint icon. Used to specify the Blueprint icon to represent the object type in a React app."

— `api/v2/ontologies-v2-resources/object-types-get-object-type.md`, where
`color` and `name` are both marked `string · required`

`object_types.icon` is a single `text`. **The colour is not stored**, and both
halves are required in the API — an object type cannot round-trip through the
get-object-type endpoint without one.

Two things follow beyond the missing column.

**It is a union, not a string.** "More icon types may be added in the future"
is the page telling us the shape is a discriminated union whose only member
today is `blueprint`. Storing two columns models today's single member; storing
a discriminator models the union. The page anticipates a second member but does
not name one, so a discriminator now would be a column with one legal value and
no reader.

**And it is the API confirming Blueprint from inside the Ontology.** CLAUDE.md
justifies Blueprint from `slate/concepts-styles.md` — "Slate is built on top of
the Palantir open source Blueprint framework" — which is a statement about one
application. This page says the *object type's own metadata* names a Blueprint
icon to represent it in a React app. The icon names in `object_types.icon` are
Blueprint icon names because Foundry's are.

**Decision 2.** Add `icon_color text` with a hex-code CHECK, defaulted to
Blueprint's `#2D72D2`. No discriminator: one union member, one shape, and the
page names no second.

---

## 3. The gap the images state: each datasource maps the primary key

> "The **Map primary key** helper will appear and prompt you for a column with values matching the primary key of the object type. Once you choose a column, multiple backing datasets will appear under the **Backing datasource** section."

— `object-permissioning/multi-datasource-objects.md`

This is the join key. A column-wise MDO is

> "A join-like MDO case where distinct subsets of properties for an object type can be integrated from different datasources."

and a join needs a key on both sides.

Our shape cannot express it. A property carries one `datasource_id` and one
`backing_column`; the primary key property therefore names its column in exactly
one datasource, and a second datasource has no way to say which of its columns
carries the same key. The FAQ states the requirement from the other side:

> "This means that a specific property of an object type must come from one—and only one—of the input datasources (except for the primary key property, which must exist in every input datasource to join all datasources)."

**The parenthesis is the whole rule.** Every other property belongs to one
datasource; the primary key belongs to all of them. So it is not a property
attribute at all — it is a datasource attribute, one column name per datasource.

**What the images add.** In `multi-datasource-objects-add-new-datasource.png`
there is one datasource and the object type's status dot is a green tick. In
`multi-datasource-objects-backing-datasources.png` there are two, and the same
dot is a **red error**, with the top bar reading "25 edits" beside a red badge
"1". The prose never says adding a datasource can put the type in error. The
pair of screenshots says it: a second backing datasource whose mapping is
incomplete is a *problem on the object type*, surfaced in the save session, not
a rejected edit. That is exactly where `ontology_violations()` belongs rather
than a constraint — the type is saveable and wrong, and the editor is told so.

Both images also show two panels the prose does not mention, between the
datasource list and the bottom of the page: an **Edits** panel whose single
control is a toggle reading "Allow end users or applications to make edits to
objects of this type" (off in both), and an **Object Storage V2** panel
described as the backend service that stores and serves information about
objects, listing a single row for the default object data store whose two
status fields read `Data: Indexing not started` and `Schema: Up to date`,
above an **Add new data store** button.

— `object-permissioning/images/multi-datasource-objects-backing-datasources.png` We already hold the Edits toggle as
`object_types.edits_enabled`; the data store list is the OSv2 indexing state,
which we hold as the indexing functions rather than as a per-type list.

**Decision 3.** `object_type_datasources.primary_key_column text`, required for
the kinds that are joined (dataset, restricted view) and null for media sets,
which bind properties directly and have nothing to join. The *presence* of the
column is a CHECK; whether it names a column the dataset actually has is an
`ontology_violations()` row, because that is a fact about the dataset's current
schema and it can go stale without anyone editing the ontology.

**Decision 4.** A second datasource on a type is legal the moment it is added.
The incompleteness is reported, not refused — the images show the type in error,
not the edit rejected.

---

## 4. The datasource union: ten kinds, and what "unsupported" tells us

The datasource definition is a union of ten members:

    dataset · table · stream · restrictedView · mediaSetView
    timeSeries · geotimeSeries · direct · editsOnly · unsupported

We have three: dataset, restrictedView, mediaSetView. Six real kinds are
unbuilt, and the tenth is not a kind at all:

> "A datasource of a kind not yet exposed in the public API. The `unsupportedType` discriminator supplies the underlying OMS variant so callers can recognize known but unmodelled cases (e.g., derived properties)."

**`unsupported` is the adapter admitting the API is narrower than OMS** — the
same scope split the `actions-on-interfaces` reading found in the logic-rule
union, stated here in the schema itself rather than inferred from an absence.
And it names our own case: derived-properties datasources. Migration 576
modelled a derived property as `source = 'linked_objects'` with **no**
datasource. OMS models it as a datasource that backs those properties. Both are
records of the same fact; ours is the one the authoring page describes, and the
API says its own shape here is not published. **Inference, recorded and not
acted on:** a derived-property datasource row would only be needed if something
wanted to ask "what backs this property" uniformly, and nothing does yet.

Of the six unbuilt kinds one stands out:

> "An object type datasource that is not backed by any external Foundry resource. All properties on the object type can only be populated via Actions. Other datasources have edit only *properties*, which are permissioned to the backing tabular datasource. This datasource has no backing tabular datasource and is a true edit only object type. Note that this datasource type is incompatible with any other datasource and all the properties on the object type are backed by it."

CLAUDE.md's standing statement is that "the ontology has no way to hold an
object yet". **That kind is the Foundry shape in which the ontology itself
holds them** — no dataset, every property written by Actions. It carries its own
constraint, stated twice in three sentences: incompatible with any other
datasource, and it backs *all* properties.

**Decision 5.** Not built here. It is the right next phase and it is a phase,
not a column: it needs the object instance store, and the guard that a type
carrying it has exactly one datasource. Recorded as the open question this
reading answers for whoever opens it.

---

## 5. Six corroborations, and why they are worth writing down

Nothing changed for any of these. Each had been inferred from prose or a
screenshot and is now checked against a specification.

**5.1 The 22 base types are exactly the API's data-type union.** Ours:
`string integer short date timestamp boolean byte long float double decimal
vector array struct media_reference time_series geotemporal_series attachment
geopoint geoshape marking cipher`. The union: `date struct string byte double
geopoint geotimeSeriesReference integer float geoshape long boolean cipherText
marking attachment mediaReference timeseries array short vector decimal
timestamp`. Twenty-two each, and the mapping is total — `geotemporal_series` is
the geotime series reference, `cipher` is the cipher text, the rest are
spellings. The vocabulary the whole ontology rests on is right.

**5.2 A property's status is four, and `example` is defined.** The union
carries deprecated, active, experimental and example:

> "The status to indicate whether the PropertyType is either Experimental, Active, Deprecated, or Example."

— our exact four. And `example` finally has a definition rather than a name:

> "This status indicates that the PropertyType is an example. It is backed by notional data that should not be used for actual workflows, but can be used to test those workflows."

**5.3 A deprecation must carry a message and a deadline.** On the deprecated
member, `message` and `deadline` are both marked `string · required`, with
`replacedBy` optional. `object_type_properties_deprecation_documented` requires
reason and deadline and leaves `replaced_by` free. Identical.

**5.4 The API's edit-only mapping is our `user_input`.** A property's mapping is
a union of struct, column and edit-only, the last being:

> "A property on an object type that is permissioned to a tabular datasource, but the contents are only populated through Actions."

Our CHECK: `source = 'user_input' AND backing_column IS NULL AND datasource_id
IS NOT NULL`. Permissioned to a tabular datasource is the non-null
datasource_id; no backing column is the null. The clause was written from the
authoring page; the API states the same two conditions.

**5.5 One property, one datasource.** Property multiplicity is

> "currently not supported"

so a single `datasource_id` column on the property is the right shape, and it
stays a column rather than becoming a table.

**5.6 `visibility` is `NORMAL PROMINENT HIDDEN`** on both the object type and
the property, matching what we hold.

The one mapping member we do **not** hold is `struct` — a column plus a map from
the backing column's struct field names to the struct property's fields. We have
`struct` as a base type with no field mapping. Recorded, not built: nothing
reads a struct property's fields yet.

---

## Decisions

1. The 70-datasource limit counts only datasources synced to object storage —
   media sets are excluded, and time series syncs when they exist. Fixes a
   regression introduced by 585.
2. `object_types.icon_color text`, hex CHECK, default `#2D72D2`. No union
   discriminator: one member, one shape.
3. `object_type_datasources.primary_key_column text` — an **override**, null on
   media sets by CHECK and null elsewhere when the primary key property's own
   backing column already answers. The effective key is `COALESCE(the
   datasource's, the key property's)`, and whether that column exists in the
   datasource's live schema is `ontology_violations()`.
4. An incomplete second datasource is a violation, not a rejected edit — the
   images show the object type in error while the edit stands. Asked only of a
   type with more than one datasource, because that is when a property's
   silence about which one it came from stops being an answer.
5. The edits-only datasource is not built. It is the documented shape for an
   ontology that holds its own objects and it needs an instance store, not a
   column.

## What building it changed (586–588)

Decisions 3 and 4 are not what was recited. Both were corrected by running the
thing, and both corrections came from a decision this repo had already taken:

**The primary key property points at no datasource, on purpose.** 586 asked
which datasource the key property names, and reported the one real object type
in the ontology. Migration 408 had already answered, citing the same
sentence: `datasource_id` is "NULL on the primary key, which *must exist in
every input datasource*". The key belongs to all of them, so the question has no
answer by construction. 587 made `primary_key_column` an override and turned the
check into the page's actual rule — the key column, however spelled, is present
in every input datasource — which is stronger than what was recited.

**A null `datasource_id` on an ordinary property is also an answer, when there
is only one datasource.** 586's third arm fired on six suites. 545 had written
the converse down: it backfilled `datasource_id` "only where the choice is
unambiguous ... we never guess between them". 588 restricted the arm to types
with more than one datasource, which is also where the screenshots put it.

**And `ontology_violations()` is not only a linter.** `save_working_state`
refuses a save that *introduces* a violation (426), comparing against the set
that existed before. So an arm written too wide does not produce noise — it
blocks the save. That is worth knowing before adding a fifth arm.

The 70-limit fix was verified by making the old counter fail: with 69 synced
datasources and one media set view, 585's counter reports 70 and refuses the
seventieth synced one; 586's reports 69 and accepts it. `datasourceMapping.test.ts`
holds that boundary, because a rule about a limit is untested anywhere else.

## Questions

1. **What is the default icon colour?** `#2D72D2` is Blueprint's blue3 and its
   default primary-intent colour, and the object-type screenshots in the mirror
   show a blue cube. That is inference from the palette and the screenshots, not
   a statement on any page.
2. **Does a media set datasource count toward any limit?** The page excludes it
   from the 70 and names no other. Assumed unlimited.
3. **What backs a `table` datasource, and is it distinct from a dataset?** The
   API separates a table RID from a dataset RID and both take a branch. No prose
   page read so far distinguishes them.
