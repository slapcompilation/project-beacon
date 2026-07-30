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
| `influenced_by` stock_log→occupancy_log | 3802 | many-to-one | on every row | FK column, or object-backed |
| `causes` pos_sale→stock_log | 2548 | **many-to-many** | on every row | **object-backed** |
| `influenced_by` proposal→principle | 261 | **many-to-many** | none | join table |
| `mentions` chunk→entity | 11 | **many-to-many** | on every row | **object-backed** |
| `triggered_alert` stock_log→alert | 14 | many-to-one | none | FK column |
| `linked_to_po` restock_request→purchase_order | 8 | many-to-one | on every row | FK column, or object-backed |
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

All 3,822 rows duplicate `stock_logs.variant_id` **and** carry metadata. Either
the metadata belongs as properties on `stock_logs`, or the relationship is
genuinely object-backed. Worth deciding explicitly rather than by default — it is
the largest single edge type we have.

## What this means for Tier 2

Faithful adoption is **mostly registration and deletion, not construction**:

1. Register the 14 FK-backed triples as link types over columns that already
   exist. No new tables, and 3,922 rows become redundant.
2. Give the 4 substantial relationships their own backing — two look object-backed
   on the evidence (many-to-many + attributes on every row).
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
