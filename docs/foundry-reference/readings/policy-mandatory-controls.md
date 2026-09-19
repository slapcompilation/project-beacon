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

## Decisions

1. **Storage is a delta, never an absolute list.** Two tables or one table with
   two modes, recording *added* and *stopped* against the inherited baseline.
   The baseline is computed, not stored.
2. **A stop is keyed by (policy, datasource, marking)** — the
   `dataset_input_marking_stops` shape, not the `restricted_view_marking_stops`
   shape, because an object type may have several datasources.
3. **The marking arm is a conjunction and the organization arm is not.**
   `All of` is printed in the capture for markings;
   `mandatory-control-properties.md` gives organizations at-least-one. Two arms,
   two combinators, and `satisfies_mandatory_control` (821) already implements
   exactly this pair for a mandatory control property value.
4. **It composes with the type-level check, not the row predicate.** The
   mandatory arm follows derived data, so it belongs beside
   `object_type_instances_readable` rather than inside
   `object_security_predicate`.
5. **Classifications are recorded and not built.** The enumeration names three
   kinds; we have no CBAC and no page read for it here. Building two of three
   and naming the third is honest; inventing a classification model is not.

## Questions I could not answer from these pages

- **What the organizations slot looks like.** Every sentence I have treats
  markings and organizations together, and the one capture I opened shows only
  `Markings`. I have not seen its combinator printed, and point 3 above infers it
  from a different page.
- **Whether a property security policy inherits from its properties' datasources
  or from the object type's.** On an MDO these differ, and the page says property
  policies are "identical" in configuration without saying identical to what
  baseline.
- **What `Add ▾` offers.** A marking picker is the obvious reading and that is
  exactly why it is written here as a question rather than a decision.
