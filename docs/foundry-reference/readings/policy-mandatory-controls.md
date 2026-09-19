---
verify: strict
---

# Reading — the markings and organizations slots of a security policy

The remaining unbuilt part of object and property security policies. 821 and 826
built the `Granular policy` slot of the Compose dialog; this reading is for the
other two, `Markings` and `Organizations`, which behave differently from the
granular arm in a way that decides where they may be evaluated.

**Why this needed its own reading.** The semantics are published, and **not on
the object-permissioning pages**. Those state the model in two sentences and
leave the mechanics to pages about other products entirely. I found them by
sweeping for the control's own words rather than by reading around the feature.

Pages read in full:
- `mirror/object-permissioning/object-security-policies.md` (the §Configure
  mandatory controls section, and step 4 of the walkthrough)
- `mirror/object-permissioning/managing-object-security.md` (the read-time
  callout, which is NOT the same callout as the one on the page above)
- `mirror/media-sets-advanced-formats/configure-granular-policies-media.md`
- `mirror/time-series/time-series-permissions.md`
- `mirror/object-link-types/mandatory-control-properties.md` (re-read for the
  two combinators)

Images: **one of the four opened, and I name the three I did not.** I opened
`object-permissioning/images/osp-stop-inheriting-markings.png`, which is the
slot itself and the only one whose anatomy this reading rests on. Unopened, and
recorded as debt rather than described:
`object-permissioning/images/osp-add-marking-property-security-policy.png`,
`media-sets-advanced-formats/images/configure-granular-policies-media-inherited-markings.png`,
`time-series/images/time-series-advanced-setup-oma-manage-markings.png`. The
last two are the same control in other products and would corroborate rather
than establish; the first is the property-policy version of the one I opened.

---

## The model in two sentences

> "By default, an object security policy will inherit all mandatory controls from its data sources. These include [markings](/docs/foundry/security/markings/), [organizations](/docs/foundry/security/orgs-and-spaces/#organizations), and [classifications](/docs/foundry/security/classification-based-access-controls/)."

> "The object security policy can then be further customized to add new mandatory controls and remove inherited mandatory controls that are no longer necessary."

— `object-permissioning/object-security-policies.md`

So the stored state is a **delta over an inherited baseline**, with two
mutations: add, and remove-an-inherited. It is not an absolute list.

## What the capture adds that the prose does not

`osp-stop-inheriting-markings.png` is the `Access requirements` step of the
Compose dialog, reached by a breadcrumb reading `Overview > Access requirements`
under the subtitle `Configure changes to access requirements` — *changes*, which
is the delta model showing up in the dialog's own wording.

The section header is `Markings`, followed by a separator dot and the word
`All of`. **The combinator is printed in the UI**, and it is the conjunction.
That matters because the two kinds do not share one: `mandatory-control-properties.md`
says markings are all-of and organizations are at-least-one, so a slot labelled
`All of` for markings implies a differently-labelled one for organizations, which
I have not seen and am not inventing.

Each row is a dark shield chip (`demo: PII`, `demo: VIP`), a red `Removed` tag,
and a right-aligned `Start inheriting` button; the section carries a right-aligned
`Add ▾`. So the three states of one inherited marking are *inherited*, *Removed*,
and back again via `Start inheriting` — and `Add` is the second mutation, for a
control the datasources never supplied.

— object-permissioning/images/osp-stop-inheriting-markings.png

## A stop is scoped to the consuming path, not to the source

This is the part the object-permissioning pages do not state and the other two
products do, each in its own words. The media page:

> "Note that stopping inheritance *only* affects this object and *does not* remove the marking from the backing media set itself."

— `media-sets-advanced-formats/configure-granular-policies-media.md`

and the time series page, which says the same thing from the other side:

> "This configuration only bypasses the time series sync’s markings requirement when loading a time series through an object’s time series property. You will still be required to satisfy these markings for direct access to the time series sync."

— `time-series/time-series-permissions.md`

The time series page also states the baseline in a form that gives the
conjunction a published sentence:

> "Time series syncs inherit all markings of their input dataset. To view the time series sync, you must satisfy all of the view requirements of these markings."

— `time-series/time-series-permissions.md`

**Consequence for the schema:** a stop is keyed by *(consumer, source, marking)*,
not by *(consumer, marking)*. We have both shapes already and they disagree —
`restricted_view_marking_stops(restricted_view_id, marking_id, stopped_by,
stopped_at)` collapses the source because a restricted view has exactly one
input, while `dataset_input_marking_stops(dataset_id, input_dataset_id,
marking_id, stopped_at)` keeps it. **The second is the right precedent here**,
because an object type may have several datasources and a marking may be
inherited from one of them.

## The two arms of a policy propagate differently

