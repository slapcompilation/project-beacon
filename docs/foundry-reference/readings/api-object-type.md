---
verify: strict
---

# ObjectTypeV2, field by field against our schema

**Why this reading exists.** `DELIVERABLE-MAP.md` closes with the rule that
`api/` is **on disk and under-read** — 1,243 pages mirrored, and no reading
written from any of them. **That framing was wrong and this reading repeated it**
— `api-authentication.md` had read an authentication page from that same
corpus two days earlier, and names it. What is true is narrower: this is the first reading of an api
page for a RESOURCE SHAPE, and it is deliberately *one* resource, because the
wholesale version does not work (see §6).

**Pages read:** `api/ontologies-v2-resources-object-types-get-object-type` — the
`ObjectTypeV2` response in full, including the nested `PropertyV2`, the
`dataType` union and the `ObjectTypeDatasource` union — plus
`object-link-types/create-object-type` for the API-name rule and
`object-link-types/properties-overview`, whose table is the twenty-two base
types our own set is a snake_case of. §7 is there because I reached §7 without
having opened the last of those.

**Consulted, and quoted only in the superseded version of §7:**
`object-link-types/base-types` and `object-link-types/property-reducers`. Both
name the cipher type with a second word; neither is the enumeration.

**No images.** `api/` pages carry none.

---

## 1. The top level, and what it confirms

| api field | ours | verdict |
|---|---|---|
| `apiName` · required | `api_name` | see §2 |
| `displayName` · required | `label` | ✓ |
| `status` · enum `ACTIVE ENDORSED EXPERIMENTAL DEPRECATED` | `status` | two vocabularies; we take the prose one |
| `description` | `description` | ✓ |
| `pluralDisplayName` · **required** | `plural_label` | see §5 |
| `icon` · union | `icon` + `icon_color` | ✓ and it settles a question |
| `primaryKey` · required | `is_primary_key` | ✓ |
| `properties` · map | `object_type_properties` | §3 |
| `rid` · required | `rid` | ✓ |
| `titleProperty` · required | `is_title_key` | ✓ |
| `visibility` · enum `NORMAL PROMINENT HIDDEN` | `visibility` | ✓ |
| `aliases` · list | `aliases` | ✓ |
| `datasources` · list | `object_type_datasources` | §4 |

**The icon settles an open question.** `readings/workshop-resource-list.md` §4
found Foundry's picker offering `Orange 5` — a Blueprint palette entry by ramp
and step — and its Decision 1 kept our column a free hex on the strength of the
page's phrase "a predefined **or custom** color". The api is unambiguous:

> - `icon` · union · required
>   "A union currently only consisting of the BlueprintIcon (more icon types may be added in the future)."
>   - `blueprint` · object
>     - `color` · string · required
>       "A hexadecimal color code."
>     - `name` · string · required
>       "The [name](https://blueprintjs.com/docs/#icons/icons-list) of the Blueprint icon. Used to specify the Blueprint icon to represent the object type in a React app."

— `api/ontologies-v2-resources-object-types-get-object-type.md`

**A hexadecimal colour code and a Blueprint icon name**, which is exactly the
pair `object_types` stores. Decision 1 of that reading is confirmed rather than
merely defensible, and the picker's `Orange 5` is a convenience over a hex.

## 2. camelCase against PascalCase, and the count settles it

The api says of `apiName`: "The name of the object type in the API in camelCase
format." Our `TYPE_API_RE` is `^[A-Z][A-Za-z0-9]{0,99}$` — PascalCase. That looks
like a defect and is not one.

**That sentence appears in 404 api pages.** It is boilerplate. The create page
gives a specific rule instead:

> * Begin with an uppercase character and consist of only alphanumeric characters.
> * Be written in PascalCase (also known as UpperCamelCase, in which the first letter of each word in a compound word is capitalized; for instance, "ThisExampleName").

— `object-link-types/create-object-type.md`

Three clauses, an explicit gloss, and a worked example. It also explains the
boilerplate: **UpperCamelCase is a camelCase**, so the api's loose phrasing is
not even wrong. Both observed API names are PascalCase —
`Generated59a386a3ddbf…` in the Overview screenshot and `UsernameFlightAlerts`
in the course. No change.

## 3. `PropertyV2`, and the one thing we are missing

| api field | ours | verdict |
|---|---|---|
| `description`, `displayName` | same | ✓ |
| `dataType` · union | `base_type`, `array_element_type`, the `vector_*` set | ✓, and see below |
| `rid` · **required** | **nothing** | **gap** |
| `status` · union with a `deprecated` arm carrying `message`, `deadline`, `replacedBy` | `status`, `deprecation_reason`, `deprecation_deadline`, `replaced_by` | ✓ (`message` is our `reason`) |
| `visibility` · enum | `visibility` | ✓ |
| `valueTypeApiName` | `value_type_id` | ✓ |
| `valueFormatting` · union, "experimental and may change" | nothing | not built, and the api says why |
| `typeClasses` · list of `{kind, name}` | replaced by capability slots | recorded in DELIVERABLE-MAP |

**A property carries a RID and ours does not.** 488 gave generated `rid` columns
to link types, shared properties, action types and value types, and its own
header argues the case for properties without acting on it — reasoning that
since even a shared property's struct fields carry RIDs, a fortiori the property
itself does. It then gave the RID to shared properties only.

