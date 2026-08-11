# Statuses and their coupling — the property phase

```
verify: strict
pages: object-link-types/metadata-statuses.md · ontology-manager/cleanup.md
built already: 321 (object type statuses) · 447 (lifecycle guards) ·
               456 (action deprecation trio) · 457 (link follows object types)
```

Read whole, again, for the half 456/457 did not build: **property statuses**.
The page was consulted in `interfaces-phase.md` and
`ontology-manager-save-session.md` for other questions; this reading is the
phase's own.

## 1 — What the page says

The enumeration includes properties:

> Every object type, property, link type, action, or interface in the Ontology has a **status** that indicates developmental state. An ontological resource's status can be either active, experimental, deprecated, or example; object types can also be classified as [promoted](#promoted-status-object-types-only).
> — object-link-types/metadata-statuses.md

The deprecation metadata is for every deprecated resource, properties included:

> A deprecated resource also has metadata that includes:
> — object-link-types/metadata-statuses.md

with the trio (description, deadline, replacement) beneath it.

The object-type-to-property cascade is stated as the general rule with one
worked example:

> The Ontology Manager ensures status consistency between an object type and its related properties or link types. For example, if an object type is changed from `active` to `experimental`, all of its properties will be marked `experimental` as well.
> — object-link-types/metadata-statuses.md

The property-to-link coupling is three bullets:

> * If a foreign key property is changed to `experimental`, its link type will be changed to `experimental`.
> * If a foreign key property is changed to `example`, its link type will be changed to `example`.
> * If a foreign key property is changed to `deprecated`, its link type will be changed to `deprecated`.
> — object-link-types/metadata-statuses.md

And the one asymmetry is stated in prose, with its reason:

> In contrast, when marking a property `active`, the application won't change a link type referencing the property as its foreign key to `active`, as it is valid for a foreign key property to be in production, while the link type and its backing datasource are still in development.
> — object-link-types/metadata-statuses.md

Bulk edit is an **option**, not a cascade:

> When changing an object type from `experimental` to `active`, there is the option to also apply the `active` status to all properties on the object type:
> — object-link-types/metadata-statuses.md

## 2 — What this connects to in our schema

- `object_type_properties` has **no status column** — the only enumerated kind
  still without one. `shared_properties` is *not* in the enumeration.
- The link's foreign key is not a property reference: `link_types` carries
  `backing_object_type_id` + `backing_column`. A "foreign key property" is
  therefore **derivable** — the property row of the backing object type whose
  `backing_column` matches — with no new column and no invention.
- 457 already owns the object-type→link cascade and the holdable-status matrix;
  this phase adds the property column and the two property couplings around it.

## 3 — Decisions

**D1.** `object_type_properties.status` — vocabulary
`experimental|active|deprecated|example`, **no promoted** (the page marks
promoted "(object types only)"). Default `experimental`, the 321 precedent and
"Experimental: Indicates that the resource is still under development."

**D2.** The deprecation trio lands on properties with the same
`deprecation_documented` CHECK, verbatim from the siblings.

**D3.** Cascade object type → its properties for `experimental`, `example`,
`deprecated`. The sentence states the rule generally and works one example;
extending the cascade to `example`/`deprecated` mirrors the link-type bullets.
*The extension beyond `experimental` is inference from "ensures status
consistency", marked here.*

**D4.** Cascade foreign-key property → link types, matched through
`(backing_object_type_id, backing_column)`, for the three bullet statuses.
Deprecation carries the property's reason and deadline down (the 457 pattern,
so the link's documented-deprecation CHECK holds).

**D5.** `active` never cascades — in either coupling. Quoted directly.

**D6.** Bulk apply-active-to-properties is a **surface affordance** on the
object type's status change, not a trigger.

**D7.** Property statuses ride the existing save session: they are fields on
the property rows that already travel in `p_properties` / the `properties`
section — no new session arm.

## 4 — Questions

**Q1.** May a property be `active` while its object type is `experimental`?
The page prints a matrix for links but none for properties; the
prevent-invalid-states paragraph argues both ways. Not buildable as a guard
without an answer.

**Q2.** Does deprecating a property demand anything of the columns that read
it (materializations name property subsets by `property_ids`)? No page in the
mirror says.

**Q3.** `shared_properties` are outside the enumeration — do they carry status
at all? `shared-property-metadata.md` should settle it before that column is
ever added.