> "Granular row and column controls within an object or property security policy filter what a user can read. These controls do not extend to downstream outputs or exports. However, mandatory and classification-based controls within the same policy continue to apply to derived data."

— `object-permissioning/managing-object-security.md`

This is a *different* callout from the read-time one on `object-security-policies.md`,
and it is the one that decides where the marking arm may be evaluated. The
granular arm is read-time only — which is why 821 compiles it into the `WHERE`
per caller. The mandatory arm follows derived data, so it is not obliged to be
per-row at all, and it composes with the type-level check 819/825 already built.

## Connects to

- **819/825** — `effective_object_type_markings` and `satisfies_markings` already
  express "all of these markings" for an object type. The policy's marking slot
  is the same conjunction over a different set.
- **727 / `object_type_datasources.allowed_markings`** — the datasource side of
  the baseline already exists and is read by the write and index paths.
- **The Capabilities tab**, which we already ship: `time-series-permissions.md`
  puts this very control there for time series syncs, so there is Foundry
  precedent for the surface as well as the storage.

## Corrected 2026-09-19, after an adversarial pass

The five Decisions below were written from the object-permissioning pages plus one
capture. A verification pass opened the captures I had named as debt, swept for the
control's own words, and attacked each Decision. **Two of five were overturned, a
third was wrong in its wording, and a live defect in our own schema surfaced.** The
Decisions are rewritten below; this section records what changed so the corrections
are not silently absorbed.

**Captures opened since.** I opened
`object-permissioning/images/osp-add-marking-property-security-policy.png` and
`action-types/images/read-write-authorizations-write-security.png` myself. The
verification agents opened
`media-sets-advanced-formats/images/configure-granular-policies-media-inherited-markings.png`
and `time-series/images/time-series-advanced-setup-oma-manage-markings.png`.

**The time-series capture is not the control, and my header said it was.** It is the
Ontology Manager Capabilities tab showing a `Security markings` card with a
`Configure` button — the launcher. The filename promised a management screen; the
pixels are a button. That is my mischaracterisation, written from the filename.

**Pages this reading did not have, and should have.**
`building-pipelines/remove-inherited-markings.md`, titled "Remove inherited Markings
and Organizations", is where the removable set is enumerated;
`action-types/read-write-authorizations.md` carries the only per-category combinator
table; `pipeline-builder/outputs-remove-markings-and-organizations.md` shows the
organization removal control.

### The organizations combinator is printed after all

My first open question said I had not seen it. It is printed, in a different
section entirely:

> ORGANIZATIONS (One of)

> OTHER MARKINGS (All of)

— action-types/images/read-write-authorizations-write-security.png

Both in one frame, in the same typographic form, directly above and below each
other. `CLASSIFICATION MARKINGS` on the same screen carries no parenthetical.

### A live defect in our schema, found by attacking a Decision

490 minted the system `Organizations` marking category as `conjunctive`, with no
comment and no sentence behind it — the unmarked option rather than a decision.
Against:

> "Access requirements for a resource are composed of Markings and Organizations. Organizations are disjunctive, while Markings are conjunctive."

— `api/filesystem-v2-resources-resources-get-access-requirements.md`

So `satisfies_markings` required membership in **all** organization markings while
`satisfies_mandatory_control` (821) required **one** — two evaluators in this repo
disagreeing. Measured latent rather than live (`resource_markings` held 0 rows), and
fixed in **828** before building anything that would make it reachable.

## Decisions

1. **Storage is a delta over a computed baseline**, never an absolute list — two
   mutations, add and remove-an-inherited, stated in one paragraph of
   `object-permissioning/object-security-policies.md`. *Corrected:* the baseline has
   **two** sources and only one is stoppable. Datasources are stoppable;
   the containing project is not — "Outputs inherit organizations from the project
   they are in. Move your output to a separate project if you need to remove an
   organization that is on the existing project."
   (`pipeline-builder/outputs-remove-markings-and-organizations.md`).
2. **A stop is scoped to the consuming path AND to the source within it.**
   Confirmed three ways: `stopPropagatingMarkingIds` is nested inside each
   `backingDatasets[]` entry, with "If multiple backing datasets have the same
   marking applied, the marking must be listed for each backing dataset or it will
   still be inherited" (`api/datasets-v2-resources-views-add-backing-datasets.md`);
   "Each of these keyphrases must be specified on **every** input that requires
   removal of Markings or Organizations"
   (`building-pipelines/remove-inherited-markings.md`); and migration 401's own
   header, which chose the edge key for this reason.
   *Split, because the key as first written was wrong:* there are **two** policy
   tables, so there are two stop tables — a polymorphic `(policy_kind, policy_id)`
   over two real tables is the generic-table mistake, and 826 already refused its
   mirror image. And the **organization arm takes no marking column** until a page
   shows a per-organization control; the only published organization removal is
   per input.
