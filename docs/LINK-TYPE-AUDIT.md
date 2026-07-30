# Link-type audit — what `relationship_edges` actually holds

Input to Tier 2. Foundry requires **each relationship to be its own link type with
its own backing** — a datasource may back exactly one link type, enforced at save
time (`Phonograph2:DatasetAndBranchAlreadyRegistered`). Our single polymorphic
`relationship_edges` table backing every relationship is the configuration that
error exists to prevent, so the question is what each edge type should become.

Measured against the live project, 2026-07-30. 10,568 edges, 22 distinct
`(edge_type, source_type, target_type)` triples.

## 1. A third of the rows duplicate a foreign key that already exists

**14 of the 22 triples — 3,922 rows.** Under Foundry these need no table at all:
they are "object type foreign keys", registered against the column already there.

| edge type | rows | existing FK |
|---|---|---|
| `consumes` stock_log→variant | 3822 | `stock_logs.variant_id` |
| `sourced_from` variant→supplier | 20 | `product_variants.default_supplier_id` |
| `approved_by` restock_request→user | 19 | `restock_requests.approved_by` |
| `restocks` variant→restock_request | 10 | `restock_requests.variant_id` (reverse) |
| `created_by` restock_request→user | 10 | `restock_requests.requestor_id` |
| `belongs_to_hotel` restock_request→hotel | 10 | `restock_requests.hotel_id` |
| `fulfills` restock_receive→restock_request | 9 | `restock_receives.request_id` |
| `invoiced_by` purchase_order→po_invoice | 8 | `po_invoices.po_id` (reverse) |
| `batch_of` product_batch→variant | 5 | `product_batches.variant_id` |
| `derived_from` proposal→forecast_observation | 4 | `forecast_observations.proposal_id` (reverse) |
| `cited_in` document→chunk | 2 | `document_chunks.document_id` (reverse) |
| `belongs_to_hotel` stock_log→hotel | 1 | `stock_logs.hotel_id` |
| `reverts` stock_log→stock_log | 1 | `stock_logs.revert_of` |
| `belongs_to_org` hotel→organization | 1 | `hotels.organization_id` |

## 2. Only four relationships of substance are genuinely new

6,646 rows with no backing FK, but concentrated:

| edge type | rows | cardinality | metadata | likely backing |
|---|---|---|---|---|
| `influenced_by` stock_log→occupancy_log | 3802 | many-to-one | on every row | FK column (see addendum) |
| `causes` pos_sale→stock_log | 2548 | **many-to-many** | on every row | join table (see addendum) |
| `influenced_by` proposal→principle | 261 | **many-to-many** | none | join table |
| `mentions` chunk→entity | 11 | **many-to-many** | on every row | join table (see addendum) |
| `triggered_alert` stock_log→alert | 14 | many-to-one | none | FK column |
| `linked_to_po` restock_request→purchase_order | 8 | many-to-one | on every row | the one object-backed candidate |
| `created_by` stock_log→user | 1 | many-to-one | none | FK column |
| `fulfills` stock_log→restock_request | 1 | many-to-one | none | FK column |

## 3. `edge_type` is overloaded — the same name means different relationships

This is the finding that changes the count. Four names each cover **two unrelated
relationships** between different type pairs:

- `influenced_by` — stock_log→occupancy_log *and* proposal→principle
- `fulfills` — restock_receive→restock_request *and* stock_log→restock_request
- `created_by` — restock_request→user *and* stock_log→user
- `belongs_to_hotel` — restock_request→hotel *and* stock_log→hotel

Foundry requires unique API names per side per object type, and one link type per
real-world relationship. So the target is **22 link types, not 14 edge types** —
the string vocabulary has been hiding the difference.

## 4. Tenant scaffolding is not a relationship

`belongs_to_hotel`, `belongs_to_org` and `created_by` (23 rows) restate the tenant
and authorship columns every table already carries. Foundry models those as
properties or FK-backed links, never as edge rows. They should not survive as
link types of their own.

## 5. `consumes` is an FK relationship carrying attributes

All 3,822 rows duplicate `stock_logs.variant_id` **and** carry metadata — the
largest single edge type we have, so it should be decided explicitly rather than
by default. **Settled in the addendum: FK-backed, metadata dropped.** Its `delta`
and `reason` are `stock_logs` columns, not properties of the relationship.

## What this means for Tier 2

Faithful adoption is **mostly registration and deletion, not construction**:

1. Register the 14 FK-backed triples as link types over columns that already
   exist. No new tables, and 3,922 rows become redundant.
2. Give the 4 substantial relationships their own backing — join tables, not
   object-backed; see the addendum, which overturned the guess made here.
3. Split the 4 overloaded edge-type names into distinct link types.
4. Drop tenant scaffolding from the link vocabulary.

Only then build `searchAround` on top, with Foundry's depth-3 cap and
declaration gating.

## Method note

The first pass of this audit matched each edge type to the *first* FK between the
two tables, which silently mapped `approved_by` and `created_by` onto the same
column — `restock_requests` has three FKs to users (`requestor_id`, `approved_by`,
`rejected_by`). It also missed `restock_receives.request_id` by guessing the table
was named `restock_receipts`. Both were corrected by listing every candidate
column per pair rather than taking the first match.

---

# Addendum — applying Foundry's structural guidance

`ontology/ontology-structural-guidance` (fetched live 2026-07-30; absent from the
mirror *and* from the 3,696-URL index, so the sitemap missed it) gives the rule
that decides the open question:

