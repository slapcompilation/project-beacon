# Deep Dive 4 — Building Your First Application / Workshop (capture)

> Captured 2026-07-19 from source PDFs (`source/04-workshop/`, 19 lessons; citations `lesson.pdf`).
> Condensed record in our words with short quotes; Beacon mapping at the bottom. Unknowns `OPEN:`.

## 0. Course frame (Introduction, The Use Case)

- Workshop = Foundry's point-and-click application builder **on top of the Ontology**. Apps "view and
  interact with data … make and capture decisions … and collaborate" — their definition of an
  **operational application**, explicitly contrasted with "read-only insights in dashboards":
  operational apps "are more likely to affect outcomes and create value."
- The three ontology hooks, stated up front: data comes from **object types** ("You cannot build
  Workshop applications directly from datasets"); **link types** provide related objects via search
  around; decisions are captured via **action types**, which edit objects. 2–3 hour course.
- Use case: Shipment Operations Center on a supply-chain ontology — **Product, Product Shipment
  (many per Shipment), Shipment, Location, Vehicle (has capacity)**. Consolidation rule: same
  departure date + same arrival date + combined quantity under vehicle capacity.
- Delivered via a Marketplace product (namespace + ontology selection + username prefix on ontology
  entities — same install grammar as session 1).

## 1. The module & the variable system (the core grammar)

- New → **Workshop module**; rename to `Shipment Operations Center`.
- Left-panel tabs: **Overview, Layout, Variables, Changelog, Profiler, Settings** (OPEN: Changelog
  and Profiler never opened in the course).
- **Variables carry all data.** Widgets take input variables and "most widgets will also produce
  output variables" (e.g. the currently-selected object set). Wiring an app = feeding one widget's
  output into another's input, "possibly with some intermediate manipulation."
- **Variables are statically typed** — primitives (string, boolean, numerical, date, timestamp) or
  the **object set** type; "the type of the variable dictates how it can be used. This provides type
  safety when building applications."
- Object-set variables can be defined three ways: the **graphical object set builder** (starting
  object set → filters → link traversal), a **function (TypeScript or Python)**, or a **transform of
  other variables**. First variable: `All Shipments` = all `[username] Shipment` objects.
- Workshop tracks variable usage: **unused-variable warnings** (orange, next to Save and publish) and
  selecting a variable in a config **highlights every widget that uses it**.

## 2. Widgets built in the course

- **Chart: XY** — PLOT LAYERS list; per layer: data input (object set var), X-axis property,
  bucketing (Day), series (default count). Later: a second layer over `Filtered Product Shipments`
  with **Sum of Quantity segmented by Product Description**; **dual Y axes** (Customize under Y AXIS)
  when scales differ by orders of magnitude; first layer converted to **Line Chart** (dashed, Gray 1);
  axis renames, number-format grouping (110000 → 110,000), legend placement, **per-segment color
  overrides keyed by value** ("Blue Triangles" → Blue 3, etc.).
- **Filter list** — key design point: its output is **a filter *definition* variable, not an object
  set** — "You can either combine multiple filters from different widgets onto one object set or
  reuse the same filter on multiple different input object sets." Pattern: `All Shipments` +
  `Shipments Filter` (the output) → new derived variable `Filtered Shipments` (starting set + Filter
  > Using a variable); widgets then consume the derived set.
- **Object table** — column list, default sort, fit-columns-horizontally; config options carry
  hover-`?` explanations.
- **Gantt chart** — sections can **enable tabs** (Product Shipments | Schedule); layer over
  `Filtered Shipments` with **event start/end date properties** (departing/arriving dates);
  **properties-to-show-on-hover** (Total Unit Quantity, Vehicle Unit Capacity, later Status);
  equal-length bars visually surface consolidation candidates.
- **Button group** — per button: TEXT, INTENT (Success), LEFT ICON, ON CLICK → run an Action;
  **PARAMETER DEFAULTS → local default value ← a variable** (the Gantt's `Selected Shipment` output),
  so the action form opens pre-populated with the user's selection.
- Layout: sections in **rows/columns**, "Add section inside", move/drag in the Layout hierarchy,
  page + section padding, **section headers** (Callout style, title, icon, color, Standard/Large
  size, collapsible).

## 3. Save / publish / versions (Save, publish, and view)

- **Edit mode vs View mode** — different URLs; operators get the View URL; Edit requires the Editor
  role on the resource.
- Every save creates a **new immutable version** (semver-style, e.g. 0.3.0, shown under the title).
  **Saving auto-publishes by default**; the versions dialog can disable that, making save and publish
  two separate steps. Version history supports viewing old versions and **revert** — "published
  features can be quickly rolled back … if a bug was introduced."

## 4. The action arc (point-and-click, then function-backed)

**Single-shipment action (Mark a shipment for consolidation):**
1. Gantt layer → OUTPUT → **Enable selection** → `Selected Shipment` object-set variable.
2. Ontology Manager (namespace/ontology must match the install): Shipment → Datasources → **Allow
   edits** → save.
3. New > Action type → Modify object(s) → add the Status property mapped to a **Static value**
   `Eligible for Consolidation` — the user is never prompted; the action always sets that value.
   Metadata (name/description/icon) → submission criteria (User = self) → Create.
4. **Rules page shows the TypeScript code equivalent of the point-and-click definition** — the GUI
   action compiles to code. UI page: the auto-added (now unused) Status string parameter is flagged
   unused and deleted.
5. Workshop button wired to the action with the selection as parameter default (see §2).

**Conditional formatting lives on the ontology, not the app:** Gantt EVENT COLOR → Property → Status
→ "Configure" jumps to Ontology Manager → property **Display tab → Conditional Formatting rules**.
Rules evaluate **top-to-bottom, first match wins**: `is exactly "Eligible for Consolidation"` →
Warning (orange); `Always true` catch-all → Light Gray. Stated rationale: "formatting rules can be
**defined once in the Ontology and used across multiple applications**." Workshop then just picks the
rules up (after a refresh).

**Function-backed action (Mark multiple shipments):**
- Motivation: point-and-click covers simple actions; for "looping over a set of objects, conditional
  functionality, or complex aggregations" use **Functions** (TypeScript or Python) → then a
  **function-backed action type**. Functions can also feed Workshop directly (computed object
  sets/metrics).
- New > Code repository → type **Functions** → **TypeScript Functions** → `index.ts` (a `__tests__/`
  twin exists — "do NOT edit that file").
- **Resource imports**: ontology types must be explicitly imported into the repo before code can use
  them (also importable: models, data sources, other functions). The imports view shows the **API
  names** (object `UsernameShipment`, properties `shipmentId`, `status`).
- The function (their shape, condensed): decorators `@OntologyEditFunction()` +
  `@Edits(UsernameShipment)`; signature `public markShipmentsForConsolidation(shipments:
  ObjectSet<UsernameShipment>): void` — action-backing functions **must return void**; body:
  `shipments.all()` then map assigning `status = "Eligible for Consolidation"`.
- **Live Preview** (Functions tab): run the function against a real object-set input interactively —
  "**Edits are not written back to the Ontology** when running functions from within a code
  repository" — a dry-run harness showing the would-be edits.
- Release flow: **Commit → Tag version (Minor) → Tag and release** → checks compile and publish
  under the tagged version (blue → green) — only then can an action type be built on it.
- Ontology Manager → New > Action type → **Function tab** → pick the function (code preview shown)
  → metadata + submission criteria → save. Workshop button re-pointed to the new action; Gantt
  **Enable multiselect** (Ctrl/Cmd-click) → action form receives 2 shipment objects → Submit.

## 5. Summary lesson (their wrap-up, condensed)

Built from scratch: module creation; saving/versioning/viewing; widgets; **variables as the wiring**;
sections/layout; styling incl. ontology-level conditional formatting; actions both point-and-click
and function-backed. Decisions captured through actions flow back into the Ontology "to the benefit
of all users and workflows that rely on the same objects."

## OPEN items

- OPEN: **Profiler** and **Changelog** side-panel tabs — visible, never used.
- OPEN: "search around" is named in the intro as the link-type mechanism; in practice the course only
  uses variable-level link traversal (Get linked objects). The interactive Search Around surface is
  not part of this course.
- OPEN: multi-module composition / embedding, and Workshop's function-computed metrics — mentioned as
  possibilities, not shown.
- OPEN: the `__tests__/index.ts` twin (testing functions) — pointedly excluded.

---

## Beacon mapping (analysis — separate from the record)

**Three strong confirmations of our architecture, in their own product:**
1. **The GUI compiles to code.** The action's Rules page literally displays the TypeScript equivalent
   of the point-and-click definition, and complex actions *require* writing TS with typed decorators
   (`@Edits(Type)`, typed `ObjectSet<T>`, forced `void`). Code is the ground truth under Workshop's
   no-code veneer — the strongest validation yet of code-as-ontology + NL-authoring-over-canvas.
2. **Selection-aware action defaults** (button PARAMETER DEFAULTS ← selected-objects variable) is
   exactly our selection-aware copilot / prefilled ActionFormModal pattern.
3. Their "operational application vs read-only dashboard" framing is our "AIP-shaped, not
   dashboard-shaped" principle, and "you cannot build from datasets, only the Ontology" is our
   no-raw-Supabase-in-apps/web rule stated as product law.

**The one real steal — ontology-level conditional formatting.** Status→appearance rules live on the
*property in the ontology*, evaluated first-match top-to-bottom, consumed by every app that renders
the property. Our analog is partial: `objectPresentation.ts` owns per-*type* presentation, and
confidence coding is a one-off convention. The Foundry-exact move is **value-level formatting rules in
the registry** (e.g. proposal status, urgency, lifecycle states → intent/color, declared once,
rendered identically in ReviewQueue/ObjectViews/Floor). Cheap, high-coherence; candidate for the
objectPresentation backlog.

**Smaller patterns worth remembering:**
- **Filter-definition variables** (filters as first-class reusable values, composable onto any object
  set) — a cleaner factoring than baking filters into each widget; mirrors how our hooks compose
  TanStack query filters, worth keeping deliberate.
- **Typed variables in a no-code tool** — even their citizen-developer surface is statically typed;
  "type safety" is their word. No-code ≠ untyped.
- **Function Live Preview as a dry-run harness** (run against real objects, edits not written) — same
  family as our Scenarios sandbox; theirs is per-function. Our eval suites + scenario overlay cover
  this; no gap.
- **Tag-and-release before use** (semver tag → checks → published version gates action creation) =
  our eval-gated agent release spine, at function granularity. Confirmation, not gap.
- **Immutable app versions with one-click revert + separable save/publish** — our git/Vercel flow
  owns this; note it as parity, not work.

**Fold-back:** playbook Workshop verdict (leapfrog with NL-native authoring) stands; this deep dive
adds the detail that Workshop's floor is typed and code-backed, which *strengthens* the leapfrog
case — NL can target the same typed substrate we already have. No doc-ingestion impact (P5/P6
untouched).
