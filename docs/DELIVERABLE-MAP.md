# What is left to build

The only planning document. It says what is NOT built; the moment something
ships, its entry is deleted rather than annotated. A file that accumulates
"✅ SHIPPED" lines becomes a history, and history is what git is for.

**The queue is now derived, not judged.** It used to be ordered "by the size of
the structural absence", which meant by my estimate of it. It is now ordered by
Foundry's own architecture: `object-backend/overview` names six services and
draws how they connect, and `readings/ontology-backend-architecture.md` maps
each one onto ours. An entry earns its place by being a connection the diagram
draws and we do not.

Every service has a counterpart — Ontology Metadata, object databases, Object
Set Service, Actions, the Object Data Funnel, Functions on Objects. What is
missing is not a service. It is wiring.

---

## The build order

### 1. The index is a build

**The connection the diagram draws and we do not.** `mark_index_stale_on_commit`
fires when a datasource transaction commits, so the platform knows an object
type's index is behind — and nothing reindexes. `index_object_type` is reachable
from tests, from its own migrations' assertions, and from a button. No timer, no
trigger, no build.

Foundry's Funnel "is comprised of a series of Foundry build jobs" that "run
whenever their respective datasources are updated" and, when user edits exist,
"every 6 hours". We built that engine in 493–508 — job specs, builds, the seven
job states, build locking, contention queuing, a trigger grammar whose
`tableUpdated` is exactly "a new transaction is committed to the table", and a
minute-hand heartbeat. **The two halves were built separately and never joined.**

This is the ontology half of the sentence the pipeline layer was built to
finish: derivation was declared and nothing computed it. Reindexing is the same
absence, one layer up.

Reading written, Decisions recited, not yet built.

### 2. Materializations

The merged state — datasource plus user edits — written back out as a dataset,
"the latest state of each object", schema taken from the Ontology rather than
the datasource. We compute exactly that state in `object_state()` and never
expose it. Cheap once §1 lands, because the build that indexes already produces
it. Propagation is automatic or the same six-hour cadence.

### 3. Automate

The condition-and-effect layer above Actions, whose effects are "Submit Foundry
actions" and "Execute Foundry functions" — both of which now exist and are
verified live. Conditions are time-based, object-data-based, or both. Mirrored
(42 pages) and unread.

### 4. Cross-organization principal visibility — PREMISE CORRECTED, NEEDS A READING

The guest picker adds foreign principals by ID because registries are
org-siloed. This entry used to say "Foundry's Control Panel searches the
enrollment", and **that was our inference, not a citation**. The one sentence
found on looking says something different and narrower:

> "You will only be able to view groups for which you have `View group
> membership` permission on the group's Organization."
> — `platform-security-management/manage-groups`

So the mechanism is a **grantable per-organization permission** that widens who
you can see, not a global search. That is a permission type we do not have, and
it belongs beside the granular policies in the security phase rather than being
bolted onto the guest picker.

**No longer "small".** It needs its own reading — `manage-groups`,
`manage-roles-`, and the Organization permissions surface — before anything is
built. Do not build from this entry as written.

**Two readings ride along with it.** `readings/control-panel-and-banners.md` (12
untraceable quotations) is about exactly this surface, and
`readings/capabilities-value-types-and-groups.md` (8) covers the groups half.
Re-reading a page is what fixes a citation, so both get swept here rather than
in a separate pass — see `readings/README.md` for the allocation and what the
sweep looks for.

---

### 5. Drop `object_type_indexes.status` — two of four steps done

523 and 524 did steps 1 and 2: `object_type_index_ready()` is the predicate,
and all ten functions that gated on `x.status = 'success'` now ask it —
including the eight on the hot read path.

**523 hid every object, and 524 fixed it forward.** The pure OSv2 predicate
asked only whether the last index BUILD JOB completed, and every index that
existed had been built before 513 made reindexing a build job. None had one, so
the answer was false for all of them and exploration, counts, aggregations,
histograms, quicksearch and restricted views all went dark. The platform suite
caught it on the next run, which is exactly why this was worth its own change.
`object_type_index_ready()` now prefers the job and falls back to the legacy
scalar **only** where no job exists.

Remaining, and **the order is fixed by a mistake, not by preference**:

3. **Make `index_object_type` unreachable except through a build job — DONE
   (528, reverted by 529/530, reapplied unchanged as 532).** The indexer takes
   the build job it runs under and refuses without a RUNNING one for that type,
   so the hole closes by signature rather than by census. Revoking EXECUTE
   cannot do it — `run_build_job` is SECURITY INVOKER and would lose the
   privilege along with everyone else. All three platform fixtures and the
   Reindex button now go through `run_index_build`.

   **The blocker was a real bug, and not the one I named.** 528 was reverted on
   the theory that its guard broke the `restrictedViews` fixture. It did not.
   Forcing that fixture down the build path for the first time exposed a defect
   that had been there since 513: a restricted-view backing leaves
   `object_type_datasources.dataset_id` NULL — **by CHECK**, not by accident —
   and `job_spec_input_state` aggregated on it, which is what
   `jsonb_object_agg` reports as "field name must not be null". Every
   restricted-view-backed object type was unbuildable, and no test saw it
   because all three fixtures called the indexer directly, which is the very
   hole step 3 closes. `job_blocked_by` took the same NULL and *silently*
   matched nothing, so such a reindex never waited for the build rewriting its
   data. 531 resolves both through `object_type_input_datasets()`, per
   `object-edits/materializations`: "Backing dataset: The backing dataset of
   the restricted view."

   Two lessons, both already paid for once. **A component that only fails when
   something else forces it down a new path is not the component at fault** —
   my note sent the next reader to the property/datasource loop, which was the
   one part of the indexer that already resolved the view correctly. And **a
   fixture that exercises an engine by calling its internals is not testing the
   engine**; the three that did hid this for nineteen migrations.
4. **The fallback arm comes out of `object_type_index_ready()` — DONE (533).**
   Third attempt, and the first whose argument is about the system: an index
   row exists only if `index_object_type` ran, which since 532 requires a
   RUNNING job, so the ELSE arm cannot be taken. The three ways that chain
   could break were checked rather than assumed — RLS refuses a direct INSERT
   (verified **as `authenticated`**), the only `DELETE` on `builds` fires at
   `n = 0`, and "no index reading success may fail `ready()`" is an assertion.
   The single-writer claim it rests on is now a standing platform test.
5. **`status` is deleted — DONE (534, 535).** The scalar carried two facts and
   the second one was the work. "This index succeeded" was already the job's;
   "this index is stale" was three triggers writing `'not started'`.

   The page names the replacement: "When the schema of an object type changes
   and the previous pipeline's schema is no longer up-to-date, a new
   **replacement pipeline** must be provisioned"
   (`object-indexing/funnel-batch-pipelines`). **`object_types.version` is
   already that schema version** — it bumps on a type edit and on any property
   change, which is why `mark_index_stale_properties` was dead code rather than
   merely unattached. So `job_spec_fresh`, which already compared
   `bj.spec_version` to the spec's version, now compares against the type's,
   and all three trigger functions are **deleted with nothing replacing them**:
   a datasource swap and a data commit were always covered by
   `job_spec_input_state`.

   I first built this as a trigger copying the type's version onto the spec. It
   tripped `guard_job_spec` — publishing a spec takes the editor role, and
   provisioning a pipeline is not a person publishing anything. **The refusal
   was right and the design was wrong**: a second copy of a version that
   already exists is state to keep in step. The guard was left alone.

   The indexer also stops swallowing its own failure — it raises, and the job
   records it, "in the pipeline graph" as the FAQ puts it. Surfaces read
   `object_type_index_report()`, which reports the seven job states, so the
   Object types page can now say *indexing* where it used to say *not indexed*.

**Why the order is this way.** 525 backfilled a build for every existing index
and asserted none was left without one — true. 526 removed the arm on that
basis and the read path went dark again, because the assertion described the
*rows that existed*, not the *system*: a fixture indexing a new type has no
build, and eight exploration cases failed immediately. 527 put the arm back.

That is the same error as 523 one level up — proving a property of the current
data and treating it as a property of the system. The suite caught both within
one run, which is the only reason neither reached CI.

### 6. Automate: the retry ladder and the published limits

Two divergences found by reading `retries` and `limits` AFTER shipping 517.

**The fallback fires too early.** Ours runs on any failure; the page says
fallbacks "will only execute if an object failed non-retryably, or the maximum
number of retries has been reached". That needs the retry ladder underneath it:
per-effect retries (action and Logic only), and event retries with an interval
under 24 hours and a count between 1 and 5.

**The object-set cap is ours and it is wrong.** `object_set_keys` truncates at
10,000. Published: 100,000 for `Objects added`/`Objects removed`, 1,000,000 for
`Run on all objects`, and exceeding it is an ERROR at save or evaluation — not
a silent truncation, which is what we do and is the worse behaviour.

Also unbuilt and published: 45-minute queue wait and 4-hour run ceilings.

**THE RETRY SCHEDULER IS BUILT — 543/544, and §6 is closed.** It was blocked for
a stated reason: "re-attempting needs a queue with its own clock, and inventing
one to satisfy a sentence would be the mistake this file exists to correct."
493–496 supplied that clock, so `run_automation_retries` became a fourth hand on
`run_schedules` rather than a mechanism. The budget is `1 + retry_count` because
the published count "does not include the initial attempt"; the interval is the
effect's own; and when the budget is spent the run fails and the fallback is
**released** — the arm of the disjunction 521 could not reach.

**543 shipped two omissions, and both were mistakes already paid for once.** It
added a CHECK tying `awaiting_retry` to a due time and a comment claiming
`run_automations` "now also says when" — the patch was described and never
applied, so the next retryable failure would have violated the CHECK and taken
the whole pass down. Its assertions passed because they asked about the SHAPE
rather than the behaviour, which is 514's grep-only assertion exactly. And its
own header quotes "517 shipped a runner with no caller" before shipping one.
544 corrects both, with assertions that execute the path.

---

## The build order is complete

Sections 1–6 are all built. What remains is in **Known gaps** below and in the
readings' allocation table, and neither is a queue with an order — each item
waits on a phase that has a reason to start.

**The five allocated citation sweeps** ride with the phase that reopens their
pages (`readings/README.md` holds the table): `control-panel-and-banners` with
the next §4 surface slice, `projects-roles-and-portfolios` with portfolios,
`materializations-links-media-and-rids` with the media and attachment property
types, `capabilities-typeclasses-and-branching` with typeclasses and render
hints, and `data-lineage` with the lineage surface.

## The deprecation audit (2026-08-15)

Every page carrying a **planned deprecation** callout was checked against what
we build. The result: **one** deprecated design had reached the schema.

| deprecated in Foundry | what we have |
|---|---|
| Object Storage v1 (Phonograph), "unavailable after June 30, 2026" | `object_type_indexes.status` was its scalar. 520 replaces it; §5 above drops it. |
| Writeback datasets (OSv1's edit persistence) | never built — we built object datasets, the OSv2 replacement |
| "Ignore inherited permissions" | never built; C1 recorded the deprecation as the reason folders organize and never gate |
| "Propagate view requirements", superseded by Projects and Markings | never built; we have both replacements |
| Metric changed [Sunset] (Automate condition) | excluded by name in the Automate reading |
| Gaia Milsym Creatable interface | not our domain |

**Re-run this when the mirror grows.** `grep -rl "planned deprecation"
docs/foundry-reference/mirror/` is the whole scan, and it is cheap. A page can
acquire the callout between one reading and the next, which is how a build
copies a design Foundry has already left.

## Known gaps, not queued

**Replacement pipelines.** A schema change should build a second index in the
background and swap it, "without impacting the live data being served to users".
Ours rebuilds in place, so the type is unavailable while it runs. Worth doing
when it hurts.

**Control Panel's Approvals integration.** "a dedicated Approvals integration
designed to facilitate the process of requesting, approving, and maintaining a
history of sensitive workflows within Control Panel"
(`administration/control-panel-approvals`), covering network ingress, egress and
SDK web hosting. We have `ontology_proposals` for ontology changes and nothing
for administrative ones.

**`authorized_group_ids` compiles fail-closed** until scoped sessions bind it
(`readings/security-phase.md`, open question 2).

**The five `…of interface` action-rule variants** are unblocked (B5 built in
450) but unbuilt (`ONTOLOGY-BUILD-MAP.md` Phase C).

### Portfolios — BUILT (554–556), after its prerequisite

`readings/portfolios-and-space-roles.md` was recited, approved, and built:
**554** space roles, **555** portfolios, **556** the catalog hygiene the first
two owed. What follows is why the order was forced, kept because the finding
outlives the build.

**The finding that matters: portfolios cannot be built first.** Every portfolio
operation is gated on a space role, and *we have no space roles at all* — space
access today is organization membership and nothing else. I first concluded the
space-role vocabulary was undocumented; **that was wrong**, and checking rather
than trusting it is the only reason the reading is right.
`platform-security-management/manage-orgs-and-spaces` publishes it, and
`space-permissions.png` publishes the contents of the default roles.

Two corrections that would have become structure:

- **There is no "Editor" role on a space.** The defaults are Contributor,
  Project Templates Administrator and Space Administrator. `security/portfolios`
  says "the Editor role on a Space" as prose shorthand for whoever holds the
  portfolio workflows — by default Contributor. The two-vocabularies trap.
- **The permission is a workflow, not a role**, and both are named in the
  screenshot: `Curate portfolios within the space` and `Manage portfolios within
  the space`. A space role **bundles workflows** — the identical mechanism §4
  built for organizations in 540–542, one scope up, so the precedent to copy
  already exists.

Order therefore: **space roles, then portfolios** — which is what shipped.
`projects-roles-and-portfolios.md` (13 citations) is still allocated and
unswept; it covers project roles and access requirements, not the portfolio
half this build needed.

**Two things this build turned up that are not portfolio questions:**

- **Project contents — FIXED (561), and one gap that was not one.**
  `project_resources` read org-wide while its write policy already required
  `editor`, so after 558 a caller with no role could not see a project and
  could still enumerate its contents. Closed on inheritance ("role grants
  inherit to child resources").

  **Role delegation was already built** — `Projects:GrantExceedsRole` refuses a
  discoverer both `owner` and `editor`. It was listed as a gap and was not one;
  **the tenth time an audit has found the thing already built.** Now asserted.

  The sweep behind 561 listed all 36 permissive read policies gated on
  organization alone; the rest are org registries or specified as
  organization-visible (portfolios, collections).

- **Schedules — FIXED (562). Builds — still open, and now for a stated reason.**
  The pipeline question split in two once the pages were read.
  `building-pipelines/schedule-troubleshooting` publishes the schedule rule
  exactly: view needs `Viewer` on the target dataset, edit/delete/pause needs
  `Editor` on the target dataset **and** on the scoped project — and, since
  "If you lost permissions for one dataset, remove this dataset from the
  schedule before you save", editing needs **every** target. 562 implements
  both through `dataset_role()`; read is `ANY` target and that is marked
  inference, since our `target_dataset_ids` is an array where Foundry's rule is
  singular.

  **Builds get nothing**, because no page read says who may view one. The
  Builds application is described as showing "all builds occurring across
  Foundry", which is a product description rather than a permission, and
  `building-pipelines/security-overview` is a page of links about Markings.
  `builds`, `build_jobs` and `schedule_runs` stay organization-scoped until a
  page says otherwise.

  Also unmodelled and recorded: `schedules.scope` carries Foundry's `user` and
  `project` values but no column names **which** project a project-scoped
  schedule belongs to.

  **The folder-and-file role-grants toggle is NOT to be built**, and the
  reading says why. It disables "folder and file role grants" — and there is no
  folder or file level here: `project_role_grants` names a project and nothing
  finer, no per-resource grant table exists, and no link-sharing table exists
  either (the toggle governs that too). A folder's access is already entirely
  its project's. So the switch has one honourable position and we are in it,
  which is the position Foundry recommends: "We recommend keeping role grants
  on folders and files disabled."

  What would make it real, in order: per-resource role grants, then link
  sharing, then the toggle over both, then the space-level default, then the
  documented cascade that deletes existing resource grants when it is turned
  off. That cascade is why it is not merely a boolean and cannot precede the
  thing it deletes.

- **Project reads are organization-scoped, not grant-scoped — FIXED (557–560).**
  `readings/access-model-and-permission-vocabulary.md` has the full account.
  The conjunct landed on `projects` and `datasets` (`folders` already had it),
  and finding it exposed two more defects: `project_role` **restated** the
  organization test more narrowly than the predicate beside it, so a guest
  could not hold a grant made to them; and it was SECURITY INVOKER while being
  consulted *by* a policy over the very table it reads, so it answered `viewer`
  to the owner and NULL to the caller. Both fixed, with `accessModel.test.ts`
  as the standing guard.

  The open question — which `default_role` preserves behaviour — **dissolved**:
  every production pair was checked and zero lose visibility, so no backfill
  was needed. And 557 removed the fixtures 554/555 had committed to production,
  with the lesson that a migration wrapped in one transaction commits whatever
  its assertions insert. The published formula is a conjunction
  (`security/checking-permissions`): access requires "Satisfying the
  Organization and Marking requirements" **and** "Having one or more roles
  (directly, via a group, or a default role)". Mandatory controls only ever
  subtract — "Organizations and Markings, will *always* prevent an ineligible
  user from accessing a resource, regardless of the user's role" — and roles
  only ever add.

  **Both halves exist here and were never joined.** `resource_file_access` is
  the mandatory half; `project_role()` is the discretionary half and is already
  complete (direct grant, group grant, `default_role`, strongest wins). The
  projects read policy calls only the first. So the fix is one conjunct — and
  it is **not safe to ship blind**, because all six production projects carry
  `default_role IS NULL` and the conjunct would hide every one of them. The
  data decision comes first and is the operator's.
- **Question 3 stays open after eight pages.** Nothing splits
  `Curate portfolios within the space` from `Manage portfolios within the
  space`; the GA announcement uses "Editors" and "Administrators" for the same
  activity in consecutive paragraphs. Our split is marked as inference inside
  555, and only two predicates change if a page later contradicts it.

  **The search did establish a prior, and it points away from our split.**
  Foundry's sibling curation surfaces bundle create with manage:
  `app-building/curating-apps` says permissions to create collections and tags
  "are the same as the permissions to promote", and `compass/data-catalog`
  gives one permission both add/remove and "manage who has this permission".
  So a single bundle is likelier than our boundary. Recorded as analogy — the
  answer will come from an expanded Space permissions card, not from prose.

  Two decisions were corroborated on the way: **curation is not access** now
  has a third independent source ("Anyone can view collections and their
  descriptions, but you will only have access to curated files that are shared
  with you"), and **delegation is a management act** — which 555's
  `managers appoint curators` already assumed — is stated outright for
  collections.

**Open question 1 is answered (§7), and the question was the wrong shape.**
`manage-roles` — a page no reading had opened — shows that "roles on a space"
and "role sets" are two mechanisms that share a settings page:

- **Roles *on* a space** (Contributor, Space Administrator…) grant **workflows**,
  belong to the space, and are what gates portfolios. Per-space, as proposed.
- **Role sets** group the roles usable *inside* a space, on projects, folders
  and files. They grant **operations**, are owned by an **Organization**
  (defaults by the enrollment), come in three contexts — Project, Ontology,
  Marketplace Installation, and **no Space context** — and a space points at one
  per context: "Projects in this space must use this role set."

So portfolios are unblocked by the first and unaffected by the second.

**And it names what we already have.** `project_role_grants`' owner / editor /
viewer / discoverer **is the "Project defaults" role set, hardcoded**, and
`ontology_role_grants` is "Ontology defaults". That is a supported place to
stand — default role sets "are always available to all Organizations" — so what
is missing is customisation (custom role sets, editing a default role inside
one, role inclusion, and the replace-with-mapping that rewrites every grant in
the space). **Recorded, not queued**: nothing is blocked on it.

A third granularity also arrives with it: **operations** (`stemma:mutate-default-branch`)
are what roles in a role set are built from, below the workflow level Control
Panel uses for organization and space roles.

**Open question 2 is answered too, by `api/` — and the answer is that the docs
are the wrong source.** The Role object
(`api/v2/admin-v2-resources/organizations-list-available-roles-organization`)
carries `roleSetId` as **required**, an `isDefault` flag whose description is
harder than the prose ("Default roles are provided by Palantir and cannot be
edited or modified by administrators"), a `type` naming the resource the role is
valid for — **`ORGANIZATION` is one of its values, so organization roles live in
this same model** — and an `operations` list. The role contents that every
screenshot collapses are a **`listAvailableRoles` response**, served rather than
published. §4's "not published" conclusion was right for the right reason.

**Workflow versus operation — settled enough to act on, in the same reading.**
They are one concept at two scopes, on strong evidence and no outright
sentence: the definitions match, both are what you pick when building a custom
role, and decisively the API's Role object carries `type: ORGANIZATION` with a
list called `operations` while Control Panel shows those same organization
roles granting *workflows*. One object, one scope, two words.

**So the tables are right and stay.** `organization_role_workflows` and
`space_role_workflows` store slugs of display names, which is the audience we
build for — Control Panel, where a person picks a workflow by name. **No
identifier can be populated today**: the corpus publishes exactly one,
`stemma:mutate-default-branch`, and it belongs to no workflow we store. A row
gains an `operation` column when a page publishes its identifier, one card at a
time the way 542 grew the catalogue.

**Type classes and render hints — resolved 2026-08-18, and the entry was three
different things.**

*Capabilities* was an engine with no caller: 415 built the table, the
`capability_slots()` registry, the guard and the policies, and production held
zero rows with nothing reading or writing them. The **Capabilities tab** is now
built, shaped as the screenshot has it, with the picker reading its `accepts`
list from the same registry the guard enforces. `capabilities.test.ts` fires
all three refusals, which had never run.

*Render hints* were already real and already consumed — `searchable`,
`sortable`, `selectable`, `analyzer` on `object_type_properties`, with the
published dependency rule enforced as `hints_need_searchable` and readers in
`object_set_where`, `evaluate_object_set`, `aggregate_object_set` and
`search_index_payload`. **Seven of the ten published hints are unbuilt**:
Disable formatting, Identifier, Keywords, Long text (pure Object View display
hints, no index cost) and Low cardinality, Enable leading wildcards, Enable
regex queries (search behaviour, each requiring Searchable). Each waits for a
surface that would read it.

*Type classes as a general mechanism* stay deliberately unbuilt. "The
configuration of all supported type classes will move to the Capabilities
page", so a generic kind/name bag would be building the thing Foundry is
retiring — and `metadata-render-hints` frames the whole feature in **Object
Storage v1 (Phonograph)** terms, the backend whose scalar we already had to
undo. Take hints one at a time, from a consumer that needs one.

**The lineage surface was already built, and this file said otherwise for
twelve days.** The entry read "`lineage_graph()` exists and nothing renders it".
All three slices the reading planned are live: L1 the engine (`lineage_graph`,
four edge sources, the staleness fact), L2 the surface
(`features/lineage/LineagePage.tsx` — the SVG layered DAG, chevron depth,
details drawer, routed at `/lineage` and `/lineage/:kind/:id`, listed in
`apps.ts`), and L3 the simulation (`simulate_marking_changes`, the four
documented states, the mode banner). `lineage.test.ts` is its standing guard.

Verified live rather than by reading the tree: the graph, the simulation and
`dataset_markings` were each called **as `authenticated`** against production
after 550–552 revoked the anon grants on exactly those functions. The reading's
13 citations are swept, and it now carries `verify: strict`.

**This is the eighth time an audit found the thing already built.** The pattern
holds: the entry described the gap at the moment it was written and nothing
deleted it when the gap closed. Deleting a shipped entry is the rule this file
opens with; it is also the rule that keeps getting missed.

**Recorded from the functions reading**: batched execution, `VALIDATE_ONLY`
mode, the `returnEdits` options, interface and struct edits, retries with
backoff, `fallbackBranches`, `connecting` build targets, Cancel build.

**A function version on a branch — ANSWERED, and the answer is "not for what we
build".** I recorded this as a question for the operator after 536. Two mirrored
pages settle it, and I should have read them before asking:

> "You can develop, publish, and consume functions on a global branch. This is
> currently supported for **TypeScript v1 functions and AIP Logic functions**."
> — `functions/branching-functions`

> "**TypeScript v2 and Python functions:** Currently, you cannot modify
> TypeScript v2 or Python functions on a branch. You may reference a specific
> version of a function on a branch and test that version before merging it
> back to the `main` branch. However, the function code will only be able to
> leverage the schemas that exist on the `main` branch."
> — `global-branching/integrations`

**We built the v2 contract** (`readings/functions.md`), so `function_versions`
must NOT gain a branch — that would be building something Foundry does not have
for our flavour. And the read-side sentence is already satisfied: nothing in the
function execution path consults the branch overlay, so a function's ontology
reads see `main`, which is what the page requires. Verified, not assumed.

The screenshots also correct an assumption worth recording: a branched version
is a **normal version number carrying a `Branched pre-release` label**
(`4.0.1 Branched pre-release` next to a plain `4.0.0`, and "Releasing: 6.0.0
(unstable)"), **not** a semver prerelease tag. If branching ever reaches our
functions, the marker is a flag beside the version, not `-rc1` inside it.

**Nesting a version resolver inside a query over its own table loses
uncommitted rows.** Observed reproducibly in 536: `WHERE id =
function_resolve_version(...)` over `function_versions` misses rows written
earlier in the same transaction, while the identical predicate inline finds
them, and the function receives the right arguments throughout. Minimal
reproductions in both `sql` and `plpgsql` did **not** reproduce it, so the
mechanism is not yet pinned. Committed rows are unaffected. Both call sites now
resolve into a variable first, which sidesteps it — but the cause is unexplained
and could bite another pair of functions.

**`ObjectMap` is parked.** `features/objects/ObjectMap.tsx` + `basemap.ts` are
`@surface-orphan-ok`: a maplibre map that plots any object with a geopoint
property, kept deliberately ahead of its caller.

**Property base types beyond the 22.** Geoshape, Attachment, Time series and the
rest each wait for something that stores one. The media and attachment half
carries `readings/materializations-links-media-and-rids.md` (9 untraceable
quotations) with it.

**Function signature types beyond the nine.** `functions/types-reference`
publishes, with a TypeScript v2 tab for each: Short, Decimal, Binary, Byte,
mandatory and classification markings, Map, Set, Optional, Struct/custom types,
Range and the two aggregation shapes, Object, Interface, Interface object set,
Attachment, Notification, Media, User, Group, Principal, and the geometry types.
We accept nine tokens plus arrays and `ObjectSet<T>` (539). **Each of these
needs the isolate to marshal it, and a token the runtime cannot carry is worse
than a missing one** — the signature would pass and the call would fail. So the
list grows one type at a time, when something needs to pass one.

**47% of the documentation is not mirrored**, concentrated in `api/` (1,131
pages) — the corpus that has falsified our CHECK constraints twice. Refresh the
index with `--urls` before concluding a page does not exist.
