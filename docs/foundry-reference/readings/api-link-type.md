---
verify: strict
---

# LinkTypeSideV2, and the model our columns already had

**Why this reading exists.** #723 built the link type view from prose, a
screenshot and the course, and gave ten `link_types` columns their first reader —
without checking any of it against `api/`. This is that check, and it is the
second reading written from that corpus, which `DELIVERABLE-MAP.md` closes by
calling "on disk and under-read".

**Page read:** `api/ontologies-v2-resources-object-types-get-outgoing-link-type`
in full — it is 45 lines. Cross-checked against
`object-link-types/create-link-type`, quoted below.

**No images.** `api/` pages carry none.

---

## 1. The api models a SIDE, not a link

The response is not a link type. It is `LinkTypeSideV2`:

| field | meaning |
|---|---|
| `apiName` · required | this side's name |
| `displayName` · required | this side's display name |
| `status` · enum · required | `ACTIVE ENDORSED EXPERIMENTAL DEPRECATED` |
| `objectTypeApiName` · required | the object type at the **other** end |
| `cardinality` · enum · required | **`ONE` or `MANY`** — one value, not a pair |
| `foreignKeyPropertyApiName` | the property holding the key, on this side |
| `linkTypeRid` · required | the link's RID |

The first field says whose name it is, and it is the link's, not the pair's:

> The name of the link type in the API. To find the API name for your Link Type, check the **Ontology Manager** application.

— `api/ontologies-v2-resources-object-types-get-outgoing-link-type.md`

**This confirms the shape 256 chose**, and its comment said so four hundred
migrations ago: each side of a link type has its own API name, and there is no
separate reverse link type. `source_api_name`/`target_api_name` and
`source_label`/`target_label` are two sides of one row, which is exactly what the
api returns twice.

## 2. Cardinality: per-side in the api, composite in the Ontology Manager

The api's `cardinality` is `ONE` or `MANY` — the multiplicity of *this* side.
Ours is a single composite value. That is the two-vocabularies case, and the
**enumeration** settles which we take:

> * *One-to-one cardinality:* This indicates that one `Aircraft` should be linked to a single `Flight`. … * *Many-to-many cardinality:* This indicates that one `Aircraft` can be linked to many `Flights`, and one `Flight` can be linked to many `Aircraft`.

— `object-link-types/create-link-type.md`

Four composite names, enumerated, on the page the Ontology Manager's own creation
flow documents. We build the Ontology Manager, so the composite is right — and
right for the reason CLAUDE.md now states, that an enumeration beats a
description, rather than because two sources happen to agree.

`ontology/linkCardinality.ts` already encodes both halves of this: the four
composite values and which backing can express each.

## 3. What the api does not carry, and that is fine

**Per-side visibility is absent**, and its evidence is thinner than I thought.
`source_visibility`/`target_visibility` appear nowhere in `LinkTypeSideV2` — the
word does not occur on the page at all.

I first attributed the claim to the extracted lesson, and the citation gate
refused it: "Per-direction Visibility" is in
`docs/foundry-deep-dives/01-ontology.md`, the hand-written SUMMARY, and the
lesson's own text layer says nothing about visibility. Since #728 established
that no extraction reaches text inside the PDFs' screenshots, the likeliest
source is a screenshot someone read and transcribed.

**So this is transcription-grade evidence, not a quotation**, and
`readings/link-type-view.md` §3 leans on the same sentence for the same columns.
The columns predate both readings and nothing here argues for removing them —
`readings/api-object-type.md` found the same position for `pointOfContact` and
`contributors`, which are Ontology Manager metadata a program never sees. But the
next person to cite per-direction visibility should know the chain ends at a
summary.

## 4. One divergence worth recording

**`status` is per-SIDE in the api and per-LINK for us.** `LinkTypeSideV2.status`
is required on each side; `link_types.status` is one column for the whole row.

A link type whose two directions had different release statuses is expressible in
the api and not in our schema. No page describes wanting that, the Ontology
Manager shows one status on the link type view, and the screenshot #723 was built
from shows a single `Status` field in the metadata card. Recorded, not changed.

## Decisions

1. **Nothing changes.** Every column #723 surfaced is confirmed by the api or is
   Ontology Manager metadata the api does not model. This reading exists to
   record that the check was done, which is the half that was missing.
2. **Cardinality stays composite**, on the enumeration rule rather than on
   agreement.
3. **Per-side `status` is not added.** It is expressible in the api and nowhere
   requested; adding a column no page asks for is the invention this repository
   deletes.

## Questions

1. **Is `LinkTypeSideV2.apiName` our `source_api_name` or `target_api_name`?**
   The endpoint is *outgoing* from a named object type, so the side returned is
   the one traversed away from it — but the page does not say which of our two
   columns that maps to for a given row, and the answer depends on which end the
   caller asked about.
2. **Does the api expose the join method at all?** `foreignKeyPropertyApiName` is
   present, but nothing names a dataset-backed or object-backed link. Our
   `backing_kind` may be Ontology Manager-only, like visibility.
