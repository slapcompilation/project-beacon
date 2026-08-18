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

**THE READING IS DONE (2026-08-18)**, in
`readings/access-model-and-permission-vocabulary.md` §5 rather than a fourth
file, because it is the same role/workflow vocabulary. (`manage-roles-` turned
out to be `manage-roles` mirrored twice from a double-slash URL.) Its Decisions
have not been read by a human, so the gate still applies.

**What it found: the mechanism is already half-present and unreachable.** A
policy on `groups` — `view group membership reaches across organizations` —
tests `has_org_workflow(…, 'view_group_membership')`, and that workflow appears
in **zero** `organization_role_workflows` rows. Verified rather than reasoned:
an `organization_administrator`, the strongest role there is, holds five
workflows and not that one, because the administrator arm can only incorporate
workflows some role already carries.

540 was right on both counts — the page describes the **legacy** per-principal
dropdown, and no page says which role carries the workflow — but the
consequence is a workflow nobody can ever hold.

**The structural gap is that we have no workflow catalogue.** Foundry's
workflows exist independently of roles: administrators "define custom roles in
Control Panel by selecting individual *workflows*", and the Space permissions
screenshot has a `Filter roles and workflows…` box, which only makes sense over
a list. Here a workflow exists **only** as a row attaching it to a role, so one
nobody carries cannot be selected, granted or held.

Order: a workflow catalogue → `view_group_membership` in it → custom roles
built by selecting from it → then the guest picker.

**Steps 1–3 BUILT (563–564).** And the sweep found a **second** orphan in the
same state: `manage_space_permissions`, from 554 earlier the same day, whose
header claim that "only a subsuming administrator holds it" is false —
subsumption redistributes what some role carries and cannot conjure a token
that appears nowhere, so `space administrators grant roles` was dead too.

`workflows` now holds twelve rows with a `published` flag (false for exactly
one, ours); both role tables have a foreign key into it and a scope trigger, so
an unknown workflow is refused where any well-formed string used to pass. **No
grant changed** — the orphans are selectable, not held, which keeps 540's
refusal intact. `workflowCatalogue.test.ts` guards the class: every workflow a
policy tests must be catalogued.

**And the surface asked a question the schema never had: who holds any of this?**
Nobody — production held zero role grants of either kind, so no principal held
any workflow. That made **555's portfolios unusable**: creating one needs
`manage_portfolios_within_the_space`, and granting the role that confers it
needs `manage_space_permissions`, so neither door opened from inside. Measured
as the organization's own admin: both refused `42501`.

**566 fixes it with this repository's own precedent** — `enforce_grant_ceiling`
already bootstraps project roles ("someone has to grant the first Owner"), so
space role grants get the same arm and nothing wider: an owner or admin of an
organization the space actually serves. Only the *grant* path gets it; the
administrator then grants `space_administrator`, which subsumes the published
workflows, and portfolios work through the mechanism rather than around it.
Verified end to end on real data. `spaceBootstrap.test.ts` guards the chain.

**Step 4 BUILT — §4 IS COMPLETE.** The picker was a Kind dropdown beside a raw
UUID field, which was never Foundry's shape but a workaround for not being able
to search foreign principals. `administration/images/manage-guests.png` shows
what it is: one search box over both kinds ("Add a user or group…"), checkbox
rows with a principal-type icon and a "You" badge, and Cancel/Save — the same
control the Portfolio curators and Space permissions rails use, so it is the
platform's single way of naming a principal. What it finds stays bounded by what
the caller may see, which is the same sentence §4 opened with.

**Both allocated sweeps are settled.** `control-panel-and-banners` (12) is
**swept**: three were the reading's own framing in quotation marks, four were
screenshot transcriptions now attributed by path, two had their page attribution
*inside* the blockquote — which glues it onto the quote — and one prefixed a
heading onto the sentence below it. One string is deliberately **not** quoted
any more: it came from a marketplace install screenshot I could no longer
identify, and describing beats inventing a path.
`capabilities-value-types-and-groups` (8) turned out to be **already swept** —
it carries `verify: strict` and passes, so §4 owed it nothing. Checked rather
than assumed.

