# Shape audit — our encoding against the one Foundry publishes

**What this answers, and why it is separate from the parity census.**
`ONTOLOGY-PARITY.md` asks *do we have this capability*. This asks *is what we
store shaped the way the wire says it is shaped*, which is a different question
with a different cost. Measured on this repo's own migrations: a missing ENGINE
costs one additive migration — 842 added one behind an existing column and none
of its four callers moved — while a wrong SHAPE costs the number of consumers,
and consumers only ever grow. See *A shape must be complete before it has
consumers* in CLAUDE.md.

**This file is the index `pnpm check:shapes` reads.** The gate fails when a
migration changes the shape or access of a load-bearing table this file has no
verdict for. There is no allowlist — a disposition is a paragraph with a reason,
which is the distinction from the deleted `check:shape`.

**How a table counts as audited, and why it is a fenced block rather than a
mention.** The first version of this index treated any backticked table name as
audited, and the backlog paragraph at the foot of this file promptly marked
eight tables audited by naming them. A prose mention is not a verdict. The
machine-readable list is below, one table per line, and nothing else on this
page counts:

```shape-audit
object_types                          round-1  missing-fields-only
object_type_properties                round-1  missing-fields-only
object_type_datasources               round-1  missing-fields-only
link_types                            round-1  missing-fields-only
object_sets                           round-1  wrong-encoding
action_types                          round-1  wrong-encoding
action_type_parameters                round-1  wrong-encoding
action_type_rules                     round-1  missing-fields-only
action_type_submission_criteria       round-1  matches
datasets                              round-1  missing-fields-only
dataset_branches                      round-1  wrong-encoding
dataset_transactions                  round-1  matches
dataset_files                         round-1  wrong-encoding
dataset_schemas                       round-1  wrong-encoding
ontology_interfaces                   round-1  missing-fields-only
object_type_interfaces                round-1  matches
interface_link_constraints            round-1  missing-fields-only
interface_properties                  round-1  matches
interface_implementation_mappings     round-1  wrong-encoding
shared_properties                     round-1  wrong-encoding
builds                                round-1  missing-fields-only
build_jobs                            round-1  wrong-encoding
job_specs                             round-1  wrong-encoding
schedules                             round-1  wrong-encoding
```

**Round 1 — 2026-09-22.** Nine shape families, chosen by consumer count from
`pg_proc`, each compared against `api/` first (it publishes unions WITH their
members and has falsified this schema four times) and the enumerating prose page
second. Every finding below carries both sides: our column or CHECK as the
catalog returns it, and the published field quoted with its file. 242 public
tables, 49 with eight or more consumers; this round covers 24 of them.

| shape family | consumers | verdict |
|---|---|---|
| `object_types` | 84 | missing fields only |
| `object_type_properties` | 71 | missing fields only |
| `datasets` · `dataset_branches` · `dataset_transactions` · `dataset_files` · `dataset_schemas` | 58 · 35 · 21 · 12 · 12 | **wrong encoding** |
| `link_types` | 40 | missing fields only |
| `object_type_datasources` | 34 | missing fields only |
| `action_types` · `action_type_parameters` · `action_type_rules` · `action_type_submission_criteria` | 21 · 23 · 18 · 9 | **wrong encoding** |
| `builds` · `build_jobs` · `job_specs` · `schedules` | 19 · 20 · 13 · 10 | **wrong encoding** |
| `ontology_interfaces` · `object_type_interfaces` · `interface_link_constraints` · `interface_properties` · `interface_implementation_mappings` · `shared_properties` | 14 · 9 · 9 | **wrong encoding** |
| `object_sets` | 14 | **wrong encoding** |

**Four of the nine carry no expensive divergence at all, and saying so is half
the value of the exercise** — three of them overturned something this repo had
written down as a gap.

---

## Fix in this order, because this is the order the cost is in

**1. `object_sets` — and it is free today, which will never be true again.**
`api/v2-…load-object-set.md` declares `objectSet · union · required` and lists
**fifteen** members; six carry a nested `objectSet · union · required` and three
carry `objectSets · list`, so the union is recursive. Ours is a flat row with no
column anywhere that can hold another object set, so `union`, `intersect`,
`subtract` and filter-of-filter have no encoding at all. `set_kind` is a
two-valued positional discriminator — `exploration` standing for base+filter,
`list` for `static` — over a space the API publishes as fifteen.

