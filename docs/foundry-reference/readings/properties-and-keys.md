---
verify: strict
---

# Reading — properties, the two keys, and what indexing means

The operator's correction: the key icon beside `IATA` in the Data Lineage panel is
a **property** of the object type, not a separate thing. That is right, and the
authoritative table is finer than what I had recorded.

Pages read in full:
- `mirror/object-link-types/properties-overview.md`
- `mirror/object-link-types/object-types-overview.md`
- `mirror/object-indexing/overview.md`

---

## The three definitions, and the analogy restated

`object-types-overview`:

> "An **object type** is the schema definition of a real-world entity or event.
> An **object or object instance** refers to a single instance of an object type…
> An **object set** refers to a collection of multiple object instances…"

`properties-overview`:

> "A **property** of an object type is the **schema definition of a
> characteristic** of a real-world entity or event. A **property value** refers to
> the value of a property on an object…"

Both pages then restate the dataset analogy in their own terms, and together they
complete it:

| ontology | dataset |
|---|---|
| object type | dataset |
| object | row |
| object set | "a filtered set of rows" |
| **property** | **column** |
| **property value** | **field** |

And both end on the same sentence, which is the datasource model stated twice:

> "Property values are created and displayed in user applications by **adding
> backing datasources to an object type** in the Ontology Manager."
>
> "Objects are created and displayed in user applications by **adding backing
> datasources to an object type** in the Ontology Manager."

## Primary-key eligibility is THREE-valued, not two

This is a correction. `datasets-rid-and-object-storage` recorded the rule from
`object-indexing/data-restrictions`, which names only what OSv2 *blocks*:

> "The following types **cannot** be used as primary keys:"

The page prints them as a list, not a sentence: Geopoint, Geoshapes, Arrays,
Time series properties, and real number types (decimal, double, float).

`properties-overview` is the guidance table, and it has a **middle tier** that list
does not:

| base type | title key? | primary key? |
|---|---|---|
| `String`, `Integer`, `Short` | **Yes** | **Yes** |
| `Date`, `Timestamp` | Yes | **Discouraged** |
| `Boolean`, `Byte`, `Long` | Yes | **Discouraged** |
| `Float`, `Double`, `Decimal` | Yes | No |
| `Array` | Yes* | No |
| `Geopoint` | Yes | No |
| `Cipher` | Yes | No |
| `Vector` | No | No |
| `Struct` | No | No |
| `Media Reference`, `Time Series`, `Geotemporal Series`, `Attachment` | No | No |
| `Geoshape` | No | No |
| `Marking` | No | No |

**Only three base types are unreservedly valid as a primary key: `String`,
`Integer`, `Short`.** Everything else is discouraged or forbidden.

And each "Discouraged" carries its reason, which is what makes the tier worth
keeping rather than collapsing:

- **`Date`, `Timestamp`** — "time values are inappropriate as primary keys, due to
  potentially unexpected **collisions / uniqueness based on the storage format
  differing from the display format**. In most cases, we recommend using `String`."
- **`Boolean`** — "**limits your object type to two object instances**."
- **`Byte`** — "can only be assigned in Actions via an `Integer` parameter, so in
  most cases we recommend using `Integer` properties instead."
- **`Long`** — "has representational issues in Javascript, so **not all frontend
  libraries and code work well with `Long` values greater than 1e15**."

A three-valued rule cannot be modelled as a CHECK constraint alone. `No` is a
constraint; `Discouraged` is a **warning at authoring time** with a message — and
the message *is* the reason quoted above.

### Title key is a separate axis, and it is not the complement

Fourteen base types are valid as a title key while only three are valid as a
primary key, and the sets are not nested the way one might guess: `Geopoint`,
`Cipher`, `Float`/`Double`/`Decimal` and `Array` can all title an object but none
can key one.

Two derived rules:

- **`Array`** — "If the **inner type** of the `Array` is not a valid title
  property, the `Array` property also cannot be used as the title property." So
  title-key eligibility for an array is computed from its element type.