Only two readings now predate the guard: `deep-dive-ontology` (allocated
**never**) and `materializations-links-media-and-rids`, which waits for the
media and attachment property types.

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

**Four of the five allocated citation sweeps are done** (2026-08-18), each with
the phase that reopened its pages: `data-lineage` (the surface turned out to be
already built), `capabilities-typeclasses-and-branching` (the Capabilities tab),
`projects-roles-and-portfolios` (portfolios), and `control-panel-and-banners`
(§4). `capabilities-value-types-and-groups` was found already swept.

**One remains**: `materializations-links-media-and-rids`, with the media and
attachment property types. `deep-dive-ontology` is allocated **never**.
`readings/README.md` holds the table and what each sweep found.

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

### Re-run 2026-08-18 — 14 pages carry the callout, and nothing new reached us

The mirror has grown from 2,284 pages to 2,807 since the audit above, so the
scan was re-run. Fourteen pages now carry a **planned deprecation** callout, and
they resolve to the same six findings plus three that are new and none of ours:

| new callout | what we have |
|---|---|
| **Pipeline rollback** (`data-lineage/pipeline-rollback`), "unavailable for use after November 30th" | never built. The only `rollback` in our tree is the SQL transaction kind, in a migration and a test — checked, not assumed. |
| **Map's Series panel** (`map/series-panel`), "unavailable after January 31, 2026" | not our domain; we build no Map. |
| **Language-model deprecation and brown-out** (`model-catalog/model-deprecation`) | a model-catalog concern; we have no model catalogue. |

Eight of the fourteen are **Object Storage v1** restating itself across
`object-backend`, `object-databases`, `object-edits`, `ontologies/oss-limitations`
and inline in `action-types/getting-started` — all already the first two rows
above. `platform-overview/development-life-cycle` is not a deprecation at all;
it is the page that **defines** the phases the callouts link to.

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