What makes this the cheapest moment: **`select count(*) from object_sets`
returns zero rows**, verified directly. `subject_interface_id` has no writer and
no reader anywhere. `traversals` is dead — no function in the database reads the
column, because `object_set_rows` passes a literal `'[]'::jsonb` and
`evaluate_object_set_by_rid` passes `NULL` into an argument that is `p_sort`.
So the corrective migration moves no data and orphans no code, and the flat row
lands as the degenerate `filter(base(t), where)` while all fourteen consumers
keep working. Deferring it means later moving every function that reads
`subject_type_id` off the row.

*A latent defect rides along:* `object_set_keys` resolves the primary key from
`os.subject_type_id`, while our own comment on `traversals` says "The set's
members are of the LAST hop's type, not the subject type". It cannot fire only
because traversals is dead.

**2. `dataset_schemas`, before anything else reads a schema.** Built in 392 from
the prose page rather than the api page that publishes the wire encoding, and
every divergence follows from that one choice:

- key spelling `arraySubType` (ours, from `data-integration/datasets.md`) against
  `arraySubtype` · "Only used when field type is array" (api)
- the api's **required** `nullable` — absent here
- `versionId` · required — absent, **and `dataset_schemas_transaction_id_key
  UNIQUE (transaction_id)` forecloses it**, so this is not an additive gap
- `dataframeReader` · enum, one of `AVRO`, `CSV`, `PARQUET`, `DATASOURCE` —
  encoded here as *is `parser_params` NULL*, collapsing three of four members

**And a live defect found on the way:** `dataset_files.removes` is a per-file
copy of a discriminator Foundry keys off the transaction type, nothing ties the
two, and **no production writer sets it** — all six SQL writers insert
`(dataset_id, transaction_id, logical_path, row_count)` only. So a committed
`DELETE` transaction removes nothing from the view today. Only the platform test
harness computes it, as `type === 'DELETE'`, which is why the suite still matches
the documentation's printed answer while the engine does not.

**Also here:** `dataset_branches.head_transaction_id` holds the last COMMITTED
transaction (`advance_branch_head` returns early unless `NEW.status =
'COMMITTED'`), while both the api and `branching.md` say the pointer names the
most recent **OPEN or COMMITTED** one and moves when a transaction *starts*.
35 consumers.

*Audience note, and it settles the spelling question:* this layer serves the
public API throughout — reached by rid, no Ontology Manager surface of its own,
uppercase api tokens — so where the two pages disagree, the api page wins here.
The transaction type and status sets themselves are **correct**: both pages agree
and both match ours.

**3. `interface_implementation_mappings`.** `get-object-type-full-metadata`
publishes `InterfacePropertyTypeImplementation` as a **four-arm union whose
fourth arm is recursive**: `localPropertyImplementation`,
`structFieldImplementation`, `structImplementation`, `reducedPropertyImplementation`.
We store a flat `(resolution, object_property_id, backing_column)` triple and can
express the first only. A flat row cannot hold a nested implementation, so this
is not an `ALTER TABLE ADD COLUMN` later — it is a child representation plus a
rewrite of every reader.

This also **falsifies a recorded Decision**: `readings/interfaces-phase.md`
Decision 4 says "Foundry names them only as menu items and gives no API
vocabulary". The api gives exactly that vocabulary. Correct the reading forward
whether or not the shape moves, and note this connects directly to 838's open
question — `structFieldImplementation` is the arm a struct main field implements
an interface through.

**4. `action_type_parameters.data_kind`.** The api publishes `dataType` as a
recursive union: `array` carries a required `subType` that is the whole
parameter-type union, and `struct` carries a `fields` list whose `fieldType` is
the union again. Ours is a flat `(data_kind, base_type)` pair in which `array`
and `struct` are legal terminal values **with nowhere to put the payload** — so
a struct or array parameter is silently underspecified at the schema level. Our
own `object_type_properties` does better, with `array_declares_element` and the
`property_struct_fields` table.

*When fixing it, do not copy `array_element_type` verbatim*: an element type must
itself be a `(data_kind, base_type, object_type_id)` triple, or the shape cannot
hold the object-list parameter `use-actions.md` names — which would be the
half-built foundation.

**5. `build_jobs` and the missing branch dimension.** Two separate things:

- **`builds.status` is right and `build_jobs.state` is the correction that was
  never carried across.** `builds.status` holds `RUNNING, SUCCEEDED, FAILED,
  CANCELED`, the `Build.status` enum verbatim — 493 shipped the job tokens and a
  later migration fixed them. `build_jobs.state` still holds the seven
  Ontology-Manager-prose tokens on a table that is unambiguously an orchestration
  ledger, so the repo applies its own two-vocabularies rule to one column of the
  pair and not the other. **Neither column declares its audience** — verified: no
  column comment and no constraint comment on either — so nothing records which
  is deliberate.
