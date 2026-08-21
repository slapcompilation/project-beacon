---
verify: strict
---

# Edit-only properties: already built, and the one sentence nothing enforces

**Why this reading exists.** Item 3 of the ontology priority list. I went to
build edit-only properties and found them built — 545 corrected the CHECK,
`PropertySourceDialog` offers the radio, and the vocabulary was settled from a
page that enumerates. This reading exists so the next person does not re-derive
that, and because reading the page properly turned up one sentence nothing
enforces.

**Page read in full:** `object-link-types/edit-only-properties`.

**Images parsed (1 of 1):** `edit_only_property.png`. **545 quoted this page and
never opened its image** — the header cites prose only. The image is where §3
comes from.

**Also read, for §2:** the `PropertyTypeMappingInfo` union in
`api/v2-ontologies-v2-resources-object-types-get-object-type`, and the
edit-only-object-type datasource variant in the same page. **No images** —
`api/` pages carry none.

---

## 1. What it is, and that we have it

> Edit-only properties allow you to define Ontology properties that are not directly mapped to a column in the backing dataset of the object type.

— `object-link-types/edit-only-properties.md`

`object_type_properties.source = 'user_input'`, with the CHECK
`source_names_its_data` requiring `backing_column IS NULL AND datasource_id IS
NOT NULL`. 408 originally forbade the datasource; 545 corrected it, quoting this
page, and its header explains the original error well enough that it is not
repeated here.

The third bullet is why it is buildable at all:

> **Available only in Object Storage v2:** Edit-only properties are a feature that is exclusively available for object types leveraging Object Storage v2.

— `object-link-types/edit-only-properties.md`

The last section — mapping one to a column later by untoggling and choosing a
column — is the radio group's `Datasource` arm plus the backing-column input.
Built.

## 2. The name is `user_input`, and it stays

This is the `cipher` trap in a second costume, so it is written down.

Three sources spell the concept differently: the page title is **Edit-only
properties**, the Ontology Manager toggle in the screenshot reads **Edit only
property** (no hyphen), and the api's union member is `editOnly`:

> A property on an object type that is permissioned to a tabular datasource, but the contents are only populated through Actions.

— `api/v2-ontologies-v2-resources-object-types-get-object-type.md`

**None of those is the page that lists our set.** Ours is a closed set of three
property sources, and the page that enumerates it is a screenshot cited in
`PropertySource.tsx`'s own header — `object-link-types/images/media-reference-source.png`
— whose radio group reads `Datasource` / `User edits` / `Linked objects`. Foundry
names the same idea *editOnly* to a program and *User edits* to a person; we
build the Ontology Manager, so the person's vocabulary is the one that binds,
exactly as CLAUDE.md's two-vocabularies table already says.

**So `user_input` is right and renaming it to `edit_only` would be 599 again.**
The api's union is also not our set: it has three members `struct`, `column`,
`editOnly`, and ours has `column`, `user_input`, `linked_objects` — a different
axis, because `linked_objects` is a datasource kind in the api
(`unsupportedType: "derivedProperties"`), not a property mapping.

## 3. What the image adds, which is the shape of the editor

`edit_only_property.png` is the property editor panel, not a dialog:

- a header row — a collapse-to-sidebar glyph, a quote-mark base-type tile, the
  property name `Current owner`, a small green status dot, and a red trash at
  the far right;
- four tabs: **General** (selected, blue underline), **Display**,
  **Interaction**, **Details**;
- in General, above the fold: an `Allow multiple` toggle with a `?` helper, a
  `Value type` picker reading `Select an option…`, and `Status` showing an
  amber `Experimental` tag;
- a **CONFIGURATION** block: `Title key` and `Primary key` as toggles, each
  followed by `Current:` and the property that currently holds it, rendered as
  a tile plus name (`" Name`);
- a **DATA** block: `Edit only property` with a `?` and the toggle **on**, then
  `Permissioned to` with a dataset picker showing a grid glyph and `vehicles`.

Two things ours does differently, recorded rather than acted on. **Ours is a
dialog titled `Source — <property>` with a `Source type` radio group**; Foundry
has no such radio here — edit-only is a toggle inside the property's General
tab, and the picker beside it is labelled `Permissioned to`. And **the
`Current:` line is an affordance we lack**: our title-key and primary-key
controls do not say which property holds the designation today, so a user
toggling one cannot see what they are displacing.

