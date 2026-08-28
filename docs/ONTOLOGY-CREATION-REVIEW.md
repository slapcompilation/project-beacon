# The ontology creation flow, reviewed end to end

Opened 2026-08-27, the operator's stage 2 after the Spark trio: "review all the
ontology step by step creation so we have the end to end in place." Method:
a live probe walking the whole flow as a real `authenticated` user in one
rolled-back transaction (`scripts/probes/ontology-creation-e2e.mjs`, run
against production; `f3-property-key-seam.mjs` pins F3's mechanism), plus a
twelve-step documentation diff by verifier agents whose load-bearing claims
were re-verified by hand. Findings are numbered; none is fixed in this
document — fixes are gated and ship as their own migrations.

## The probe's walk (2026-08-27)

Nineteen steps, each the RPC the surface calls, in the flow's order:
stage a type → backing → save → edit properties → second type → link →
action → enable edits → apply → index through a real build → read as
authenticated → revert → the linter's two lists. What passed, passed as
`authenticated` with real JWT claims, project role grants, and a real
dataset with rows. Steps that refused were EXPECTED to refuse where noted.

## F1 — the create wizard is deadlocked: a new type cannot be born through the UI

**Severity: the flow's front door.** The wizard
(`ObjectTypesPage.tsx` TypeBuilder → `useCreateObjectType` →
`saveObjectType` → `save_object_type` RPC) STAGES the type into the working
state — the row is not in `object_types` until `save_working_state` lands
it. Then `onSuccess` immediately applies the backing choice
(`useApplyBacking`) against that staged id, and both branches fail:

- `generate_backing_dataset` (590) resolves the type from
  `public.object_types` — `Ontology:ObjectTypeNotFound` (probed).
- the existing-dataset branch (`addObjectTypeDatasource`) INSERTs into
  `object_type_datasources`, which FKs to `object_types` — refused (probed;
  the error surfaces as `DatasourceInAnotherOrganization` because the
  trigger resolves the type's ontology to NULL).

So the toast reports "Object type created, but its backing datasource was
not", and the user's Save is then refused by the linter —
`OntologyMetadata:SaveBlockedByErrors — A backing datasource is required`
(probed) — with no way to attach one: both attachment paths need the landed
type, and the type cannot land without backing. The staged entry blocks
every subsequent save of ANYTHING until discarded (probed: a poisoned entry
in the working state refuses later unrelated saves too, because
`save_working_state` validates the whole state).

**The engine supports the correct sequence and the surface never sends it**:
`save_object_type` accepts an inline `datasources` array in its payload —
`indexBuild.test.ts` creates types that way and the probe confirmed it
lands cleanly. The wizard simply does not pass it, and the generate branch
has no staged-type story at all. 590's own assertions proved the function
against a type that already existed — the migration proved the function,
not the flow, which is the assertion-that-never-calls-the-thing failure
class again (543's lesson).

**How long it has been latent, dated:** production holds exactly one object
type, created 2026-08-11 — eight days BEFORE the wizard's backing wiring
merged (#698, 2026-08-19). No object type has ever been created through the
assembled flow; this probe was its first end-to-end caller.

## F2 — a link type is born unbacked, silently, and no linter arm notices

`save_link_type` + save lands a link with `backing_kind = NULL` and a
defaulted `cardinality = many_to_many` (probed). Foundry's create-link-type
wizard forces the backing and cardinality choices at creation — "Links are
backed by object type foreign keys or a join dataset" (create-link-type is
the page CLAUDE.md cites). And `ontology_violations()` has **no link arm at
all** — its body does not mention links (verified from `pg_proc`), so an
unbacked link raises nothing at save time and nothing later. The probe's
finished ontology reported zero violations while holding an unbackable
link.

## F3 — an action-created object breaks its type's index build: the property_id / api_name seam

**Severity: data-path correctness, live in production.** Pinned mechanism
(`q_f3.mjs`):

- `apply_action` builds the edit's properties keyed by **`property_id`**
  (rule properties resolve to `prop_key = property_id`), moves the
  primary-key value out of the bag into `object_edits.primary_key`, and for
  our probe's one-property type wrote `properties = {}`.
- `object_state` scaffolds the merged object keyed by **`api_name`**
  (`jsonb_object_agg(p.api_name, 'null')`) and reinjects the primary key
  under **`api_name`** — the probe's object came back as `{"id": "C"}`.
- `index_object_type` builds columns named by **`property_id`**, and its own
  comment states the contract: rows are "keyed by property_id via its
  backing_column, which is the shape object_state() replays edits onto."
  `object_state` does not honour that contract.

When `property_id == api_name` everything aligns — which is why every suite
passes: every fixture picks matching names. When they differ (the probe
used `property_id 'pk'`, `api_name 'id'`, which is the natural result of
mapping a dataset column `pk` to a prettier API name), the merged bag has
no `pk` key, the NOT NULL key column receives NULL, and **the type's entire
index build FAILS** — `run_index_build` → job FAILED, the index stays stale
for every consumer of the type until the offending action is reverted
(probed: revert + rebuild → SUCCEEDED).

Two hedges in the code already straddle the seam without resolving it —
`index_object_type` checks `e.properties ? property_id OR ? api_name` for
required-property errors, and `apply_action`'s required-check does the same
— evidence the mismatch was met twice before and papered over locally both
times. `scenario_object_state` (713) is a third replayer with its own rules
(recorded as `vertex-foundation.md` §16.2), so a fix must reconcile all
three against one declared key.

## Flow properties confirmed working (as authenticated, on production)

- `save_object_type` with inline datasources → `save_working_state` lands a
  type with its datasource; the edit flow (second `save_object_type` with
  the landed datasource id) adds a non-key property. The linter's refusal
  and the discard path both behave.
- Edits are disabled at birth and `apply_action` refuses with
  `Actions:EditsDisabled` until `edits_enabled` is set — matching the
  allow-editing page's opt-in. **Where the surface offers this toggle is an
  open question for the breadth pass** — the probe flipped the column
  directly.
- A direct INSERT into `object_edits` as `authenticated` refuses with
  `Actions:PermissionDenied — this object type only allows edits via
  actions` (605's guard, seen firing under the real role).
- `run_index_build` indexes through a real build job: job COMPLETED, build
  SUCCEEDED, `object_type_indexes` counts the dataset rows.
- Reads are mediated: direct `SELECT` on `objects.ot_*` as `authenticated`
  is refused (`permission denied for schema objects`) while
  `evaluate_object_set` serves the rows — consistent with the OSv2
  direction of making the raw index private.
- `revert_action` + rebuild restores the pre-action state.
- `ontology_violations()` / `ontology_warnings()` both readable; the probe
  ontology reported clean (modulo F2's missing link arm).

## The per-step diff (breadth pass, 2026-08-28)

Twelve steps, each reviewed against its pages whole by a verifier agent with
read-only access to the live catalog, the load-bearing claims re-verified by
me where they drive a finding. Verdict vocabulary: **match** (built the way
the page has it, and reached), **partial**, **missing**, **divergent**.

### What matches, said first

The engine layer is largely faithful, and several arcs are whole:
statuses (vocabulary, deprecation trio, cascades with Foundry's own printed
conflict names, surface included); the twelve action rules by name with
their guards; submission criteria clause-for-clause; action permissions and
reverts sentence-for-sentence; the save session (errors block, warnings do
not, the delta rule as 426's scoped divergence); proposals and merge
(eligibility, advisory reviewers, blockers, atomic merge); branch engine
including the composed-overlay validation; the 22 base types anchored by
the parsing test; structs; edit-only properties; interface extension and
action-type constraints; Explorer presence-on-creation with the documented
filter/aggregation grammar. The three-times-mistake relic
(`rebuild_relationship_edges_view`) is confirmed gone from the catalogs.

### F4 — the branch save surface is wrong-scoped: branch edits are invisible and unsavable

`useWorkingState` (apps/web/src/features/workingState/api.ts:52) hardcodes
`.is('branch_id', null)` while `useSaveWorkingState` passes the ambient
branch. Consequence, verified from the live `stage_change` body: edits
staged ON a branch never appear in the header count or the Review edits
dialog; a user whose only entries are branch entries sees NO Save control
at all (SaveControl returns null at zero entries), so the branch arm of
`save_working_state` is unreachable from the UI in that state — and with
main entries also pending, the dialog lists main's entries while Save would
save the branch's. The branch ENGINE (461/466/471, composed-overlay
validation, protection, save-to-new-branch) all matches its pages.

### F5 — an ontology is not born with its space, and OMA locks out its documented audience

"When a new space is created, a corresponding ontology with the same name
is simultaneously created" (`ontologies/ontologies-overview.md`); ours
inverts it — `create_space()` writes only spaces + space_organizations
(verified live; the only trigger on spaces is `set_space_path`), the
ontology is a separate insert from the OMA picker, and 424 designs the
ontology-less space in as a normal state. Second, unscoped divergence the
other direction: `OmaLayout` refuses every role but owner/admin, while
`ontology-roles-migration.md` says ontology resource information "is
accessible for all users of that ontology" — stricter than Foundry, and no
reading or migration scopes it.

### F6 — the engines-nothing-reaches census, run against this flow

The repo's named dominant defect, counted across the creation path. Each
of these is a complete, tested engine whose documented surface does not
exist:

1. **`require_resources_in_project`** — owner-gated toggle, and
   `ontology_role_grants` has 0 rows with no seeder and no surface, so the
   gate can never pass: the toggle is unflippable by anyone in production.
2. **History and restore (672)** — `ontology_saves` written by both landing
   paths, `restore_object_type` stages a restore; zero web readers, and
   OmaLayout's own comment says so.
3. **Value-type binding** — `value_type_id` on all four binders, enforced
   at index time with the authored message; use-value-type's "dropdown menu
   during property configuration" does not exist; 0 value types live.
4. **Render hints** — three columns + the dependency CHECK + real engine
   consumers, but the page's property-pane toggles have no UI at all.
5. **The action form engine (666/667)** — sections, defaults, overrides,
   one SECDEF resolver, consumed at apply time; no authoring surface, all
   four stores at zero rows.
6. **Type groups** — schema + Explorer reader; no writer anywhere.
7. **Aliases, point of contact, contributors** — 415's columns render in
   MetadataCard, writable nowhere.
8. **Interface metadata** — icon, searchable, status, description: schema
   exact to the page, zero UI.
9. **`histogram_object_set`** — exists; nothing in the flow reaches it
   (Explorer's charts use their own path; Vertex's documented histogram
   filter would be its consumer).
10. **Property visibility** — column + `Ontology:PropertyIsHidden` refusal
    live; no control.
11. **FK/join/object-backed link backing** (see F7) — the whole backing
    engine is migration-reachable only.
12. **`packages/ontology` objectSets module** — the inverse case: a second,
    dead implementation of object sets (hotelId remnant from the deleted
    product) that nothing imports, beside the live SQL engine.

### F7 — link creation collapses Foundry's five-step helper to one row, and silent defaults fill the gap

Foundry's helper: relationship type first (FK / join table / object-backed,
with cardinality), then keys with auto-detect, then per-side names with
validity rules, then save location, then Submit-then-Save. Ours collects a
label and a target type. Everything else lands as silent defaults:
`cardinality` takes the leftover column DEFAULT `many_to_many` (because
`apply_one_change` inserts only staged keys) — contradicting 437's own
decision that an unconfigured link is "unconfigured, not silently backed" —
`backing_kind` stays NULL with no linter arm watching (F2), side
display/API names land NULL ("No sentence set"), and the page's API-name
rules are unenforced: our slug permits underscores against "only
alphanumeric characters" (the code comment claiming no page settles the
spelling is falsified by create-link-type.md §Define link type names), and
side-name uniqueness-per-object-type has no constraint. "Generate join
table" does not exist; edit-link-types' PK-type-vs-column-type save
refusal has no arm (names only are compared). One of the three documented
entry points exists.

### F8 — consumption's first break: there is no Object View, of either kind

A new type IS automatically present in Object Explorer with live counts
(match, built Foundry's way), the exploration engine is documented-grammar
faithful, and explorations/lists save. But "Foundry automatically creates a
standard Object View" (`object-views/standard-object-views.md`) has no
counterpart — no schema object, no route, no component — and configured
(Workshop-backed) default views likewise. Results-table title cells are not
clickable, so the documented terminus "select a specific object to see its
Object View" dead-ends: **after indexing, a user can see the set but never
one object.** The 23-page object-views section is mirrored and has no
reading. Linked-object consumption (pivot, link filters, Linked objects
component) has its engine half only.

### F9 — the apply path's two surfaces disagree, and the per-object half is absent

Explorer's ActionsMenu consumes `action_form_effective` (sections,
defaults, override-driven visibility); ActionTypesPage's own ApplyDialog
bypasses it entirely — raw exposed parameters and a bare primary-key input
— so the two apply surfaces disagree about what the form is. Use-actions'
other documented doors — the Object View Actions section, Object Actions
dropdown, inline edits per property, the Edit History widget — all lack
the per-object view they live in (F8). Workshop's Button group renders and
triggers nothing (its own comment defers the arc). No VALIDATE_ONLY mode
or structured validation response exists (api parity gap). No surface
edits an existing action type's rules or parameters — the builder only
creates. Every action table holds zero production rows.

### F10 — interfaces: implementation bypasses the save session, and a required link constraint binds nothing

`implement_interface` writes DIRECTLY — Foundry's step 5 is Save; ours
toasts "Implementation declared" with the working state never involved,
the one ontology edit in the flow that skips the session. Interface link
constraints can be authored (the modal's exact field list) but the
satisfaction half is unbuilt: nothing references `interface_link_constraints`
at implementation time — `assert_implementation_conforms` checks only
properties (which falsifies `readings/api-interface-type.md`'s claim that
link constraints are enforced there; the reading needs a correction) — so
a REQUIRED link constraint is inert. Also: `searchable` defaults false
against the page's "By default... will be searchable" (450 line 60, no
stated reason); shared-property deletion is RESTRICT where the page says
deletion reverts uses to regular properties — stricter, unscoped; the
shared-property EDITOR (its documented six-tab surface) is missing
entirely, with `useUpdateSharedProperty` a dead export.

### F11 — metadata gaps with teeth

**Mandatory control properties are a token only**: `marking` is in
`property_base_types()` and the picker offers it with the page's framing,
and NONE of the page's validations exists — not required-enforcement, not
the restricted-view marking-column mapping, not default-Hidden, not
per-datasource allowed-markings. A property saved as `marking` is an
ordinary column that LOOKS like a control. Second: `guard_resource_lifecycle`
protects object types, action types and interfaces, but
`object_type_properties` has no such trigger — an ACTIVE property can be
deleted or API-renamed freely against edit-properties.md's protections.
Third: the array element dropdown offers `media_reference` while the 546
CHECK refuses it — the UI can stage what the save rejects.

### F12 — the type-class two-store state, unchanged

Reported by the metadata verifier and §16.3 of `vertex-foundation.md`
alike: both stores still at zero rows, both frozen, the fold-or-keep
decision still open for the operator. Nothing in this review moves it;
nothing else may write to either store until it is taken.

### Step 2, the object type wizard — F1's home, and the shape is not the page's

Foundry's helper is a guided modal stepper — Datasource → Metadata →
Properties → Generate actions → Save location — entered from "Create your
first object type" or the New menu. Ours is one flat inline card ordered
Metadata → Datasource → Properties → Create, no stepper, no New menu, no
first-run entry. Beyond F1 (confirmed structurally: `save_object_type`
stages, `useApplyBacking` targets the staged id, the inline-`datasources`
engine path is never sent — "no user can complete Step 2 through apps/web
today"), the step diff:

- **Existing-datasource auto-population is missing whole**: the page's
  branch "will automatically populate the object type's metadata. It will
  also map every column... to a property" — ours never fetches the schema;
  backing columns are free-text inputs and inference runs label→column,
  the reverse direction.
- **Generate actions (step 4) has no trace** — no standard action set is
  generated at creation anywhere.
- Metadata: icon colour has no writer anywhere (`icon_color` exists,
  default stamped); the Groups field is absent (type_groups: F6.6).
- The wizard OFFERS advanced types (media, time series, vector, struct,
  cipher, marking) the page excludes from bootstrapping; zero-property
  Create is accepted client-side and only refused at save.
- Save location is ambient (the OMA project picker), never the documented
  explicit in-wizard choice — same pattern as links (F7).
- `object_type_problems()` carries the page's mandatory list EXCEPT
  "Plural display name is required" — no arm, and production's one type is
  saved with an empty plural. The type API name, auto-derived, has no
  post-create edit path (the page: editable on the Overview page).
- Match column: both backing cards verbatim from the capture, staging
  semantics ("Create will only stage"), the errors-block split, three-tier
  PK advice, camelCase/PascalCase derivation with the nine reserved
  keywords, and `Phonograph2:DatasetAndBranchAlreadyRegistered` raised by
  name.

### Step 4, datasources — the strongest step, with one false "match" corrected

The datasource layer is the flow's best-built stretch: the one-type-one-
datasource rule with Foundry's own error name, the 70-cap counting only
synced datasources (media excluded, the 69+1 boundary tested), the
primary-key-column override with the exists-in-every-datasource linter arm,
restricted-view and media-set-view arms exactly the api's shape, and the
MAP-only column exclusion as 440's scoped, reasoned divergence from a page
that contradicts itself about structs. Partials: no Replace control
(removal is FK-RESTRICT with no narration, no same-schema auto-remap); no
Object Storage V2 data-store panel; 3 of the api's 10 datasource kinds
(the rest recorded deferred).

**One agent verdict corrected by me:** the step's reviewer called the
generate-a-dataset wizard branch a "match", citing
`generatedBackingDataset.test.ts`'s born-unsaveable → saveable arc. That
test's fixture creates the type by DIRECT INSERT into `object_types`
(line 34), bypassing the staging path — so it proves the function on a
landed type and never meets F1's deadlock, which lives in the SEQUENCE the
real wizard runs (stage, then generate against the staged id). A fixture
that bypasses the entry path proves the engine, not the flow — the same
way 590's own migration assertions did.

### Step 9, indexing — faithful engine, and the flow's last two gaps

The build-engine shape is right and mostly reached: the index is a real
build (513), both documented triggers are live on the pg_cron minute hand
(datasource-moved via `job_spec_fresh`; the six-hour edits arm verbatim),
schema change rebuilds beside and swaps (`__next`, 644), value-type and
duplicate-pk violations fail the job as the page says, edit-log objects
join the merge, the Phonograph scalar is fully gone (535 — the job IS the
state), and the OMA Reindex button is the documented user-triggered full
reindex. The full-reindex-always collapse (no incremental/80%/changelog/
hydration) is the declared Spark divergence.

**F13 — a new type never enters the indexing loop by itself.** Nothing in
the save path provisions a job spec (probed: no trigger, no save-path
function mentions indexing), and `run_stale_indexes` INNER JOINs
`object_type_indexes` and `job_specs` (verified live) — so a freshly
saved type whose datasource later fills stays unindexed until a person
presses Reindex once. Worse, the first-build-failure orphan: a FAILED
first build leaves a spec and a FAILED job but no index row (the insert
rolls back with the failed subtransaction), so the heartbeat's retry arm
can never see that type again. **This composes with F3**: an action-created
object with mismatched property keys fails the build — on a type whose
first build that was, the type drops out of the retry ladder entirely.

**F14 — the edits-to-index contract is inverted, client-side, and
unlabelled.** Foundry applies user edits to the index immediately and
persists on the six-hour run; ours persists immediately and updates the
queryable table only on reindex — approximated by the WEB firing a full
force-reindex per touched type after each apply/revert
(actionTypes/api.ts). A client that dies mid-flow leaves the index stale
for up to six hours and no surface distinguishes ready-but-stale from
ready.

Smaller: `index_object_type` is not yet private (the job-ticket gate holds,
but EXECUTE is still granted to authenticated and the client exports it —
the OSv2 memory's open step); no Live-pipeline graph / Data-Schema chips /
builds-filtered-by-type surfaces; the monitoring engine has no
object-type rule family. And one adjacent surface bug found in passing:
**apps/web/src/features/builds/api.ts:23 still types `builds.status` as
`COMPLETED | ABORTED`** while the database has stored SUCCEEDED/CANCELED
since 506 — BuildsPage's intent map misses every finished build, on
exactly the surface a failed index build would be debugged with.

## What the twelve steps themselves missed — the completeness critique

A final agent asked what the decomposition skipped entirely, checking every
candidate against the mirror and the repo's own records. Thirteen stages,
and the pattern matters more than the list: **the misses fall on the tail
ends of each arc** — property-level display and derivation config, and the
finishing stages of both actions and types. Four of them have in-repo
engines this review's own F6 census failed to count:

- **Value formatting and conditional formatting**
  (`value-formatting.md`, `conditional-formatting.md`) — an engine exists
  (673, `readings/property-formatting.md`) and no step or census entry
  named it.
- **Derived properties** (`derived-properties.md`) — CLAUDE.md lists this
  FIRST in its engines-nothing-reaches list, a reading and 591 exist, and
  the census omitted it.
- **Ontology cleanup and usage metrics** (`cleanup.md`, `view-usage.md`) —
  readings exist; the retiring end of a type's life is unreviewed.
- **Action side effects** (notifications/webhooks, five pages) — recorded
  out deliberately (509/418, DELIVERABLE-MAP), the one entry with a
  record.

The other nine: property reducers; struct automapping and main fields;
time series / geotemporal / sensor property config (recorded "still
shapeless", 42 pages unread — pending, not a non-goal); the
function-backed action's AUTHORING leg (write, import, publish an
@OntologyEditFunction — our Functions-phase isolate is exactly this leg's
engine and the review never connected them); the action test run
(`test-run.md`); the action log as an ontology object type
(`action-log.md`); Ontology JSON export-edit-import (`export-import.md` —
the documented bulk-authoring path, undeferred anywhere); Gaia object
creation (Gotham-gated, de facto out, unrecorded); Marketplace packaging
and Gotham type mapping (unrecorded for ontology types). Each of these is
a review debt, not necessarily a build debt — but every unrecorded one
must end up either reviewed or recorded as a non-goal, or it will be
rediscovered the expensive way.

## The verdict

**The engine layer is Foundry's shape to a degree the surface layer is
not.** Read down the steps: schemas, guards, linters, the save session,
branching, proposals, criteria, reverts, datasource rules and the build
engine each trace to their pages, usually sentence-for-sentence, and the
divergences that exist there are mostly scoped and declared (426's delta
rule, 440's struct readmission, the full-reindex collapse). The flow
breaks where a user touches it, and it breaks in three repeating patterns:

1. **The wizard collapse.** Foundry's guided multi-step helpers (object
   type, link type, shared property, interface) are each collapsed to a
   one-row inline form, and every decision the form does not collect lands
   as a silent default — F1 is the extreme case (the uncollected decision
   deadlocks the flow), F7 the clearest (a default contradicting the
   schema's own recorded intent), F10's `required=true` and
   `searchable=false` the quiet ones.
2. **Engines without surfaces** — the twelve-entry census in F6, counted
   against a single user journey rather than found one at a time. Two
   composition seams belong to the same family: F3 (three functions, two
   property vocabularies) and F13 (a type that was never indexed is
   invisible to the machinery that would index it).
3. **Zero-rows reality.** Almost every table this flow writes holds zero
   production rows; the flow had never been walked end to end until this
   review's probe. That is how F1, F3 and F13 stayed invisible under a
   fully green CI: every suite's fixture enters through a side door
   (direct INSERTs, matching property names, pre-provisioned specs) that
   the real front door never uses.

**The findings, ranked by what they block:** F1 (no type can be born
through the UI) and F13+F3 (a born type may never index, and an
action-created object can push it out of the retry ladder) gate everything
else — together they are why the flow has never run. F4 (branch edits
invisible), F8 (no per-object view), F7/F10/F11 (silent defaults and inert
controls), F9 (two apply forms disagree), F14 (stale index unlabelled),
F5 (ontology not born with its space; OMA locked to admins) and the F6
census follow. Fixes are deliberately not in this document: each is its
own gated chunk, and the operator picks the order.