> **If the relationship carries its own metadata** — such as dates, roles, status,
> or allocation percentage — **use an object-backed link type to capture that
> metadata.**

> Links should represent semantically meaningful relationships. **Every link type
> should answer a clear domain question.**

> Name links by relationship: a link from `Employee` to `Department` should be
> `department` (from the employee's perspective) and `employees` (from the
> department's perspective).

The discriminator in their example is *ambiguity*: `ventureRole` and
`ventureStartDate` cannot live on `Employee` because an employee has **many**
venture assignments, so an intermediate `VentureStaffing` object is required.

## Applied to every edge type that carries metadata

| edge type | metadata | what it actually is |
|---|---|---|
| `consumes` stock_log→variant | `delta`, `reason` | **columns of `stock_logs`** |
| `influenced_by` stock_log→occupancy_log | `date`, `delta` | columns of the two endpoints |
| `batch_of` product_batch→variant | `quantity`, `expiry_date` | columns of `product_batches` |
| `cited_in` document→chunk | `page`, `chunk_key` | columns of `document_chunks` |
| `fulfills` restock_receive→restock_request | `quantity_received` | column of `restock_receives` |
| `invoiced_by` purchase_order→po_invoice | `status`, `invoice_amount`, `invoice_number`, `discrepancy_amount` | columns of `po_invoices` |
| `mentions` chunk→entity | `page`, `chunk_key`, `document_id`, `entity_name` | columns of the two endpoints |
| `reverts` stock_log→stock_log | `reason`, `backfilled_by_migration` | column + migration marker |
| `causes` pos_sale→stock_log | `seed` | seeding marker |
| `belongs_to_org` hotel→organization | `created_by_migration` | migration marker |
| `linked_to_po` restock_request→purchase_order | `variant_id`, `ordered_qty` | **the only possible exception** — see below |

**Not one edge type carries genuine relationship metadata.** Every payload either
restates a column of the source or target object, or is a seeding/migration
marker. Foundry's condition for an object-backed link is met by **zero** of them.

So the answer to "should `consumes` become an object-backed link?" is **no**. Its
`delta` and `reason` are `stock_logs` columns, and the relationship is many-to-one,
so there is no ambiguity to resolve. It is an FK-backed link and the metadata is
duplication.

**The one to check:** `linked_to_po` carries `ordered_qty` — how much of a request
was ordered on that PO. That *is* relationship metadata by Foundry's definition.
But the intermediary object almost certainly already exists as a purchase-order
line item, in which case this is two FK-backed links through an object we already
have — which is exactly what an object-backed link is.

## Revised Tier 2 shape

- **~14 FK-backed link types** — registered against existing columns, no new tables
- **~4 join tables** for the genuine many-to-many links (`causes`, `mentions`,
  `influenced_by` proposal→principle, and one more)
- **0–1 object-backed link types**, pending the `linked_to_po` check
- **all edge metadata dropped**, since none of it is link metadata

Note what this does *not* say: several of the LINKS are real even where the
metadata is not. `causes`, `mentions` and `influenced_by` have no backing FK and
must exist. The claim is narrower and firmer: **the links are sometimes real; the
metadata never is.**

Foundry's "every link type should answer a clear domain question" also disposes of
`belongs_to_hotel`, `belongs_to_org` and `created_by`: tenancy and authorship are
properties, not domain relationships.


---

# Addendum 2 — the prerequisite Tier 2.2 hit

Registering "one link type per relationship" needs **both endpoints to be
registered object types**. Measured 2026-07-30, only 8 of 17 relationships
qualify:

**Registerable now:** `batch_of`, `consumes`, `influenced_by_principle`,
`linked_to_po`, `log_fulfills_request`, `restocks`, `reverts`, `sourced_from`

**Blocked — the endpoint has no object type:**

| relationship | missing endpoint |
|---|---|
| `causes` pos_sale→stock_log | `pos_sale` |
| `influenced_by_occupancy` stock_log→occupancy_log | `occupancy_log` |
| `mentions` chunk→entity | `chunk`, `entity` |
| `cited_in` document→chunk | `chunk` |
| `fulfills` restock_receive→restock_request | `restock_receive` |
| `invoiced_by` purchase_order→po_invoice | `po_invoice` |
| `triggered_alert` stock_log→alert | `alert` |
| `derived_from` proposal→forecast_observation | `forecast_observation` |
| `approved_by` restock_request→user | `user` |

So **Tier 2.2 has a prerequisite**: register those nine as built-in object types
(the G-series pattern — `source_table` plus derived properties, migrations
223/227). Two of them, `chunk` and `entity`, are the document-pipeline endpoints,
and three (`pos_sale`, `occupancy_log`, `forecast_observation`) are the
highest-volume relationships we have.

Registering half the link types and leaving the rest as raw edges would recreate
the exact split this tier exists to remove, so the order is: **object types
first, then link types, then `searchAround`.**

## Traversal semantics — resolved

`workshop/concepts-variables` closes the question this doc left open:

> Object set: … Initialized from **either an entire object type or another object
> set variable**, then may be optionally filtered … or **optionally pivoted to
> linked objects via a Search Around**.

Object sets pivot "through shared property types or **object-backed link types**",
so an object-backed link is traversed as a **single hop**, like any other link —
not as two hops through the intermediary. It also confirms the chain model
(set → filter → pivot → set) that `api-object-sets` describes.

New from that page, not yet investigated: pivoting **through shared property
types**, with no link type at all.
