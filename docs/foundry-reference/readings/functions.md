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

**Revised 2026-08-14, on the operator's correction: build it the way Foundry
builds it.** The first draft made the logic SQL — an expression compiled by
Postgres, the way 493's transforms work. That was a shortcut, and the wrong
one: it changes what a function *is*. Foundry's functions are **code**,
"executed on the server side in an isolated environment", and we already own
every piece that shape needs.

1. **The logic is TypeScript, executed server-side in an isolated
   environment** — the page's own sentence, not an analogy. The runtime is a
   Deno **Worker** spawned inside a Supabase edge function with no ambient
   permissions: no env, no file system, and **no network of its own**. This
   is not a new substrate; `supabase/functions/` already runs Deno, and
   CLAUDE.md rules out the JVM, not TypeScript — TypeScript is Foundry's own
   first language for functions.
2. **The ontology reaches the code through the generated client, and only
   through it.** Foundry generates "code bindings" from imported object and
   link types; `pnpm gen:client` already generates exactly that, and the
   page's own consumption example is our call shape verbatim. Inside the
   worker the injected `client` does not fetch: it posts each call to the
   host, which performs it with the **caller's JWT**. So user code holds a
   capability, never a connection — and "the permissions of the end user
   running the function determine which objects are loaded" is enforced by
   RLS on a real request rather than by our own re-implementation.
3. **Imports are declared, like a repository's ontology imports.** A
   function declares which object types and link types it uses (the page:
   code bindings are generated "for every object and link type that was
   loaded", from the repository's imports); the host refuses a mediated call
   naming anything undeclared. That is the sandbox, and it is the honest
   equivalent of Foundry's project-level imports.
4. **Queries first, edits second.** F1 builds the read-only subset — "they
   cannot have any side effects" — which is enforceable here precisely
   because the worker cannot reach anything the host does not mediate, and
   the host refuses writes for a query. F2's edit functions RETURN an edit
   batch; only a function-backed action applies it, so the documented
   object-search caveat holds by construction.
5. **Versioning is semver, immutable, with the six published checks**:
   `functions` + `function_versions` carrying the source, the typed
   signature and the declared imports. Foundry *warns* on breaking changes;
   ours **refuses** without a major bump, because we have no human
   release-review step. Marked as stricter than documented.
6. **API names take the page's four rules verbatim** (lowerCamelCase, <100
   chars, no leading digits, unique per ontology), and an API-named query
   resolves to its latest version, per the page.
7. **Limits are the page's numbers**: 60 seconds elapsed by default, and the
   worker is terminated at the deadline — a limit the isolate enforces,
   which a SQL expression could never have honoured.
8. **No RID column yet.** A full-corpus sweep prints no `ri.…function…`
   anywhere — the same evidence bar Q1 used. Existence is likely
   (manage-functions searches "by … RID"), so this is recorded as the next
   Q1-style question rather than invented.
9. **Recorded, not built**: Python as the second language (CLAUDE.md already
   reserves it for modelling behind an adapter seam), webhooks and external
   functions, language models and semantic search, streaming, notifications,
   Marketplace packaging, live preview, per-version resource configuration,
   consistent snapshots, and Workshop/Slate/Quiver consumption.

## Built (2026-08-14) — slice F1, the artifact half: migrations 501–502

Shipped and asserted: `functions` with the four documented api-name rules,
`function_versions` immutable after creation carrying source + typed
signature + declared imports, `signature_breaks()` implementing the page's
published list of breaking changes (dropped, moved, retyped, newly-required
inputs, output changes) with numeric widening staying compatible, a major
bump enforced rather than warned, latest-STABLE resolution for api-named
queries, and placement standing in for the repository-Viewer gate. Seven
standing regressions in `functions.test.ts`. `502` gives the exploration
readers their api-name form, because the client says `client(Aircraft)`.

### The execution half: an isolate DOES exist here — measured, after a wrong call

**Correction, 2026-08-14.** This section first recorded "no isolate is
available on this platform" and blocked the runtime on it. That was wrong,
and the operator was right to challenge it. What I had actually measured was
two mechanisms — nested `Worker`, and an in-database V8 — and I generalised
from their absence to a claim about the platform. The generalisation did not
follow.

Measured on `supabase-edge-runtime-1.74.3` (compatible with Deno v2.1.4):

| primitive | result |
|---|---|
| `Worker` (nested isolate) | undefined |
| `EdgeRuntime.userWorkers` | undefined |
| `plv8` / `plrust` / `plpython3u` | absent from `pg_available_extensions` |
| **`WebAssembly`** | **present — a module compiled, instantiated and RAN** |
| **`npm:quickjs-emscripten`** | **imports; `getQuickJS` is a function** |

So the runtime is a **JS engine compiled to WebAssembly** (QuickJS), which is
a stronger sandbox than the Deno worker originally proposed: a WASM module
has linear memory and *no* ambient anything — no `fetch`, no `Deno`, no host
`globalThis` — and can only call functions the host explicitly injects. The
recovery trick that defeats in-process shadowing
(`({}).constructor.constructor('return this')()`) reaches only the guest
engine's own global, which holds nothing. QuickJS also carries an interrupt
handler and a memory ceiling, so the documented 60-second limit and a memory
bound are enforceable rather than aspirational.

This also lands us on Foundry's **recommended** execution mode rather than
its discouraged one. `functions-deployed.md` names both: *deployed*, a
long-lived container where "you can only run a single function version at a
time", and *serverless*, "leveraging on-demand resources", which "enable[s]
different versions of a single function to be executed on demand, making
upgrades safer" and is what Palantir recommends. An isolate spun up per
execution is the serverless shape, and it fits the latest-stable resolution
501 already built.

**Lesson recorded:** absence of the two mechanisms I thought of is not
absence of the capability. Probe the capability, not my first two guesses.

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
4. Authoring surface: Foundry's is a code repository with checks and a
   publish step. Ours will be an editor in Ontology Manager's Functions tab
   for F1 — enough to write, type-check and publish one function. A real
   repository (branches, PRs, CI) is a product we do not have and is not
   proposed.
5. ~~How execution lands, given the measured constraint.~~ **ANSWERED by
   the probe above**: a QuickJS-on-WebAssembly isolate per execution —
   Foundry's recommended serverless shape — with the host mediating every
   ontology call under the caller's JWT. No Management API token, no
   per-function deployment, no quota.
   an isolated environment" is literally true here.