3. **Markings combine BY CATEGORY, not as a flat conjunction.** *This replaces the
   original wording, which described neither Foundry nor our own code.* Every
   marking of a conjunctive category is required; at least one of each disjunctive
   category. `satisfies_markings` has implemented exactly that since 674, and the
   api publishes the discriminator as `categoryType · one of CONJUNCTIVE,
   DISJUNCTIVE`. Organizations are a **disjunctive category** — which is what 828
   fixed — so they need no special case in the evaluator.
4. **The marking slot of an OBJECT policy may be set-valued; the marking slot of a
   PROPERTY policy may not.** *This replaces the original Decision 4, which was
   overturned.* Routing a property policy's markings into the shared type-level
   check would withhold **every row** of the object type from a caller who should
   instead see the row with some cells nulled — inverting the worked example on the
   primary page, where step 4 stops PII and VIP so instances are visible and step 7
   re-requires PII for three properties. A property policy's marking slot belongs
   where 827 put its granular arm, in the projection. The original justification — *mandatory controls follow derived
   data, therefore evaluate at the type level* — is a non-sequitur: Foundry's published handling of a per-row mandatory control
   that must propagate is to over-approximate at materialization time, not to lift
   the control.
5. **There is one kind — a marking — split by category.** *This replaces "three
   kinds".* The api publishes `markingType · one of MANDATORY, CBAC` on a marking
   category, and "Markings associated with Organizations are placed in a category
   with ID \"Organization\"". So organizations and classifications are both
   categories of markings, not peer slots. We still build no CBAC; what that means
   is a **column we do not populate**, not a slot we do not build.

## Built, 2026-09-19 — 829, the Markings slot of an OBJECT policy

Two further corrections were forced during the build, both by evidence rather than taste.

**The denial shape decides the seam, and my first draft had it wrong.** I had the
policy's markings composing into `object_type_instances_readable` — the guard 825
pointed four readers at. That guard answers whether the object type exists for you,
and three of its four callers RAISE. The page says otherwise, twice:

> "If a user does not pass the object security policy, the object instance will not be viewable to that user."

> "In the **Markings** configuration, stop inheriting the `PII` and `VIP` markings so that users without those markings can see object instances."

— `object-permissioning/object-security-policies.md`

So it went beside the granular arm, in `object_read_predicate`, where failing it
yields **no rows**. The two marking sets now have two honest denial shapes: the
object type's own markings (819, Compass) hide the TYPE; the policy's mandatory
controls make the INSTANCES unviewable.

**Organization markings are refused by the Markings slot, reversing what I wrote.**
828 made organizations a disjunctive category so the EVALUATOR needs no special
case, and I took that to mean the authoring surface needed none either. The api
refuses exactly that conflation, by name:

> "Adding an organization marking as a regular marking is not supported. Use the organization endpoints on a project resource instead."

— `api/filesystem-v2-resources-resources-add-markings.md`

An inherited organization marking still reaches the baseline and is still enforced;
it simply cannot be stopped or added through this slot — which matches the fact
that the only published organization removal is per pipeline input.

**Three smaller things the build found.** `object_type_datasources`' CHECK
enumerates FOUR backing kinds and my first `datasource_markings` covered two,
returning a silent empty set for time-series and media-set datasources; the
time-series arm is published ("Time series syncs inherit all markings of their
input dataset") and is now implemented, while the media-set arm is empty *because
we hold no media set markings*, which the code says in those words. A stop could
name another object type's datasource and be silently ignored, so both parents
gained composite unique keys and the child carries composite FKs, per 826's
precedent. And a stop can reach a marking a dataset inherited from its project,
while the object type's own project marking cannot be stopped — an asymmetry that
matches the published pipeline behaviour and is now written down.

## Questions I could not answer from these pages

- ~~Whether the object policy's marking slot composes with the object type's own
  markings or replaces them.~~ **ANSWERED and built.** The access conditions are a
  three-item list — Viewer on the object type, passing a granular policy, passing
  the marking/organization/classification checks — so item three is added to item
  two. The decoupling sentence gives up Viewer on the DATA SOURCES only.
- **Whether a property policy inherits from its own properties' datasources or
  from the object type's.** On an MDO these differ. Measured: one hit in the whole
  mirror for the inheritance sentence, and its subject is the *object* security
  policy; the identity claim transfers the mechanism without transferring the
  scope of the baseline. Its authoring screen shows no datasource at all — only a
  name and property chips — and the worked example is single-datasource, so both
  readings predict the same capture. **Genuinely unpublished**, and it blocks the
  property half (830) until it is decided deliberately rather than by copying
  829's join.
- **What `Add` offers.** Still unopened, still not guessed.
