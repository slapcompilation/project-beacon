# Generated Object Views for built-in types

Scoped 2026-07-28, after #422 showed that adding one node type's Object View means
hand-writing a page. Cross-checked against `docs/foundry-reference/`.

## The problem

**35 node types. 14 have an Object View.** More pointedly, we run **two
presentation systems**:

| | How a record renders | Cost of a new type |
|---|---|---|
| **Authored** types | Generated — `RecordBody` calls `resolveViewConfig(type, type.viewConfig)`; unplaced keys sweep to Details | Zero code |
| **Built-in** types | A hand-written page per type (`VariantObjectPage`, `PrincipleObjectPage`, …) | A new file + route + registry entry |

Same two-halves split as the two-ontology problem (#413), one layer up:
config-as-data on one side, hand-maintained React on the other.

## What Foundry actually does

Verified in `mirror/object-link-types/`:

> Objects are created and displayed in user applications by **adding backing
> datasources to an object type** in the Ontology Manager.
> — `object-types-overview.md`

> If you have an existing datasource in Foundry containing data to back the object
> type then you can select it. This will automatically populate the object type's
> metadata. It will also **map every column of the backing datasource to a
> property**, but you can discard added properties in the Properties step.
> — `create-object-type.md`

Three things follow, and all three are directly usable:

1. **`source_table` is the backing datasource.** Migration 223 already stores it.
2. **Properties are *mapped from columns*, not hand-authored.**
3. **Every object type needs a primary key and a title key** (`create-object-type.md`).

Foundry also **excludes complex columns**: *"A backing datasource for an object
type may not contain `MapType` or `StructType` columns."* That is a precedent for
skipping our `jsonb` columns rather than inventing a property type for them.

And crucially, Foundry does **not** silently auto-sync on schema drift — it fails
loudly:

> `Phonograph2:SchemaMismatch` … there is a mismatch between the data types in the
> dataset that backs your object and the data types that the ontology expects. You
> must ensure that any schema updates are reflected in both the dataset and the
> ontology.
> — `edit-object-type.md`

So the answer to "won't registered properties drift from the real columns?" is not
"avoid duplication" — it is **explicit mapping plus loud failure**. That fits the
self-apply rule in CLAUDE.md exactly, and gives us our own `SchemaMismatch`: a
contract test.

**Verdict: the direction is Foundry-shaped, and Foundry supplies the mechanism.**

## Conflicts with existing code — audited, not assumed

### 1. Three registries already map a type to its data

| Registry | Holds | Consumed by |
|---|---|---|
| `OBJECT_LIST` (`features/objects/objectList.ts`) | `table`, `select`, `title(r)`, `subtitle(r)` | `/objects` grid + `ObjectListPage` |
| `ENTITY_META` (`components/layout/context-panel/EntityMeta.ts`) | table + select | context panel |
| `object_types.source_table` (migration 223) | table name | **nothing — dormant** |

`OBJECT_LIST` is already an ad-hoc backing-datasource registry *with a title key*.
**This work must converge these, not add a fourth.** `source_table` being dormant
is the tell: it was laid as groundwork and nothing consumed it.

### 2. The generated view reads `object_records` only

`CustomRecordPage` → `useObjectRecord(recordId)` → `object_records`. Built-in
records live in their own tables, so the generated path needs a **read seam** that
returns `{ id, data }` from `source_table` — the same shape `RecordBody` already
consumes. No change to `RecordBody` or `resolveViewConfig`.

### 3. RLS blocks user writes to built-in types — correctly

Migration 223 guards all three per-command policies with `kind = 'authored'`.
Populating built-in `properties` must therefore happen **in a migration**, not
through the composer. That is the right shape (code owns built-in schema) and
needs no policy change.

### 4. Interfaces — no conflict, and this unblocks them

`assert_interface_conformance` (migration 224) compares `object_types.properties`
against the interface's, with **no `kind` restriction**. Built-in types currently
satisfy nothing only because their `properties` are `[]`. Populating them makes
built-ins able to implement interfaces **with no further change** — exactly the
"falls out naturally, not special-cased" note in #414.

This is the compounding win: one change unlocks generated views *and* interface
conformance for the operational domain (a `Roomed` or `Perishable` interface that
spans Variant, Batch and Maintenance Request).

## Design

**Properties are derived, never hand-written.** A migration reads
`information_schema.columns` for each `source_table` and maps:

| Postgres | PropertyType |
|---|---|
| `text`, `varchar`, `uuid` | `text` |
| `int*`, `numeric`, `real`, `double precision` | `number` |
| `boolean` | `boolean` |
| `date`, `timestamp*` | `date` |
| `jsonb`, arrays, `USER-DEFINED` (vectors, enums) | **skipped** — Foundry excludes Struct/Map too |

Plus, per Foundry: a **primary key** (`id`) and a **title key** — the latter is the
one genuinely per-type decision, and `OBJECT_LIST.title` already encodes it for 14
types, so it converges rather than starts from nothing.

**Drift is caught, not prevented.** A contract test asserts every registered
built-in property still matches its column's type — our `SchemaMismatch`. It
belongs in `supabase/tests/` beside the other invariants.

**Hand-written pages survive where they earn it.** A generated view is the floor,
not a ceiling. `VariantObjectPage` (stock actions, forecast) and `CaseObjectPage`
(trace) are bespoke because the *workflow* is bespoke, not because the schema is.
`OBJECT_PRESENTATION` stays the override table: a type with an entry keeps its
page; a type without one falls through to the generated view.

## Phases

**G1 — the read seam.** `source_table` gains its first consumer: fetch a built-in
record as `{ id, data }`. Route `/objects/:type/:recordId` resolves built-ins
through it. No schema change; proves the path before mass-registering anything.

**G2 — derive properties.** Migration maps columns → properties for the 15
registered built-in types, plus the title key. Contract test for drift. Generated
views light up for every built-in without a hand-written page.

**G3 — converge the registries.** `OBJECT_LIST` and `ENTITY_META` read from the
ontology row instead of their own copies. This is the one that deletes code.

**G4 — interfaces over built-ins.** Now possible: author `Perishable` across
Variant and Batch, and point one authored tool at it.

## Risks

- **Column count.** `product_variants` has many columns; mapping all of them makes
  a noisy Details section. Foundry's answer is "discard added properties in the
  Properties step" — so the mapping needs a per-type exclude list, or `viewConfig`
  does the hiding. Prefer `viewConfig`: it already exists and is operator-editable.
- **RLS on `source_table` reads.** Each built-in table has its own policies. The
  read seam must go through PostgREST under the caller's JWT, never a service-role
  shortcut, so scoping stays honest.
- **G3 is the risky one.** `OBJECT_LIST.title` holds real per-type logic (joins,
  fallbacks). Converging it means expressing that as a title key, which will not
  be one-to-one for every type. Expect some to keep bespoke title functions.