- **`Struct`** — "do not support nesting, and **fields cannot be arrays**."

Also worth recording because it contradicts nothing but adds one: "Array
properties **cannot contain null elements**" and "**Nested arrays are not supported
in Object Storage v2**" — the same two rules `data-restrictions` gives, stated here
on the property rather than at index time.

### `Marking` is a property base type

Row 29 lists **`Marking`** — invalid as either key. It does **not** appear in
`base-types.md`'s advanced list (Vector, Geopoint, Geoshape, Attachment, Time
series, Geotemporal series, Media reference, Cipher text, Struct).

This is the **mandatory control property** from `object-permissioning`: "Every row
has a set of markings in the mandatory control property that need to be satisfied
by a user to access that object instance." So row-level marking security is carried
by a *property of type `Marking`* — the object-layer counterpart of what migrations
399–404 built at the dataset layer.

`object-link-types/mandatory-control-properties` is still unread and is now clearly
the page that closes this.

## What indexing means

`object-indexing/overview`, in one sentence:

> "In the Ontology, **indexing** is the process of making tabular or other forms of
> data in Foundry datasources available for **faster data retrieval operations
> through specialized databases**."

Not a search index in the incidental sense — it is *the* mechanism by which a
datasource becomes queryable objects.

> "indexing is overseen by the **Object Data Funnel** service ("Funnel"). The
> Funnel service is responsible for orchestrating Funnel pipelines that **create
> and modify object instances in the Ontology** and ensure up-to-date data and
> metadata."

Two pipeline types, chosen by "datasource landscape, latency and workflow
requirements, and cost considerations": **funnel batch pipelines** and **funnel
streaming pipelines**. Plus "For low-latency writes and edits into the Ontology,
you can also use **direct datasources**."

So the chain is complete and named end to end:

```
dataset (files, transactions, schema)
   → Funnel: changelog → merge on PRIMARY KEY → index → hydrate
      → object database
         → Object Set Service serves reads
```

The primary key is not decoration. `funnel-batch-pipelines`: "all changelog
datasets… and any recent user edits coming from Actions are **joined by the object
type's primary key**." **Indexing cannot run without it**, which is why
`create-object-type` says "Every object type requires at least one property. This
is because object types need a primary key to uniquely identify them."

---

## Connects to

- **`create-object-type`** — its three primary-key warnings (duplicates fail the
  build, must be deterministic, changing it deletes all edits) now have the
  eligibility table in front of them.
- **`datasets-rid-and-object-storage`** — **corrects** its record of primary-key
  restrictions from two-valued to three-valued. The two pages are consistent;
  `data-restrictions` names what OSv2 blocks at index time, `properties-overview`
  names everything that is not valid plus what is merely unwise.
- **`markings`** — a `Marking` **property base type** is the object-layer form of
  everything 399–404 built at the dataset layer.
- **`data-lineage`** — the key and bookmark icons on the property list are these
  two designations, rendered.
- **Our `objectTypes/index.ts`** — `PropertyType` has 7 values; `TITLE_KEY_INELIGIBLE`
  is `['media_reference','vector']`, which is correct for those 7 (geopoint *is*
  title-key eligible per this table). There is **no primary-key concept at all**.
- **Our `dataset_field_valid`** — the 15 dataset field types. Property base types
  are those minus `Map`/`Binary`, plus the advanced ones, plus `Marking`.

## Open questions

1. **Is `Marking` a base type or a separate concept?** It is in
   `properties-overview`'s table and absent from `base-types`. Resolved most
   likely by `mandatory-control-properties`, unread.
2. **Can an object type have a composite primary key?** Every sentence says *the
   property*, singular. `create-object-type` says:

   > "The primary key of the object type is auto-selected since **there is only
   > one primary key for each object type** (`Tail Number` for the `Aircraft`
   > object type)."

   Reads as single-column, but no page rules composite keys out in so many words.

## Decisions

Recited to the operator 2026-08-06. Nothing built from this reading yet; it
refines O1/O2 in the plan.
