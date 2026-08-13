---
verify: strict
---

# Functions — typed, versioned server logic on the Ontology

Pages read in full: `functions/overview.md`, `functions-on-objects.md`,
`query-functions.md`, `functions-versioning.md`, `permissions.md`,
`edits-overview.md`, `use-functions.md`, `enforced-limits.md`,
`manage-functions.md`. Deferred by name (the language-implementation mass —
77 pages, 14k lines): the TypeScript v1/v2 and Python getting-started,
API-reference and unit-test families, webhooks and external functions,
language models and semantic search, streaming, Marketplace, telemetry, and
the type reference's 1,604 lines of language bindings.

## 1. What a function is

From `functions/overview.md`:

> "**Functions** enable code authors to write logic that can be executed
> quickly in operational contexts, such as dashboards and applications
> designed to empower decision-making processes. This logic is executed on
> the server side in an isolated environment."

> "Notably, functions include first-class support for authoring logic based
> on the Ontology. This includes support for reading the properties of
> various object types, traversing links, and flexibly making Ontology
> edits."

The languages are TypeScript and Python. There is no third kind of thing —
`functions-on-objects.md` is explicit that FOO is a manner of speaking:

> "The term "functions on objects" (sometimes referred to as "FOO") is used
> loosely to refer to functions that read object data, either as a parameter
> or using an object search, but there is no formal notion of a "function on
> objects" in Foundry as being distinct from any other function."

## 2. Queries: the read-only subset

From `query-functions.md`:

> "Queries are the read-only subsets of functions that may be optionally
> exposed through the [API gateway](/docs/foundry/api/general/overview/introduction/).
> They cannot have any side effects, such as modifying the Ontology or
> altering external systems. You should use an
> [Action](/docs/foundry/api/ontology-resources/actions/apply-action/) if you
> need those additional editing capabilities through the API gateway."

The API name rules are exact: `lowerCamelCase`, under 100 characters, no
leading numbers, unique across imported ontologies. And a query's version
discipline differs from everything else:

> "API-named queries will always use the **latest tagged version** of the
> published query and do not follow the same semantic versioning paradigm as
> other Foundry functions."

The consuming syntax in TypeScript v2 is, verbatim,
`client(getReschedulableAircraftCount).executeFunction({ timeUntilNextFlight: 10 })`
— which is exactly the shape `pnpm gen:client` already generates here. We
have been speaking the consumption half of this page since the generated
client landed.

## 3. Ontology edits, and when they are NOT applied

From `edits-overview.md`:

> "An **Ontology edit** is the act of creating, modifying, or deleting an
> object."

The load-bearing rule, and the one most likely to be got wrong:

> "The only way to update objects using a function is by configuring an
> action to use the function as described in the documentation for
> [function-backed actions](/docs/foundry/action-types/function-actions-overview/)."

An edit function *returns* edits; it does not apply them. And the caveat
that shapes any implementation:

> "Changes to objects and links are propagated to the object set APIs
> *after* your function has finished executing."

— while a direct fetch of an object you already edited does see them:
"the functions infrastructure applies your pending edits when the object is
materialized".

## 4. Versioning

`functions-versioning.md` is semver, stated plainly —

> "Versions for function releases are chosen by their publishers and are
> immutable after creation."

— with a published list of breaking changes that a check enforces before
publish: dropping a function, dropping an input (even optional), reordering
an input, adding a required input, bad input type changes, bad output type
changes. The honest caveat is printed too:

> "Palantir's built-in checks are not exhaustive of all types of breaking
> changes."

## 5. Permissions, and whose eyes read the data

Two clauses from `permissions.md`. Executing:

> "In order to execute a function, a user must have **Viewer** role on the
> repository from which the function was published."

Reading, which is the important one:

> "When a function loads object data, either as a parameter or via an
> [Object search](/docs/foundry/functions/api-object-sets/), the permissions
> of the end user running the function determine which objects are loaded."

That is our B1 engine's rule already: the invoker's own rights, RLS on every
read. Function-backed actions are the documented exception — an
administrator needs read access when *configuring*, after which "users will
be able to apply the Action based on Action-level permissions, regardless of
their access to the function."

## 6. Limits and management

`enforced-limits.md`: 60 seconds elapsed by default (280 in live preview),
memory by runtime, and object-set ceilings (100,000 objects, 3 search
arounds). `manage-functions.md`: functions are found and managed in Ontology
Manager's **Functions** tab, searchable by
"the function name, description, API name and RID".
The overview page shows
"basic information about the function, including its inputs and outputs and any associated usage history for the function."

## Decisions I had to make (mine, not Palantir's, unless quoted)

1. **The logic is SQL, as it is for transforms** — 493's precedent, one step
   further. A function is a named, typed, versioned SQL expression over the
   ontology's indexed objects; TypeScript and Python execution are the JVM/
   sidecar stack CLAUDE.md rules out. Marked as ours, loudly: Foundry's
   functions are a code-repository product, and this is the shape that
   survives our substrate.
2. **Queries first, edits second.** F1 builds the read-only subset the page
   defines — parameters, one SELECT-expression body, a scalar/object-set
   return — because "they cannot have any side effects" is a rule a
   validator can hold. Edit functions (F2) return an edit BATCH that only a
   function-backed action applies; the object-search caveat then holds by
   construction, since nothing is written during the call.
3. **Versioning is the JobSpec pattern, plus semver**: `functions` +
   `function_versions` (major/minor/patch/prerelease, immutable after
   creation), with the six documented breaking-change checks run against the
   previous version's signature at publish. The check WARNS on widening and
   REFUSES on the rest — Foundry warns; ours refuses because we have no
   human release-review step, marked.
4. **Execution runs as the caller** — SECURITY INVOKER, exactly as 493
   settled, so "the permissions of the end user running the function
   determine which objects are loaded" holds without new machinery. The
   plan-walk sandbox restricts base relations to the declared object types'
   index tables.
5. **API names take the page's four rules verbatim** (lowerCamelCase, <100
   chars, no leading digits, unique per ontology), and a query resolved by
   API name resolves to its latest version, per the page.
6. **No RID column yet.** A full-corpus sweep prints no
   `ri.…function…` anywhere — the same evidence bar Q1 used. Existence is
   likely (manage-functions searches "by … RID"), so this is recorded as the
   next Q1-style question rather than invented.
7. **Recorded, not built**: webhooks/external functions, language models and
   semantic search, streaming, notifications, Marketplace packaging, the
   sidecar Python runtime, live preview, per-version resource configuration
   (timeouts/memory as tunables), consistent snapshots, and Workshop/Slate/
   Quiver consumption (those products do not exist here).

## Open questions

1. The function RID form — same shape as Q1, and answerable from the same
   kind of page if the operator has one.
2. Do we expose queries through our generated client automatically (every
   published query becomes a typed entity) or only on request? I propose
   automatically: `gen:client` already generates per-entity values, and the
   page's own consumption example is that exact call shape.
3. Function-backed actions (F2's consumer) touch `action_types`' function
   rule, which 418 built and left pointing at nothing. Confirm F2 should
   wire that rule rather than invent a second execution path.
