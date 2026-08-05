# What is left to build

The only planning document. It says what is NOT built; the moment something
ships, its entry is deleted rather than annotated. A file that accumulates
"✅ SHIPPED" lines becomes a history, and history is what git is for.

**The teardown is done.** Everything not in Palantir's documentation, and
everything of ours that was not built the way Palantir builds it, is gone: the
hospitality domain, the agent and tool registries, Workshop, scenarios,
automations, evals, documents, the action layer, the second tenancy tier, and
three separate universal tables. What remains is in CLAUDE.md.

---

## The build order

From `docs/foundry-deep-dives/01-ontology.md` — "Creating Your First Ontology",
cross-verified against its 18 source PDFs. Its section order **is** a
dependency order, designed by the people who built the product, which is why we
follow it rather than the reference index.

Two things it does not give us, and neither is a reason to deviate:

- Its worked example is an airline. We take the **sequence and the mechanics**,
  never the nouns — otherwise we have swapped hospitality for aviation.
- It begins by installing a prebuilt ontology from Marketplace. We have no
  install workflow, so we start where the ontology is authored.

### 1. Object type over a datasource — §5

The gap that blocks everything: **`object_types` can describe an object and
nothing can hold one.** Foundry maps an object type to a backing datasource,
and where there is not one you "select a location to generate a dataset"
(`create-object-type.md`) — a real table with real columns.

Needs, in the course's own order: backing datasource, property mappings, a
**primary key**, and a title key. `object_types.source_table` and `title_key`
exist; **primary key does not exist here at all** and Foundry treats it as
fundamental, so expect it to touch everything after.

### 2. Link type — §6

Cardinality is already the four documented values. What is missing is the
backing: object type foreign keys for one-to-one and many-to-one, a join
dataset for many-to-many (`create-link-type.md`).

### 3. Action type — §7

"A set of changes or edits to objects, property values, and links." Nothing
here now — `user_action_types` went with the rest, and what replaces it should
come from the page rather than from what we had.

### 4. Object Explorer — §3

The surface that proves 1–3 are real. Deleted with the record store it read;
rebuild it against the datasource model.

### 5. Data Lineage — §4

Where an object's data came from.

### 6. Security — deep dive 06

The fourth ontology layer, and the one with a live gap: the RLS contract suite
is gone, `auth_org_id()` broke unnoticed for a day because of it, and every
policy calls it. Whatever Foundry's data-contract shape turns out to be, this
is where it lands.

---

## Known gaps, not queued

**RLS is unverified.** No test exercises a policy. This is the direct cost of
deleting the contract suite and is stated here so it is not rediscovered.

**`shape_registry` is gone and nothing replaced it.** The guards that used it
(`check:shape`, `check:vocabulary`) went too. Foundry indexes ontology
resources so "what uses this" is a query; we have no index. Until there is one,
an unused object type is invisible.

**`ObjectMap` is parked.** `features/objects/ObjectMap.tsx` + `basemap.ts` are
marked `@surface-orphan-ok`: a maplibre map that plots any object with a
geopoint property, kept deliberately ahead of its caller. It wants the Object
Explorer or a dashboard.

**Property base types.** Six exist (`text`, `number`, `boolean`, `date`,
`media_reference`, `vector`). Foundry has more — Geoshape, Attachment, Time
series, Geotemporal series, Cipher text, Struct — and each waits for something
that stores one.