## 4. The sentence nothing enforces

> **Permissioned to one of the datasets backing the object type:** To ensure data consistency and security, edit-only properties must be permissioned to one of the datasets backing the object type.

— `object-link-types/edit-only-properties.md`

Ours requires `datasource_id IS NOT NULL` and nothing more. The foreign key
points at `object_type_datasources(id)` — **any row of it, including another
object type's.** A CHECK cannot ask the question (it needs a second table), the
UI never offers a foreign one (`PropertySourceDialog` lists
`useObjectTypeDatasources(objectTypeId)`), and `datasource_mapping_problems()`
has three arms, none of them this.

So the sentence holds today by the surface's good behaviour, and nothing holds
it. Asked of the live database: **0 properties currently point at another
object type's datasource** — so this is a guard, not a repair.

It is not only about edit-only properties, either: a `column` property names a
`datasource_id` too, and the same hole is under it.

## 4a. Built: 608

The guard is a trigger on `object_type_properties`, `BEFORE INSERT OR UPDATE OF
datasource_id, object_type_id`, raising
`Ontology:DatasourceBacksAnotherObjectType`. Three cases probed by doing them:
the foreign datasource is refused, the type's own is accepted, and a property
with no datasource at all is untouched — the third because a `linked_objects`
property has none and must not be caught.

**The probe found a rule I did not know we had.** Its first draft cloned the
existing datasource onto the scratch object type and was refused with
`Phonograph2:DatasetAndBranchAlreadyRegistered — this datasource is already
backing a different object type and cannot be used again`. So a dataset+branch
backs exactly one object type, which narrows the hole 608 closes but does not
remove it: the property could still name the *other type's datasource row*
directly, which is the case the first assertion proves is now refused.

## 5. A second thing the api describes and we forbid

> An object type datasource that is not backed by any external Foundry resource. All properties on the object type can only be populated via Actions. Other datasources have edit only *properties*, which are permissioned to the backing tabular datasource. This datasource has no backing tabular datasource and is a true edit only object type. Note that this datasource type is incompatible with any other datasource and all the properties on the object type are backed by it.

— `api/v2-ontologies-v2-resources-object-types-get-object-type.md`

`object_type_datasources_one_backing` requires exactly one of dataset, restricted
view or media set, so this kind is **refused** by our schema. It is Foundry's
other answer to the problem 590 solved by generating an empty dataset — both are
documented, and we took the wizard's branch.

Not built. It is a datasource kind, an incompatibility rule, and a question
about what `index_object_type` does with a datasource that has no view — a
phase, not a column.

## Decisions

1. **Nothing about edit-only properties is rebuilt.** Engine, vocabulary and
   surface exist. This is recorded as the finding, because "verify we do not
   have X" is a rule I have broken three times this month.
2. **`user_input` is not renamed.** The page that lists the set wins; the api's
   `editOnly` describes one member. See §2.
3. **A property's datasource must belong to its own object type**, enforced on
   the trigger rung — it needs a second table, so no CHECK can hold it, and it
   cannot go stale on its own, so it is not an `ontology_violations()` arm
   either. Zero rows violate it today.
4. **The `Current:` affordance is not built here.** It is a property-editor
   change, not a permissioning one, and it belongs with whatever restructures
   that dialog into Foundry's four tabs.
5. **The true edit-only OBJECT TYPE is not built, and is named.** See §5.

## Questions

1. **Does the true edit-only object type need `index_object_type` changed at
   all?** It already replays `object_edits` and merges objects that exist only
   in the edit log. The gap may be smaller than §5 assumes, and nobody has
   measured it.
2. **What do the other three tabs hold?** The image shows `Display`,
   `Interaction` and `Details` and never opens them. `metadata-render-hints`
   and `edit-properties` are the likely pages; this reading did not follow them.
3. **Is `Value type` on the General tab the same value type our column holds?**
   Ours is `value_type_id`. The screenshot shows the picker empty, so it says
   nothing about the vocabulary.
