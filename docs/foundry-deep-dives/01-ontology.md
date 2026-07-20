# Deep Dive 1 — Creating Your First Ontology (capture)

> Captured 2026-07. Source: full course text + 28 screenshots from the user.
> **Cross-verified 2026-07-19 against the source PDFs** (`source/01-ontology/`, 18 lessons): every
> load-bearing fact matches — exercise answers, lineage counts, PK/title doctrine, cardinality
> reasoning, action concepts, Object Storage v2. No corrections required.
> Verbatim record first; Beacon mapping at the bottom. Unknowns are marked `OPEN:`.

## 0. Course frame (their own words, condensed)

- Foundry's most-used data is presented as **objects**; an object's data is "typically aggregated from
  many different original data sources" (an Aircraft pulls from purchase records, maintenance systems,
  flight systems…).
- **The Ontology defines the set of object types available.** Each Foundry instance has its own set,
  specific to that organization; the same type (Aircraft) has different properties/relationships at an
  airline vs the military. "The Ontology reflects the real-world objects that users at a given
  organization think about and operate on every day."
- The four stated values: (1) makes data easier to use; (2) provides a **common operational
  vocabulary** across workflows and the organization; (3) supports operational decisions through
  **well-defined actions**; (4) **powers AI** solutions in an operational day-to-day context.
- Prereq: the E2E Speedrun (ingest → Pipeline Builder → first object type → Workshop app).

## 1. Marketplace install (the delivery mechanism)

Steps as given:
1. Left sidebar → **Applications** (sidebar order: Home, Search… ⌘J, Notifications / Recent, Files,
   Applications / APPLICATIONS list starting with Object explorer).
2. Applications search "Marketpla" → app categories with counts: All apps (1); PLATFORM APPS:
   Administration 0, Analytics & Operations 0, Application development 0, Data integration 0,
   **Developer toolchain 1 → Marketplace** ("Discover and install Foundry-built products").
3. In Marketplace, search **products** (top bar `Search products...`, explicitly *not* the lower
   `Search stores...` bar) for "Deep Dive: Creating your first Ontology" → product card "From Palantir
   Learning Store".