- **The orchestration family has no branch dimension at all.** No `branch_name`
  on `builds`, `job_specs` or `schedules`, and no branch argument on `run_build`,
  while `branchName` is a *required* field of the published `Build`, a field of
  the schedule action, and a *required* member of six of the ten `Trigger` arms.
  `job_specs` further carries `UNIQUE (output_dataset_id)`, which forecloses the
  per-branch JobSpec that `fallbackBranches` exists to fall back across.
- `schedules.trigger` encodes the published one-level camelCase union as a
  two-level snake_case shape (`{type:'event', event:'data_updated'}` against
  `{datasetUpdated:{datasetRid, branchName}}`) and cannot store the published
  `manual` arm. No reading in this repo quotes the trigger union from `api/`.

**None of the four value-set CHECKs in this family carries the `COMMENT ON
CONSTRAINT … Values from <slug>` that 601 requires**, so every audience claim
here is undeclared where the platform suite would read it.

---

## The four that came back clean, and what they overturned

**`object_types` — every top-level field of `ObjectTypeV2` has a home.** The two
things that look like wrong encodings are not: `icon`/`icon_color` is exactly the
`BlueprintIcon` pair the api publishes, and `primaryKey`/`titleProperty` as
boolean flags is resolvable to the same single property because
`object_type_one_primary_key` and `object_type_one_title_key` bound it on our
side. One genuinely missing field, and it is the *first* item of the published
enumeration: Foundry's object type **ID**, a kebab-case slug (`employee`)
distinct from both the uuid and the PascalCase API name, mandatory at save.
`object_type_properties.property_id` is the exact analogue and is built, which is
why this reads as a skip rather than a decision. Additive today; expensive the
moment anything stores a reference to a type the way an application config does.

**`object_type_properties` — the expensive class is not here, and the opposite
of what was recorded is true.** `PropertyTypeMappingInfo` is a three-member union
and **we hold all three**. The question 838's header left open is settled
*against* us being flat: `structs-overview.md` says "A struct property is backed
by a single datasource column whose type is itself a struct", so a field's
`backing_column` names a field *inside* that column and our row-per-field is
isomorphic to the api's map. `editOnly` is `source='user_input'` with a
datasource and no backing column. **`readings/object-type-datasources.md` §5 is
stale** — it still says struct is "Recorded, not built", which stopped being true
at 633 and is what 838 was reasoning from.

**`object_type_datasources` — the generated column is not pointer-inference.**
`datasource_kind` is GENERATED from the exclusive backing arms, so the label
cannot disagree with the data; `editsOnly`, which the api gives no fields at all,
is exactly the ELSE branch. The one cost this encoding used to carry — that a
generated expression could not be altered — does not apply: the database is
PostgreSQL 17.6, where `ALTER COLUMN … SET EXPRESSION` exists, so the remaining
kinds are additive. The api's per-datasource `propertyMapping` map is inverted
onto `object_type_properties.datasource_id`, which `multi-datasource-objects.md`
licenses ("must come from one—and only one—of the input datasources"). Missing:
`ObjectTypeDatasource.rid`, required on the wire. **`readings/api-object-type.md`
§4 is stale** — it says we model three kinds and that `editsOnly` is "Recorded,
not changed", while the live CHECK holds five.

**`link_types` — one row with two sides is the published shape.**
`LinkTypeSideV2` is a per-object-type *projection* of one link type: both sides
carry the same required `linkTypeRid`, and "Creating a single link type between
two object types does not implicitly create a second, reverse link type". The two
divergences a survey would flag are both already declared in
`readings/api-link-type.md` Decisions 2 and 3. Four cheap things remain, and one
is a guard that silently died: the side-API-name uniqueness rule
`create-link-type.md` states is **unenforced** — 261's two indexes were keyed on
a since-dropped `organization_id` and are gone, and nothing replaced them.

---

## Backlog

25 of the 49 load-bearing tables are unaudited, headed by `users` (34),
`markings` (25), `object_type_indexes` (25), `projects` (22), `automations` (20),
`groups` (18), `ontologies` (18), `restricted_views` (16). `pnpm check:shapes`
prints the current ranking on every run; audit the shapes an arc will touch
before starting the arc, because a table gains consumers through other people's
migrations and the gate only sees the one you are changing.
