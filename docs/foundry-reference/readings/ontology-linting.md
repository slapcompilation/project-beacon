# Reading — where a rule about the ontology belongs

Not a new page. This settles a question the operator asked twice — *"why
`check:datasets` but not `check:tables`?"*, then *"shouldn't ontology handle
datasets as well?"* — using pages already read, and records what changed.

Pages relied on:
- `mirror/object-link-types/create-object-type.md` (the completeness contract,
  the API-name casings, the Source column, `MapType`/`StructType`)
- `mirror/superrepo/core-concepts.md` (Ontology linting)
- `mirror/object-permissioning/multi-datasource-objects.md` (one datasource per
  property, the primary key in every one)

---

## The pattern Foundry names

> "**Ontology linting** is a second established pattern: Ontology owners who need
> to enforce style and design-pattern guidelines write **linters that check the
> entity definitions** in code before they are deployed."

Theirs reads TypeScript in a SuperRepo because that is where their entities are.
**Ours reads the database, because that is where ours are** — the same decision
already taken in `osdk-and-ontology-as-code.md`: our ontology is
database-authored, so code is generated *from* it, not the other way round.

## Four places a rule can live, and how to pick

| where | holds | example |
|---|---|---|
| **a CHECK constraint** | one row, always | `api_name ~ '^[A-Z][A-Za-z0-9]*$'` |
| **a partial unique index** | one row per table | one primary key per object type |
| **a trigger** | a write, at the moment it happens | a datasource with a `MAP` column cannot be bound |
| **`ontology_violations()`** | two tables at once, or drift that arrives later | a property naming a column its datasource no longer has |

The order is strict: **if a constraint can hold it, it is a constraint.** The
lint is what is left over, and what is left over turns out to be a real
category — not a weaker version of the others.

### The case that made this concrete

`guard_object_type_datasource` already refuses to bind a datasource whose schema
contains a `MAP` or `STRUCT` column. The lint's version of that rule looked
redundant, and migration 410's first draft asserted it by binding such a dataset
— which the trigger correctly refused, failing the migration.

The fix is the distinction: **bind a clean dataset, then commit a transaction
that adds the forbidden column.** The trigger cannot see that; nothing fires. The
lint reports it. Same sentence from the page, two enforcement points, neither
redundant.

## What the lint found immediately

`dataset_current_schema(dataset)` resolved the current schema with
`ORDER BY created_at DESC LIMIT 1`. `created_at` defaults to `now()`, which in
Postgres is the **transaction** timestamp — so two schemas attached in one
transaction are indistinguishable and the tie broke arbitrarily. The assertion
above depends on exactly that case, and reported the *older* schema.

394 had already settled the right shape for the neighbouring question: **"a view
is anchored to a transaction."** A schema belongs to a transaction too, so it is
found the same way — down the branch's commit chain from its head. Hence
`dataset_branch_schema(branch)`, which is also the right *arity*: a datasource is
"a dataset **on a branch**", so asking a dataset was always one identifier short.
`dataset_current_schema` is dropped; the binding trigger now asks the branch.

## What moved, and what could not

`check:datasets` had 41 assertions in three groups:

| group | verdict |
|---|---|
| **engine conformance** — run the published example, compare | stays, renamed `check:platform` |
| **liveness** — every RLS-guarded table read as `authenticated` | stays; it found the outage |
| **ontology content** — two object types, a `MAP` column | **gone**, replaced by one call to `ontology_violations()` |

The plan had been to move the engine assertions into the migrations that own
those algorithms and delete the script. **That is not possible, and the reason is
worth writing down:** `scripts/db.mjs` treats applied migrations as immutable —
*"Applied migrations are immutable. Correct it with a NEW migration."* An
assertion moved into 393 would either trip that guard, or — worse — sit in a file
that never runs again anywhere it has already been applied. A migration assertion
proves a change **at the moment it lands**. A regression test proves it **still
holds**. Those are different jobs and they need different homes.

So the two survive together, and the split is now clean:

- **the migration** asserts the change it makes, once, against quoted prose
- **`check:platform`** re-runs the published examples continuously
- **`ontology_violations()`** answers for content, and `check:platform` asks it
  the one question a fixture cannot: *is the ontology we actually have
  well-formed?*

## The constraint the client was carrying alone

> An object type's API name must "Begin with an **uppercase** character… written
> in **PascalCase**… **unique across all object types**… between 1 and 100
> characters."

The uniqueness was a unique index. The **spelling** was in TypeScript only, so
anything writing SQL could insert `maintenance_request`. It is now
`object_types_api_name_check`, and it immediately broke `check:datasets`' own
fixture, which had been creating `check_one` and `check_two`.

Three spellings, all from the same page, all now enforced where they belong:

| | rule | enforced by |
|---|---|---|
| object type API name | PascalCase, ≤100 | CHECK (410) |
| property API name | camelCase, ≤100, not reserved | CHECK (408) |
| property ID | letter first, then letters/digits/`-`/`_` | CHECK (408) |

`RESERVED_PROPERTY_KEYS` — `id`, `title`, `created_at`, … — is deleted. It listed
the column names of `object_records`, dropped at 382. The documented reserved
list is nine API names: `ontology`, `object`, `property`, `link`, `relation`,
`rid`, `primaryKey`, `typeId`, `ontologyObject`.

## Decisions taken

- `ontology_violations()` covers five rules, each with its sentence in 410.
- The completeness contract has **one implementation**, `object_type_problems()`;
  the lint calls it per type rather than restating it.
- `check:datasets` → `check:platform`, content assertions replaced by one query.
- `dataset_current_schema` dropped in favour of `dataset_branch_schema`.

## Open questions

1. **Link types are unlinted.** `link_types` has cardinality and backing CHECKs
   but nothing checks that a `foreign_key` backing names a column that exists —
   the exact class the property lint now catches. Needs the `create-link-type`
   page read properly first.
2. **Interfaces and shared properties** are enforced by triggers
   (`trg_assert_interface_conformance`, `enforce_shared_property_type`). Whether
   those belong in the lint instead is the same trigger-versus-drift question
   answered above, and probably has the same answer.
3. **Object type API names are "unique across all object types"** — globally, in
   Foundry. Ours is `UNIQUE (organization_id, api_name)`. Deliberate, and worth
   revisiting when namespaces are read (`apiNamespace` in `foundry.yml`).