4. Product page: tabs **Overview | Changelogs | Content | Inputs | Installations | Linked products**;
   right rail Version **1.1.0**, Release Channel **Release**, Store Palantir Learning; buttons
   **Open ▾ / Install again**; **Installations** panel listing existing installs (with an "Upgrade
   available" badge on a 1.0.0 install). Course rule: if an installation already exists, reuse it and
   skip to Object Explorer.
   - v1.1.0 content: **Workshop Applications (21)** (e.g. "Panel Object View Module <uuid>", "Object
     View Module <uuid>"). Description: "pre-built pipelines and open-source datasets that back a
     robust ontology in the **airline domain**" (v0 was healthcare — Patient, Surgery, Treatment Type,
     Patient Outcome — kept in a v0 folder; that older 0.3.0 page showed Content: Datasets 4,
     Pipelines 1).
5. Install wizard (left steps **General → Content → Review**):
   - **General**: Installation mode **Bootstrap** ("recommended and default settings … specified by
     the product builder"). **Installation suffix** toggle + `username` ("suffix will remain the same
     if the underlying product name is changed later"). **Installation location**: browse to
     `Learning (<username>)` project → create folder `Deep Dive: Creating your first Ontology`;
     Namespace field (e.g. `…-19dedf`); "Generate new project" alternative. **Permissions**: Roles
     ("Role grants can only be set up when creating a new project through marketplace") +
     Organizations checkbox. → Next.
   - **Content**: **Prefix ontology entities** toggle + `username` (use when many installations
     exist). **Ontology schema migrations** consent checkboxes (all unchecked by default):
     *Allow drop migrations of Ontology property edits* ("Installation may automatically drop property
     edits from existing objects"); *Allow cast migrations* ("automatically cast property edits or, if
     a safe type cast is not possible, may drop"); *Allow move migrations of property edits*; *Allow
     move migrations of Ontology datasource edits* ("automatically move datasource edits from an old
     backing datasource to a new backing datasource"). → Next.
   - **Review**: "**All validations have passed**" banner; Messages (1): "Automatic upgrades will be
     disabled for this installation". Manifest by kind — **Compass resources**: Workshop Application
     (21), Pipeline (32), Dataset (51), Notepad document (5), File (2); **Data health check (5)**;
     **Object Explorer edits**: Object view (7); **Ontology edits**: Object type (8). → **Install**.
6. Timing: 5–8 min to install resources, 5–10 more to build them, "potentially another 10 minutes or
   so (not shown in the UI)" to finish **indexing all object data into the object layer**.

## 2. Context: Fresh Air + its ontology

- Fresh Air: notional regional airline, ~4,500 employees, eastern half of the US, ~500 flights/day,
  83 destinations, HQ Fort Worth TX, busiest hubs on the east coast. You role-play a new Flight
  Operations employee.
- The 7 object types (screenshot graph, edges labeled `⇔` with a count): **Airline** — Route (⇔1) and
  Aircraft (⇔1); **Route** — Airport (⇔2 — origin + destination) and Flight (⇔1); **Aircraft** —
  Flight (⇔1) and Flight Alert (⇔1 — OPEN: alert-to-aircraft link shown in graph but not discussed);
  **Flight** — Flight Alert (⇔1); **Airport** — Runway (⇔1).
- Narrative: an Airline operates a fleet of Aircraft; Aircraft fly Airport→Airport landing/taking off
  on a Runway; a Route is the connection between two Airports; a **Flight is a specific instance of an
  Aircraft flying a Route at a particular date and time**; delay/cancellation/diversion generates a
  **Flight Alert**, which Flight Operations responds to.
- Types carry an `[OFT]` prefix (Ontology Foundry Training) to avoid naming conflicts — namespacing by
  convention.

## 3. Object Explorer

Welcome screen: one search bar with two halves — **Search across** (dropdown: Groups | Object types
tabs) + **Search term**. "Switch to old home page" toggle; "All Ontologies" scope dropdown; tabbed
"New exploration" sessions.

**Single object flow:** filter Search-across to `[OFT] Airline` ("this search will be more reliable if
you filter down to the object type first") → search "Fresh Air" → results page shows Objects 157 /
Object types 1 tabs, a "Filter results by type" rail, and hit cards with matched properties
highlighted (Callsign FRESH AIR, Common Name, Carrier Name). Open **Fresh Air Inc**.

Object view anatomy: header (icon, title, star, type tag) + toolbar (refresh, comments, search,
More ▾) + **tabs: Overview | Properties | [OFT] Aircraft 110 | [OFT] Routes 320 | ›** (link tabs carry
counts) + body: key properties (Carrier Name, IATA "FA", World Area Code Description) and a **map
widget** "Service Area – Airports" (Mapbox/OSM, filter icon, "Destination Airport" legend). Course
answers established: IATA on Overview; ICAO only on the **Properties** tab (less-used property →
demoted from Overview); property **mouseover reveals its definition** ("International Civil Aviation
Organization"); fleet chart "Aircraft Fleet by Manufacturer & Model" (answer: Bombardier).

**Explorations** (object-*set* analysis): from the object's Routes tab, hover the `[OFT] Route 320`
list header → **Open in Explorer** → an exploration of the 320 routes.
- Filter bar reads as a sentence: `Linked to [OFT] Airline is any of Fresh Air Inc` + "Search
  properties to add a chart or filter…".
- **Charts are derived from properties** (badged "Experimental"): Origin, Destination, Operating
  Carrier (bar charts w/ counts: CLT 64, DCA 60, PHL 37…), Flight Count (histogram, `+ Group by`,
  min/max inputs), Earliest/Latest Flight Date. Chart hover controls: **Filter chart** (magnifying
  glass), **Show percentages**; multi-select bars → `Keeping` / **`Excluding`** → Apply filter. Undo
  arrow reverts chart deletions/pivots.
- Right rail: **Results** (320, sortable, title list) + **Linked objects** panel (Destination Airport,
  Origin Airport, Flight, Airline) + View all results →. Toolbar: layout preset ("Default Route
  Layout ▾"), Compare ▾, Explore/Results toggle, result count, Actions ▾, Save, "Open in ▾".
- **Pivoting**: click a Linked-objects entry to swap the whole set to the linked set (320 Routes →
  their Origin Airports). Course explicitly warns this is *not* the pivot-table concept — it is
  set-to-set link traversal. Exercises: exclude top-3 hubs on Origin AND Destination → only BNA-RDU /
  RDU-BNA remain; pivot to Origin Airports, filter Altitude → AVL, single 7,001-ft runway; longitude
  chart → westernmost = OKC.
- Positioning: Object Explorer = search + basic exploration for any user; **Quiver** for richer
  numerical analysis/visualization/timeseries/dashboards; **Workshop** for regular operational
  workflows.

## 4. Data Lineage

Why (their words): with years of collaborative layered work, "the current state of any given dataset
and its relationship to others … could become very confusing." Data Lineage = bird's-eye view of how
datasets, object types, and resources connect; shows each dataset's state; can act (e.g. rebuild a
dataset out-of-date with its inputs).

Flow: from the Fresh Air object → **More > Advanced > Explore data lineage**. Right panel → Search
Foundry tab → Object types → filter `[OFT]` → add all 7. Select all (Ctrl/Cmd+A or shift-drag) →
**Expand** → `<<` **Expand parents** → "Add 30 nodes" → **Layout all nodes**.

Result: **11 uploaded (raw input) datasets → 35 derived datasets → 7 object types.** Sources include
`airlines.dat`, `T_CARRIER_DECODE.csv`, `L_CARRIER_GROUP_NEW`, `L_WORLD_AREA_CODES`,
`source/T_ONTIME_REPORTING`, `ENGINE.txt`, `ACFTREF.txt`, `MASTER.txt`, `T_MASTER_CORD.csv`,
`airports.dat`, `source/Runway_Lines` — naming convention `raw/<x>` → `clean/<x>` → semantic
intermediates (`bts_airlines`, `openflights_airlines`, `faa_aircraft`…) → `ontology/<x>` → object
type. Two sources (BTS + OpenFlights) merge into single ontology types.

UI details: branch dropdown (`master`); health checks in the header (`✓5 ✗3`); toolbar Tools/Layout/
Undo/Clean/Select/Expand/Color/Find/Remove/Align/Flow; **Node color options** dropdown — Resource
overview (default), **Resource type** (Dataset 35 / Raw dataset 11 / Not applicable 7), **Project**,
**Repository**. Course answers: all datasets in the same *project*; **every dataset produced by a
different repository**; select a node → bottom-panel **Preview** (ontology/airports = 4.3k rows × 18
cols) and **Code** tab / right-panel "**Updated via**" link → opens the defining app (Pipeline
Builder) with its transforms.

**Course reflections on lineage (the argument, worth keeping):**
- *Ease of use*: imagine answering the Object Explorer questions from this dataset graph with query
  tools — first deciding which datasets to start from, then how to combine them. "That work has
  already been done by the data engineers who built this pipeline and the Ontology."
- *Common vocabulary*: two teams using different canonical airport lists (BTS vs OpenFlights) are
  **forced into resolution** because there is only one Airport object type. New airport data should be
  merged into the type, not left as another dataset. Row- and column-level permissions on backing
  datasources allow one shared type where users see only what they may.
- *Golden tables are not enough*: marking a dataset "golden" (Data Catalog) degrades in practice into
  `airports_with_geojson`, `airports_fresh_air_staff_enriched`, `better_airports` — "local variants
  and dialects in what is intended to be an authoritative common vocabulary." The ontology being a
  **separate object layer above the dataset layer** is what gives it stronger control over the types.
- Types grow richer over time → later workflows bootstrap on them (Airport built for Flight Ops gets
  reused/augmented by Fleet Maintenance).

## 5. Ontology Manager — create the object type

App: **Ontology Manager** (a.k.a. OMA). Header: resource search (Ctrl+K), **New ▾**, edit counter +
green **Save**. Left rail: ontology switcher (e.g. "Palantir (Unmarked) Ontology"), Discover, History;
Resources: Object types (count), Properties.

Positioning note (verbatim substance): object/link types can also be defined from Pipeline Builder,
but "you can currently only edit ontology type definitions **from the application you used to
originally create it**" → use Ontology Manager as the default tool. Permissions fallback: switch
ontologies via the top-left dropdown, or use **Ontology Proposals** — orgs that limit edits to the
production ontology require a custom **branch** + admin approval to merge.

**Create object type** (New > Object type):
1. Datasource: *Use existing datasource* → select the `flight_alerts` dataset (path
   `…/Deep Dive: Creating your first Ontology/data/flight alerts/ontology/`).
2. Name: `[<username>] Flight Alert` (plural auto-updates).
3. **Primary key** = Flight Alert Id; **Title** = Alert Title.
4. **Skip creating any generic action types** → Create.

Object type Overview page: Plural name, Description, Aliases, Point of contact, Contributors,
Ontology, **API name** (`UsernameFlightAlerts`); right box: **Status: Experimental ▾**, Visibility:
Normal ▾, Edits: Disabled; **ID** (`username-flight-alerts`), **RID "Set on save"**. Properties list
(27) with badges: `Flight Alert Id [Primary key]`, `Alert Title [Title]`, Root Cause, Priority
(Double). Action types panel (0). Bottom: datasource preview with **Preview objects | Preview table**
toggle (the row→object mapping made visible). Left rail per type: Overview, Properties, Security,
Datasources, Capabilities, Object views, Interfaces, Materializations, Automations, Usage, History.

Save flow: **Save → Save to ontology → Save changes**; if others changed the ontology meanwhile, you
may be prompted to pull their changes first (merge-before-save).

**Concepts taught with it:**
- Mapping: dataset → object *type*; **row → object instance; column → property** (explicit slide).
  Datasource permissions also gate object visibility. Actions can create/delete objects, so "over
  time, the mapping from rows to objects may not always exist for all rows."
- Columns vs properties are **not 1-to-1**: rename, drop, or add **edit-only properties** (new
  property with Source = *User edits*, no backing column, writable only through actions).
- The `root_cause` column ships **empty (all null) by design** — root cause is collected from
  operators later via the action. Edit-only would also work; the empty pipeline column was chosen to
  "make it easier to insert a data-derived root cause value later" if a new source enables automating
  it. (Deliberate seam: human-filled today, pipeline-fillable tomorrow.)
- **Primary keys**: unique, never null, strings best. If no natural key, **derive deterministically**
  (concatenate columns, optionally hash). "**Never generate a random ID or GUID … as part of a data
  pipeline** — if the pipeline is ever rerun, all of your object IDs will change."
- **Title**: the human-readable name used in search results and most apps; derive one if the key is
  opaque.
- **Object Storage v2**: saving triggers an async **indexing pipeline** (spinner top-left → Datasources
  tab progress; errors like non-unique primary keys surface there as job details). Objects appear in
  Object Explorer **only after indexing succeeds** (183,999 objects once built). A "Replacement
  pipeline" panel shows `flight_alerts — Changelog ✓ — Merge changes` ("Resync the data in the backing
  stores using the latest object type definition").
- **Actions philosophy at creation time**: they deliberately skip generic CRUD — no Create (pipeline
  creates alerts), no Delete (alerts are resolved, never deleted), and edit only via a **targeted**
  action touching specific fields.

## 6. Create the link type

New > Link type → **Object type foreign keys** → choose the two types (left `[username] Flight Alert`,
right `[OFT] Flight`) → **Foreign key** for Flight Alert = `Flight Id` → **Cardinality: One Flight to
Many Flight Alerts** → Submit.

Link definition page: Join method tabs **Foreign key | Dataset** (OPEN: dataset-backed many-to-many
join links exist — shown as the alternative tab and used by the walkthrough's Chunk↔Entity join table —
but this course only exercises the FK path). Cardinality diagram; the FK property pairing
(`Flight Id` ⇄ `Flight Id [Primary key]`). Both directions get sentence renderings and **API names**:
"Each Flight Alert has **one** [OFT] Flight" → `…FlightAlert.oftFlight` `.get()`; "Each [OFT] Flight
has **many** Flight Alerts" → `oftFlight.…FlightAlerts2` `.all()`. Per-direction Visibility. Status
Experimental; ID `username-flight-alert-flight1`; RID set on save. Save to ontology as before.

**Cardinality concept (their reasoning, verbatim substance):** cardinality depends on *how you model
the world*, not just the data — Airline–Aircraft is 1:many if modeling present-day ownership, but
many:many if modeling ownership over time or operations (codeshares, leases). For alerts: the notional
pipeline generates one alert per flight (practically 1:1), "however, that is not a constraint we would
want to impose here" — conceptually a flight can raise several alerts (late departure, then a
diversion) → **declare 1:many for the concept, not the current data.**

## 7. Create the action type

Precondition: object type → **Datasources tab → Edits → Allow edits** toggle ON ("Disabling edits will
not remove existing edits"). Same panel: **Track user edit history** toggle ("Logs user edits … and
displays those logs in Edit History widgets") and **Conflict resolution** — resolved
**property-by-property**: properties without user edits keep following the latest pipeline data;
"regardless of resolution, all values are still written"; edit-only properties always use the latest
user edit.

New > Action type → tab **Object** → Object type `[username] Flight Alert` → **Modify object(s)** →
Next → **Add property > Root Cause** → Next → name `[<username>] Assign root cause` → Next →
permission: **User tab → yourself** → Create.

Action type page — left rail: **Overview, Rules, Form, Capabilities, Security & Submission Criteria,
Automations**. Overview shows API name, RID, and an **Action type overview diagram**: Input
(`[username] Flight Alert` + `Root Cause`) → Rules (Modify object → Modify Root Cause).

Concepts:
- **Action Form**: every invocation context renders a common input form generated from the parameters
  (Parameters/Form tab preview). Customization: rename fields, defaults, hide fields, **constrain
  free text to a choice list entered manually or derived from a dataset** (the original `[OFT]` action
  does this for Root Cause).
- **Submission criteria**: who may invoke, set at creation, edited on Security & Submission Criteria.
- **Rules & side-effects**: an action runs one or more rules — modify object, **send a Foundry
  notification, invoke a webhook to call an external system, or create and delete other objects**.
  Alternatively the whole action can be **backed by a function** (code).
- Execution: Object Explorer → open one Flight Alert (26 properties incl. delay decomposition:
  Carrier/Weather/NAS/Security/Late-Aircraft Delay; Links section → [OFT] Flight 1) → **Actions ▾ →
  [username] Assign root cause** → form → free text ("Waiting for gate assignment upon arrival") →
  Submit → property updates in place. If Actions ▾ is missing: save + wait for indexing + refresh.

## 8. Course conclusion (their argument)

- The Ontology is "more than another 'semantic' data layer. It also includes **'logic'** through the
  rules that it encodes and **'kinetics'** through its actions. It is both the **nouns** of your
  organization, but also the **verbs**."
- Growing the workflow = enumerate the *decisions* (assign alert to operator, forward to maintenance,
  reassign crew, queue rebooking, update gate, reschedule/swap aircraft, mark resolved) → the decisions
  reveal the *data* the ontology still needs (crew status, plane availability, passenger counts). As
  complexity grows, leave Object Explorer for Workshop apps — which **reuse everything: pipeline,
  object type, links, and actions**. Result: "a dynamic **digital twin** of the organization."
- **Ontology and AI**: (1) the ontology provides clean inputs AI needs, "structured … in real-world
  terms that an LLM is already familiar with"; (2) it provides a **destination for AI outputs** — "the
  best place for a Flight Alert recommendation or prediction would be **on the Flight Alert object
  itself**", inside the workflow where operators already decide, which "makes it easier to then
  collect feedback on the final decisions … when they use the recommendations and when and why they
  disregard them."
- Tool roles: Object Explorer (search + basic set exploration), Data Lineage (pipelines → ontology),
  Ontology Manager (building the ontology). Next steps named: Object Views, Quiver, Workshop, OSDK.

## OPEN items

- OPEN: Aircraft—Flight Alert link appears in the ontology graph screenshot but the course never
  explains it (Flight Alert's only discussed link is to Flight).
- OPEN: the **Dataset** join method for link types (many-to-many via join table) is visible as a tab
  but not exercised here — expect detail in a later session or the walkthrough's Chunk↔Entity join.
- OPEN: Object type left-rail sections **Capabilities, Interfaces, Materializations, Automations** are
  visible but never opened in this course.
- OPEN: Ontology Proposals workflow (branch → approval → merge) referenced but not demonstrated.
- OPEN: exact behavior of the four schema-migration consent options during product *upgrades*.

---

## Beacon mapping (analysis — separate from the record)

**Confirms (no change needed):**
- Our Action Registry matches their action grammar 1:1 — targeted actions over generic CRUD, submission
  criteria, rules/side-effects, form-from-schema (`open-form`), function-backed actions. Their
  "no Create/no Delete for alerts, compensating workflow instead" is exactly our StockLog stance.
- "AI output lives ON the object, in the operator's existing decision flow, and you collect
  when/why recommendations are disregarded" = our Proposal + review queue + calibration flywheel,
  stated by Palantir as the core AI pattern. Strong validation of Pillar 1.
- Ontology Proposals/branching = git + PR review; their "can only edit a type from the app that
  created it" split-brain is a platform wart code-as-ontology doesn't have.
- Object Storage v2's async indexing lag (save → wait → refresh) is a cost we don't pay with Postgres.

**Settles parts of the P6 fork (doc-ingestion roadmap):**
- **PK discipline is now doctrine**: deterministic, derived (concatenate + optional hash), string,
  *never* random per pipeline run. Our composite `chunkId` (`docId_page_chunk`, P3) complies; Entity
  PK = `entityName` complies. Any future ingest re-run must produce identical ids.
- **Title rule**: every node human-readable title; Chunk title = `summary` (matches walkthrough),
  Entity title = `entityName`.
- **Declare cardinality on edges as modeled, not as observed**: `mentions` = many-to-many;
  `cited_in`/`describes_entity` should get explicit cardinality in the P6 design. Today our EdgeType
  union carries **no cardinality declarations at all** — worth adding as metadata when we extend the
  ontology (compiler-checkable, cheap).
- Their link **API names per direction** (`alert.flight.get()` / `flight.alerts.all()`) = our typed
  reader/traversal functions; P6 should name both directions when adding `mentions`.

**New ideas worth stealing (beyond doc-ingestion):**
1. **Edit-only properties + per-property conflict resolution.** Their model: a property is either
   pipeline-fed or operator-edited; edits win per-property; disabling edits preserves them; optional
   edit-history tracking. Our analog is scattered (Proposal outcomes, per-field edit-and-approve). The
   `root_cause` pattern — *empty pipeline column today, human fills it via action, data can take over
   tomorrow* — is a clean seam for fields like waste reasons and alert root causes.
2. **Set-pivot ("Linked objects") exploration grammar.** Object set → one click → the linked set, with
   property-derived charts auto-generated per set, exclude-filters, percentages, undo, saveable
   explorations. This enriches the Search Around backlog item (#2): the primitive is not just
   graph-drawing, it's **set-to-set traversal with instant per-property stats**.
3. **Link-tab counts on Object Views** (`[OFT] Aircraft 110 | Routes 320`) and "less-used properties
   live only on the Properties tab" — cheap Object View polish rules we already half-follow.
4. **Data lineage as an operator-visible surface** (branch, health ✓/✗, per-node "Updated via" →
   opens the defining logic). Our doc pipeline's stage marker (raw→ocr→embedded→contextualized→linked)
   is a per-document lineage; D-phase surfaces should show it as such.
5. **Marketplace as packaged-install** (versioned bundle + validations + namespacing suffix/prefix +
   explicit schema-migration consent + upgrade channels) — the long-horizon platform play; our demo
   seeding is the embryonic analog. Not actionable now.

**Does NOT settle (still parked):** hospitality entity categories for discovered entities (P6), embed
target summary-vs-full-chunk (P5 — expect session 2), chunks-as-nodes granularity trade-offs.
