# 01 · Speedrun: Your First End-to-End Workflow

Source: `source/01-end-to-end-workflow/` (46 lesson PDFs). The canonical spine — raw data →
operational application in ~60 min. Use case: Office Goods Corp acquired Bureau SAS; two order
systems; build one operational tool to assign orders and surface at-risk deliveries.

Protocol: verbatim step-spine, then Beacon mapping, then the **mandatory-step ledger**.

## Verbatim step-spine

1. **Project + folder** — all resources live in a Project; make a per-course Folder. Naming convention
   `<username>`. Default role Viewer/Discover.
2. **Ingest** — Data Connection has 200+ connectors, but here **manually upload** three CSVs
   (`orders_office_goods`, `orders_bureau_transactional_system`, `consolidated_customers`) as
   "individual structured datasets."
3. **Pipeline (Pipeline Builder, Batch/Standard)** — add the 3 datasets, then transform:
   - **Clean Bureau**: Cast `order_due_date` Date→Timestamp; Filter rows `order_id is not null`
     (treat empty string as null); Normalize column names.
   - **Clean Office Goods**: Cast; Filter `orderId not null`; Drop `orderPlacementDate`; Rename
     `dueDateTime`→`order_due_date`; Normalize names.
   - **Join** each cleaned orders set with `consolidated_customers` (match on customer_id;
     deselect duplicate key columns).
   - **Union** the two joined sets (requires identical schema — the cleaning made them match) →
     `Union Orders` (11 columns).
   - **Add output** → new dataset `all_orders`; **Save → Deploy pipeline**.
4. **Ontology (Ontology Manager)** — "relational digital twin," a compounding, reusable asset. New
   Object Type backed by `all_orders`: name `Order`, **primary key = Order Id**, **title = Item
   Name**, keep auto-mapped properties. Save to Ontology (indexing creates the individual Objects).
   Then **Datasources → Allow edits** (so Actions can write).
5. **Action** — New Action Type → Modify objects → Order. "Assign Order" does two edits at once: sets
   `Assignee` from user input, sets `Status` to static `assigned`. Restrict who can execute. Trim the
   form (delete the Status field from the UI since it's static).
6. **Workshop app** — created from the Order object's Dependents → Workshop. Build:
   - Object Table (all Order properties; sort; first columns Customer/Item/Status/Assignee/Days Until
     Due).
   - Object detail section (Object Set Title + Button group + Property List, bound to the table's
     Active object).
   - Charts section: XY bar (Days Until Due × Status) + Pie (by Status), both fed by a **filtered
     object-set variable**.
   - Filter list widget → new `Filtered Orders` object-set variable (starting set + filter) → rebind
     the table to it.
   - **Button → On Click → Action** = "Assign Order", with `Parameter Default` = table Active object
     (so the selected Order flows into the form). Save & publish.
7. **Operational test** — View mode → filter to an Order → Assign → change Assignee → Submit → green
   toast, table updates. "You've updated an Object via an Action."
8. **Workflow Lineage** (`Cmd/Ctrl+i` on the Workshop) — auto-graph of everything backing the app
   (datasets → object → action → widgets); select a node to see downstream usages; bulk-manage
   actions/security/publish; AIP token-usage metrics.

Conclusion names the productionization deltas skipped: branching, promote-to-prod, scheduled
refreshes, notifications, security on who-can-assign, audit trails, and **real-time write-back to the
source transactional systems**.

## Beacon mapping

The entire spine is Beacon's architecture. No gaps at the concept level:

- **Pipeline Builder clean/join/union** → our ingestion + Pipeline Builder parity (Tracks). Union
  needing identical schema = the grain/bad-join discipline (deep-dive session 2), verbatim.
- **Object Type: deterministic PK + explicit title + allow-edits** → our node discipline (PK never
  random; title rule) — confirmed a 3rd time. `Allow edits` gate = the mutation layer boundary.
- **Action = two edits + restricted executor + trimmed form** → `BeaconAction` with submission
  criteria + `open-form`/`apply-immediately` + scope-gated actor. The static-Status rule is exactly
  our "action sets a computed field" pattern.
- **Workshop table/detail/charts/filter/action-button, all bound to one filtered object-set var** →
  our Object Views + selection-aware surfaces. The `Active object → Action parameter default` is our
  selection-aware copilot passing the current node id.
- **Workflow Lineage (Cmd+i)** → our GraphConnections + the Search Around graph (#371) + reverse
  document lineage (#369). Their "downstream usages of a property" is our lineage direction.

## Mandatory-step ledger

| # | Mandatory step | Beacon | Where |
|---|---|---|---|
| 1 | Project/folder scoping + naming | ✅ | org/hotel scoping, RLS |
| 2 | Ingest raw data (upload or connector) | ✅ | doc/data ingest fns; Mews/Square connectors |
| 3 | Clean transforms (cast/filter-null/normalize) | ✅ | Pipeline Builder parity (Track 1) |
| 4 | Join to reference data | ✅ | pipeline joins; grain discipline enforced |
| 5 | Union to a single source-of-truth | ✅ | pipeline union (schema-match gate) |
| 6 | Deploy an output dataset | ✅ | materialized outputs |
| 7 | Create Object Type: deterministic PK + title | ✅ | typed nodes, PK/title discipline |
| 8 | Enable edits on the object | ✅ | mutation layer / Action Registry boundary |
| 9 | Define an Action (typed edits, restricted executor, form) | ✅ | `BeaconAction`, submission criteria, invocation mode |
| 10 | Build operational app (table/detail/charts/filter) | ✅ | Object Views + Insights lenses |
| 11 | Wire Action into the app (selection-aware default) | ✅ | selection-aware copilot / action bar |
| 12 | Operational write-back + audit toast | ✅ | Action → immutable StockLog + toast |
| 13 | Workflow/data lineage view | ✅ | GraphConnections + Search Around + reverse doc lineage |

**Verdict: 13/13 ✅.** Guide 1 is Beacon's exact end-to-end shape. The only deltas the course itself
flags as "skipped" (branching, scheduled refresh, external write-back) are on our own backlog
(external write-back = the C-10 partial from guide 6).