The api agrees and goes further: `PropertyV2.rid` is **required**, and the
`StructFieldType` inside `dataType` carries one too — "The unique resource
identifier of a struct field". `object_type_properties` has no `rid` column.

**The type token would be inference.** No mirrored page prints
`ri.ontology.main.property.<id>` or any spelling of it, which is the same
position 488 recorded for `shared-property`.

## 4. The datasource union: ten arms, we model three

The api's `ObjectTypeDatasource` union: `dataset`, `direct`, `editsOnly`,
`geotimeSeries`, `mediaSetView`, `restrictedView`, `stream`, `table`,
`timeSeries`, `unsupported`.

Ours, from the `object_type_datasources_one_backing` CHECK: **dataset on a
branch**, **restricted view**, **media set**. Three.

Most of the difference is infrastructure we do not have — no streams, no time
series syncs, no `table` sources. **One is a real structural difference:**
`editsOnly` is a *datasource kind* in Foundry, while 545 models edit-only as a
property `source` value permissioned to a dataset. Both express "this property
has no backing column"; they put it in different places. Recorded, not changed —
545's shape is cited and works, and this is the union the api itself hedges with
an `unsupported` arm.

## 5. A required field we let be empty

`pluralDisplayName` is **required** in the api. Ours is `plural_label text NOT
NULL DEFAULT ''`, and 598 made the wizard derive it while leaving an override.
So the column is never null but may be the empty string, which the api would
not accept. Not urgent — nothing of ours serves that api — but worth knowing
before anything does.

## 6. What did not work, so nobody rebuilds it

Before reading one resource I tried the wholesale version: extract every
`one of` enum across the 1,243 pages and diff against all 258 CHECK constraints.
**131 disagreements, 10 after filtering, zero real.** An api field name only
means something inside its resource — `role` on a marking category against
`project_role_grants.role` — and literals scraped from a *composite* CHECK are
not a value set: `link_types` has `CHECK (backing_kind IS DISTINCT FROM
'join_table' OR cardinality = 'many_to_many')`, from which a regex reports the
value set as `join_table, many_to_many`.

That probe is deleted. Reading one resource field by field found a real defect
(§7) in twenty minutes.

## 7. What this reading got WRONG, and the correction

`cipher` → `cipher_text` (599, #725) **was a mistake, reverted by 600.**

The reasoning was that three sources name it with a second word — `base-types.md`
calls it "Cipher text", `property-reducers.md` lists `Cipher Text`, the api spells
the arm `cipherText` — so prose and api agreed and we were the odd one out.

**I did not check the page our set is derived from.** 408's comment says the base
types come from properties-overview's table, and `vocabulary.test.ts` names the
same anchor. Its first column enumerates exactly twenty-two names:

> `Media Reference`, `Time Series`, `Geotemporal Series`, `Attachment`
>
> … `Geopoint` … `Geoshape` … `Marking` … `Cipher`

— `object-link-types/properties-overview.md`

Snake-cased that **is** our token set, 22 for 22, and it says `Cipher`.

**Foundry is internally inconsistent here**, which is the part worth keeping. The
enumeration says `Cipher`; the page describing the complex types says "Cipher
text"; the api says `cipherText`. The tie-break is not which spelling appears
most often — it is that our vocabulary is a 1:1 snake_case of ONE table, so
taking a single element's name from elsewhere leaves the set a mixture of two
sources and no longer the thing 408 said it was.

The same reasoning settles `geotemporal_series`, which §3 earlier defended on the
weaker ground that `base-types.md` happened to agree while `property-reducers.md`
and the api said `Reference`. The table says `Geotemporal Series`. Ours is right
because it is the table's, not because two sources out of three concur.

**What this cost, and what it bought.** Two migrations and a merged PR to end
where we started, against one durable finding: a vocabulary derived from a page
has to be checked against *that* page, and nothing mechanical was doing it.

## Decisions

1. **No change to `apiName`, `icon_color`, `status`, `visibility` or the
   `dataType` set beyond 599.** Each is either confirmed or a recorded
   two-vocabularies difference.
2. **Record the property RID gap; do not add the column in this pass.** A
   generated `rid` nothing reads is the defect this session has spent its time
   closing. It becomes worth adding when a property surface shows identity the
   way the object type Overview now does — and then the type token has to be
   marked inference, as 488 did for `shared-property`.
3. **Leave `editsOnly` where 545 put it.** Foundry makes it a datasource kind and
   we make it a property source; both are cited, and the api hedges its own union.
4. **Do not build `valueFormatting`.** The api marks it experimental and says it
   may change.
5. **The empty `plural_label` is recorded, not constrained.** Requiring it would
   be stricter than our own save path needs and nothing consumes the api shape.

## Questions

1. **What is a property's RID token?** No page prints one.
2. **Does an object type property have `typeClasses` we should surface?** We
   replaced them with capability slots; whether the two are the same thing is
   asserted in DELIVERABLE-MAP but not quoted from a page.
3. **Which of the seven unmodelled datasource arms will we ever need?** `stream`
   and `timeSeries` presume infrastructure that is a non-goal; `table` and
   `direct` are not obviously so.