**~~`authorized_group_ids` compiles fail-closed~~ — it did not, in one shape
(FIXED 568).** Foundry declines to define the attribute ("Contact your Palantir
administrator"), so 484/490 bound it to an empty array. That is closed for
`intersects` and `superset_of` and **open for `subset_of`**, since the empty set
is a subset of everything — `authorized_group_ids subset_of <column>` was true
for every row. It now compiles to `false`, because any placeholder leaves the
outcome to the operator. `policyFailClosed.test.ts` guards the class.

Worth keeping: `granular_comparison_check` already refused `NOT` for exactly
this hazard, quoting Foundry's warning and calling itself "stricter than the
warning, and deliberately so". The same failure walked in through an operator
the warning does not name.

### Action rules on interfaces — BUILT (569–570), and 569 was wrong

`action-types/rules` lists twelve rule kinds; we carried seven. **569** adds
`action_type_rules.interface_id` and registers the remaining five. None
executes: the three object kinds need the parameter Foundry generates for them
("an 'Object type' parameter will be automatically generated", "an 'interface
reference' parameter will be generated, constrained to the selected
interface"), and the two link kinds wait for the link instance store that
`create_link` and `delete_link` already wait for. Each says so in its own note
rather than sharing a vague one — registered, expressible, refused at execution
with a stated reason, which is how `create_or_modify_object` has been carried
since it was registered.

**570 corrects 569, and the way it was wrong is the point.** The governing
sentence is one clause:

> you can use interface action rules only to modify the *interface shared
> properties*  — `action-types/actions-on-interfaces`

569 enforced it by joining `action_type_rule_properties.property_id` against
`interface_properties.property_id`. Those columns are different types — a uuid
referencing `object_type_properties(id)` against the property's text api id —
so the guard raised `function string_agg(uuid, unknown) does not exist` the
moment any interface rule carried a property. **569's own assertions checked
the registry and never inserted a rule property**, so the path they were meant
to prove was never executed. That is exactly the failure
`a lesson written is not followed` records, made again while the lesson was two
migrations old. The rule holds without amendment: **an assertion has to execute
the path, and a guard nobody has watched fail is not a guard.**

The type error was pointing at a real design fault, not a missing cast. The
column can only reference an *object type's* property, and an interface rule
does not write those — a rule naming `Aircraft.status` is a rule about Aircraft
however it is labelled. So 570 gives the table a second reference,
`interface_property_id`, with `num_nonnulls(...) = 1`: a rule property names
either an object type's property or an interface's, never both.

**And a third guard nobody had looked at.** `guard_action_rule_property` read
the rule's `object_type_id` and refused the row outright when it was null —
"% does not write object properties" — which was right while every rule
carrying properties targeted an object type, and made all five interface kinds
unusable. It is also where the check belongs, because it fires on the property
INSERT rather than needing the rule row touched afterwards. The rule row still
re-checks, because repointing a rule at another interface strands the
properties the old one declared. `interfaceActionRules.test.ts` covers both
directions.

**571 is the consequence nobody would have looked for.** `action_editable_properties`
answers Phase C's design sentence — *"this is the only property that users can
edit"* — with an inner join through `property_id`. After 570 an interface rule's
property lives in the other column, so **every interface action reported zero
writable properties**. Not an error; a zero, from the function whose whole job is
that answer. 571 adds the interface arm: the interface property resolved through
`interface_implementation_mappings` to the concrete property each implementer
mapped it onto, one row per type — Foundry's own example being `Title` on Bug
and `Summary` on Feature request for one interface `Subject`.

It also gives `object_type_interfaces.interface_actions_enabled` **its first
reader**. 450 added that column citing this same page and nothing ever read it —
declared, defaulted, inert, which is the half-built shape seen from the other
side. A type that turned interface actions off is not edited by the action, so
its properties leave the answer.

**The reading came after the build, and is recorded that way.**
`readings/actions-on-interfaces.md` was written once 569 was already applied.
It found two things review had not: the governing quote both migrations carry
is **cut short** — it ends "or to delete objects" — and the Interface action
control gate this page describes was **already built in 450**, while
`readings/interfaces-phase.md` was simultaneously recording the page as
unmirrored and the question as open. The schema knew and the reading did not.

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

  **The scoped project — ANSWERED and BUILT (567).** `api/` carries `scopeMode`
  as a union: project scope names `projectRids`, a **list**, and is "the
  boundaries for the schedule build" rather than an attribution. `scope` had
  been read by *nothing* — no function, no policy — so it recorded an intention
  and enforced nothing. It now names its projects, the union is a CHECK both
  ways, and a trigger refuses a target outside the boundary. The *discovery*
  half is deliberately not built: Foundry's user-scoped schedule discovers
  outputs from what the owner can build, and ours never discovers anything.

  **Builds — still unpublished, now confirmed from the API too.** `get-build`
  gives only the OAuth scope `api:orchestration-read`; `create-build` names only
  `CreateBuildPermissionDenied` without saying what permission was missing.
  Checked from both sides now, not one.

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

### The drift sweep (2026-08-18/19) — the corpus moved under fourteen readings

`check:doc-drift` had been failing with **36 pages changed upstream across 14
readings**. Swept: every affected section re-mirrored, every stale citation
replaced with current wording, and the material findings written into the
readings that own them.

**The two guards are one mechanism, and this is the first time it ran end to
end.** Drift says *a page moved*; re-mirroring it makes `check:readings` fail on
*the exact sentence we were standing on*. Six citations surfaced that way. A
reading is not re-verified by re-reading it — it is re-verified by refreshing the
mirror underneath it and seeing what breaks.

**Nothing shipped was falsified, and the near-miss is the lesson.** `retries`
now says function effects "may receive immediate, short-term retries", which
reads like `automation_effects_retries_where_allowed` (restricting configured
retries to action and logic) is wrong. It is not — the sentence that constraint
was built on is still on the page verbatim, and the sweep added a *second*
mechanism, which `effects` now names separately as per-effect automatic retries
versus event retries. **When a drifted page seems to contradict a constraint,
re-read the page, not the diff.** A diff shows what moved and never what still
holds.

**Two real divergences, both since BUILT (572, 573) after the operator asked
for them to be verified against the pages and images first:**

* **We always allowed overlapping schedule runs.** `create-schedule` documents
  a default — a schedule does not start a new run while another is in progress —
  and `schedule_candidates()` filtered on `NOT s.paused` and nothing else, with
  the pg_cron heartbeat firing every minute. Not a regression (the sentence is
  new), but a *silent* divergence: nothing failed, runs piled up. **572** adds
  `allow_overlapping_runs`, default false.
* **A time condition takes one cron, and Foundry now takes several.** **573**
  makes it either one `cron` or a non-empty `crons` array, never both, sharing
  one `timezone`, firing when any matches.

**Verifying before building changed both of them.**

For the schedule, the images settled the default twice over —
`advanced-settings.png` shows all six Advanced-options checkboxes unchecked —
and reading the *code* found the trap: `record_schedule_run` clears
`trigger_state`, because a run consumes what it observed. A suppressed attempt
never ran, so routing the skip through it would have eaten the observed events
silently. That is a worse bug than the one being fixed, and nothing but reading
the helper would have shown it. Hence `record_schedule_skip`. No new outcome
token was needed either: `Ignored` is already defined as "The run was attempted,
but a build was not created".

For the cron list, verification caught a **scoping** error that was one step
from shipping. `condition-time` is *Automate's* condition;
`building-pipelines/triggers-reference` still says a time trigger is "defined
using a cron expression and a time zone" — singular. Two grammars that look
alike, one page moved, and a test now asserts a `crons` array is still refused
on `schedules.trigger`.

It also produced a better reason for the decision already taken. Non-overlap is
not enforced not merely because Foundry frames it as advice, but because **we
fire once per tick on any match** — an overlap is a non-event in this engine,
and a CHECK would refuse configurations that behave correctly. And the timezone
stays on the condition, because the only cron screenshot predates multiple
expressions and no image shows the multi-cron control at all; a zone per
expression would be invented structure.

**Three additive gaps recorded, deliberately not built:** download is a separate
permission from view, and *which resource* it is checked on depends on where the
object type lives; a manual automation run reads its input object set as the
person who started it, not the owner — the first documented exception to
executing as the owner; and Automate discards edits returned by function
effects, so the supported route is a function-backed action.

**The sweep repaired something nobody was looking for.** 108 mirrored files
carried `<img src="./media/…">` references, and **no `media/` directory exists
anywhere in the corpus** — every one of them pointed at nothing. `map` and
`data-connection` had zero images on disk at all. For a protocol whose second
step is "read every paragraph, and every image", that was a silent hole, and
re-mirroring closes it — 108 files down to **one**.

That last one is its own small finding. `superrepo` still carries a dangling
reference because the section has no URLs in `all-foundry-urls.txt`, so
`--refresh superrepo` printed a line and did nothing. **A refresh that skips a
section reports the same as a refresh that succeeds**, and the sitemap this
index derives from caps at 5,000 entries — which is how a mirrored section ends
up unreachable by the tool that maintains it.

**And a correction I made and had to unmake.** Mid-sweep I concluded the drift
checker had a false positive — that it compared our rewritten image paths
against upstream's originals, so any page with an image would drift forever. It
does not. `check-doc-drift`'s `normalise` strips HTML tags outright and reduces
`![alt](path)` to its alt text, so both halves of our rewrite vanish before the
comparison; verified by running the real function over both forms. What actually
had the weak normalisation was **the throwaway probe script I wrote to classify
the 36**, and I attributed its blind spot to the checker. All 36 were real prose
changes, as first reported. The lesson is small and exact: **when a tool and a
scratch script disagree, the scratch script is the suspect** — and running the
real function takes a minute.

**47% of the documentation is not mirrored**, concentrated in `api/` (1,131
pages) — the corpus that has falsified our CHECK constraints twice. Refresh the
index with `--urls` before concluding a page does not exist.
