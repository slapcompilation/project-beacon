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
The overview page shows, as reworded upstream by 2026-08-18,
"In Ontology Manager, select a function to view its inputs, outputs, usage
history, and [function metrics](/docs/foundry/functions/function-metrics/),
including success and failure counts and P95 execution duration." The metrics —
counts and P95 — are new; the sentence used to stop at usage history.

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

### Built (2026-08-14) — the execution half: migrations 501–502 + `function-run`

The isolate is **QuickJS compiled to WebAssembly** (`npm:quickjs-emscripten`,
the asyncified variant), one per execution — Foundry's serverless shape. The
guest holds exactly one capability, `__hostCall`; every ontology read it
makes is performed by the host with the CALLER's JWT, so RLS decides what
the code sees. The documented 60-second limit is a QuickJS interrupt
handler, and the serverless memory default a runtime memory limit.

The authoring contract is the pages', not mine:
`export default async function name(client, ...inputs)`, the client first
and the declared inputs positionally (`typescript-v2-getting-started.md`
requires the default export; `query-functions.md` prints the signature);
`client(Aircraft).where({...}).aggregate({ $select: { $count: "unordered" } })`
and `client(X).fetchOne(pk)` are the printed v2 call shapes. Each declared
object type is injected as a guest global — the pages' "code bindings…for
every object and link type that was loaded".

**Verified live**, not asserted, against the seeded `[Example Data] Aircraft`:

| probe | result |
|---|---|
| a published function counting by model | `200 {"value":1}` — real data through the mediated client |
| a missing required input | refused before the isolate starts |
| guest reaching the host | `fetch: undefined`, `Deno: undefined`, guest globals = `client` alone |
| guest reading an UNDECLARED object type | `Functions:UndeclaredImport`, though the caller had permission |

**Corrected after the substrate mirror landed (2026-08-14):** the memory
limit was set to 1 GiB from memory of Foundry's serverless default. This
platform allows **256MB for the whole worker**
(`substrate-reference/mirror/functions/limits.md`), so the isolate now takes
128MB and leaves the rest to the host. The same page states the ceiling
Foundry has no equivalent for — "Maximum CPU Time: 2s … does not include
async I/O" — so a compute-heavy function dies there whatever deadline we set;
I/O-bound ones are unaffected. It also says plainly that "Web Worker API (or
Node `vm` API) are not available", which is the sentence that would have
saved the design cycle spent discovering it by probe.

Two build-time finds: a promise must not cross the boundary (the first
attempt deadlocked until the guest settled its own result into a plain
global and the host drained the microtask queue), and the deploy bundler
only carries statically imported modules — a worker referenced by runtime
URL never uploads.

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

---

# Addendum (2026-08-14) — F2: edit functions and the action that applies them

Pages read in full: `functions/typescript-v2-ontology-edits.md` (**the one that
matches what F1 built** — `functions/api-ontology-edits.md` is TypeScript v1
and its semantics differ, see below), `functions/edits-overview.md`,
`action-types/function-actions-overview.md`,
`action-types/function-actions-getting-started.md` and its screenshots
(backfilled — they were absolute `/docs/resources/` links and had never been
mirrored), `action-types/function-actions-batched-execution.md`. Plus the API
reference, now that it is reachable: `api/v2/ontologies-v2-resources` (85
pages), for the published edit vocabulary.

## 1. An edit function returns edits. It does not apply them.

> "The only way to update objects using a function is by configuring an action
> to use the function as described in the documentation for function-backed
> actions."

> "running an edit function outside of an Action will not actually modify any
> object data"

This is the rule the whole slice hangs on, and it is stated across both pages.
F1 already refuses writes from the isolate; F2 does not relax that. The
function returns a value, and only an action turns that value into edits.

## 2. The v2 shape, which is mechanical

> "For the edits created in a function to actually be applied, Ontology edit
> functions *must be configured as a function-backed Action*."

The batch carries five verbs — `create`, `update`, `delete`, `link`, `unlink`
— an object reference that is either a loaded instance or an API-name and
primary-key pair, and a declared return type of an edits array:

> "You must then declare that the function returns an array of edits of the new
> type."

**The v1/v2 difference is load-bearing and in our favour.** v1 says an edited
property read back returns the new value, which needs pending edits
materialized into reads. v2 says the opposite:

> "Subsequent access to the `lastName` property value of `employee` later in
> the same function execution will *not* reflect the changes that you make when
> calling `update` on the edit batch."

We built the v2 contract, so **the batch is write-only and reads are
untouched** — no pending-edit overlay. The object-search caveat holds for free:

> "Changes to objects and links are propagated to the object set APIs *after*
> your function has finished executing."

Also, for one-to-one and one-to-many links, v2 does **not** use `link`:

> "For one-to-one and one-to-many links, use the `update` method available on
> the created batch to modify the foreign key property of the source object."

Which is exactly how our link types are backed.

## 3. Provenance is a second declaration, and it is enforced

`imports` (F1) is what a function may **read**. Provenance is what it may
**edit**, and they are different lists:

> "you can use the `@Edits` decorator and specify the object types for which
> your function returns edits"

> "Currently, the provenance consists only of the object types that the action
> may edit at runtime."

And the enforcement, which is what makes it worth storing:

> "If a newer release of the function returns edits outside of this provenance
> (for example, an additional object type), action execution will fail."

## 4. What the screenshot adds that the prose does not

`action-types/images/function_backed_actions_configure_inputs.png` — the
**Run function** rule card:

- The function, labelled `addPriorityToTitle` **on `Demo Ticket`** — the rule
  shows the provenance next to the name.
- **A version dropdown reading `0.1.2`.** The rule pins a *version*, not just a
  name. 418 stored only `function_name`.
- **An `Auto upgrade to compatible versions` toggle**, off, matching "By
  default, if the function logic is changed, the action does not automatically
  update to match it."
- **`Required inputs`**, one row per function input, mapping the input `ticket`
  to a parameter. **The rule stores an input-to-parameter mapping**, which is
  the piece with no home in our schema at all.
- A read-only **Code Preview** with an `Edit in Code Repositories` link.

The prose says parameters appear — "all inputs of the function will
automatically be created as parameters and added to the **Parameters** tab" —
but only the image shows that the mapping is stored per input and editable.

## 5. The published edit vocabulary

`api/v2/ontologies-v2-resources/actions-apply-action.md` publishes the
`ObjectEdit` union: **`addObject`, `modifyObject`, `deleteObject`, `addLink`,
`deleteLink`** — each carrying `objectType` and `primaryKey`, the link variants
carrying `linkTypeApiNameAtoB`, `linkTypeApiNameBtoA` and both sides. The
response counts them too: `addedObjectCount`, `modifiedObjectsCount`,
`deletedObjectsCount`, `addedLinksCount`, `deletedLinksCount`.

The same endpoint publishes two option enums we do not have: `mode` is
`VALIDATE_ONLY` or `VALIDATE_AND_EXECUTE`, and `returnEdits` is `ALL`,
`ALL_V2_WITH_DELETIONS` or `NONE`.

Our `object_edits.instruction` is `create` / `modify` / `delete`, taken in 422
from the **rule kind** names in `action-types/rules.md`. That is a different
vocabulary from `ObjectEdit`, the way build status turned out to be different
from job status — I am *not* assuming they should be unified, and it is a
question below.

## 6. Atomicity

> "the backing function is usually called once per request in sequence, and all
> edits are applied atomically at the end of the action call"

> "The entire function must succeed in order to generate the list of edits
> which is passed to the actions service executing the atomic transaction."

One transaction, after the function returns, or nothing.

## Decisions (mine, not Palantir's, unless quoted)

1. **`function_versions` gains `edits`**, the provenance list, beside `imports`.
   Two lists because the pages describe two: what it reads, what it may edit. A
   version whose signature returns edits and declares no provenance is refused
   at publish.
2. **The guest harness gains `createEditBatch(client)`** with the five verbs and
   `getEdits()`, producing the published `ObjectEdit` shape. The batch is
   write-only — v2's own semantics — so nothing in F1's read path changes.
3. **The host returns the batch and applies nothing.** `function-run` already
   returns a value; an edit function's value is the edit array. Running one
   outside an action stays inert, which the pages demand repeatedly.
4. **`action_type_rules` gains `function_version_id` and `auto_upgrade`**, and a
   new `action_type_rule_inputs` table holds the input-to-parameter mapping the
   screenshot shows. Without that mapping the rule cannot be executed at all,
   which is why 418's rule has pointed at nothing since it landed.
5. **`apply_action` executes a function rule** by calling the function with the
   mapped parameters, then writing the returned edits as `object_edits` rows in
   the same transaction — the atomicity the pages state. **An edit naming an
   object type outside the version's provenance fails the action**, quoted
   above, rather than being silently dropped.
6. **Link edits are refused by name**, exactly as `create_link` and
   `delete_link` already are — 446's own registry note says a link instance
   store does not exist here yet, and that is the same fact (ours, not a
   quotation). A `link` call on a foreign-key-backed link is a property update
   and *does* work, because that is what the page says it is.
7. **`action_rule_kinds()` flips `function` to executable**, since its note
   ("needs a function runtime") is now false.
8. **Auto upgrade ships off and stays off.** The page documents three risks
   under its own headings — a user without edit permission on the action can
   change its behaviour, breaking changes can fail execution, provenance can
   drift. We have no release review. Recorded, not built.
9. **Recorded, not built**: batched execution, `VALIDATE_ONLY` mode, the
   `returnEdits` options, interface edits, struct-property edits, and Python.

## Questions

1. **Should `object_edits.instruction` take the published `ObjectEdit` names?**
   422 derived `create`/`modify`/`delete` from the rule-kind labels. The API
   publishes `addObject`/`modifyObject`/`deleteObject` for an *edit*. These may
   be two vocabularies for two things (as build status and job status turned out
   to be), or ours may be the same mistake again. I lean toward leaving
   `object_edits` alone and using the published names only in the batch the
   function returns — but this is exactly the shape of the error 493 made, so I
   would rather be told than guess.
2. **Does provenance cover link types too?** The page says "Currently, the
   provenance consists only of the object types that the action may edit at
   runtime", and "Currently" is doing work. I store object types only, per the
   sentence.
3. **Is one edit function per action rule right?** Every screenshot shows a
   single Run function card and the rule is exclusive, so yes — but nothing
   states a function cannot call another published function, and F1 has no
   mechanism for that.

---

# Addendum III (2026-08-14) — Q2 and Q3 answered, and a bug found on the way

Pages read: `action-types/rules.md` (re-read in full),
`monitoring-views/rules-reference.md` and `foundry-rules/core-concepts.md` +
`foundry-rules/object-model.md` (both newly mirrored — 35 pages),
`functions/function-metrics.md`, `action-types/action-metrics.md`,
`functions/edits-generate-id.md`.

**Two of the five links are a different sense of the word "rule".** Foundry
Rules is a business-rules workflow product where "Rules are standard objects"
with a logic property and a proposal review flow; monitoring rules are alerting
thresholds per resource. Neither bears on action-type rules. Saying so rather
than quietly finding something.

## Q3 — answered verbatim, with the reason

> "**Function rule:** Can be used to reference an Ontology edit function whose
> inputs are derived from parameters of the action. When this rule is present,
> no other rule may be configured since function code alone is capable of
> handling everything that other rules can do."

— `action-types/rules.md`, rule 7 of twelve.

One function rule per action, exclusive. 418 already enforces the exclusivity;
what was missing was the *reason*, and it is published: function code
subsumes every other rule kind. So a function-backed action needs no rule
composition and none should be built.

## Q2 — answered, and object types are the whole answer

The published failure vocabulary names the unit exactly:

> "**Undeclared object types edited error:** The function execution attempts to
> update, create or delete an object whose object type is not declared in the
> function spec."

— `functions/function-metrics.md`.

**Object type, not link type.** That aligns with the earlier "Currently, the
provenance consists only of the object types that the action may edit at
runtime", and `rules.md` explains why the gap is not a gap for us:

> "To create or delete one-to-many or one-to-one links, object rules need to be
> used and the foreign key property on the object needs to be modified."

> "For foreign key links, one has to use **Modify object** rule to explicitly
> modify the foreign key property."

A foreign-key link edit **is** an object edit, so object-type provenance covers
it completely. Only many-to-many links are true link edits, and those need a
link instance store we do not have. Provenance is object types, and for our
backing model that is not a simplification — it is the whole surface.

## Two published failure vocabularies, and two entries that exist only for us

`functions/function-metrics.md` lists ten function failure types and
`action-types/action-metrics.md` lists eight action failure types. Two of the
action ones are function-backed-only:

> "**Function failure:** The action failed because the underlying function
> failed. This failure mode is only possible for function-backed actions."

> "**User-facing function failure:** The function backing the action threw an
> error intended to be displayed to the user. This failure mode is only
> possible for function-backed actions."

So the action must distinguish *the function broke* from *the function
deliberately told the user something*. That is a real branch in apply, not a
nicety, and the monitoring page confirms it is the branch operators filter on:
the non-user-facing action rule tracks failures "excluding failures caused by
user-facing errors thrown by function-backed action code".

The function list also gives us `Invalid inputs error`, `Invalid output error`
and `Data loading not allowed error` — F1's `Functions:UndeclaredImport` is the
last of those, now with a published name to sit beside.

## A published limit

> "**Scale limit failure:** The action affected more than the permitted limit
> of object types (by default, usually 10,000)."

and, from `object-backend/overview.md`:

> "Increased user edit throughput, enabling up to 10,000 objects to be edited
> in a single Action."

The overview's wording is the precise one — **10,000 objects per action**. A
returned edit batch larger than that is refused.

## A bug found while reading, unrelated to F2

`rules.md` lists four value sources a rule property may take: **From
parameter**, **Object parameter property**, **Static value**, **Current
User/Time**. 418 admits all four in its CHECK, including
`object_parameter_property`:

> "**Object parameter property:** A property of an existing object reference
> parameter. The property type of the object parameter needs to match the
> property type it is mapped to."

But `apply_action`'s CASE handles `parameter`, `static`, `current_user` and
`current_time`, and falls through to `ELSE NULL`. So a rule that declares
`object_parameter_property` **silently writes NULL into the property** instead
of refusing. A declarable value that produces a wrong answer is worse than one
that refuses; this is CLAUDE.md's vocabulary-ahead-of-its-runtime case (our
phrase, not Palantir's), and it should at minimum raise rather than write NULL.

Recorded here rather than fixed, because it is not F2 — but F2 touches
`apply_action`, so it is cheap to fix in the same pass if you want it.

## Decisions, updated

Everything from Addendum II stands. Three additions:

10. **Provenance stays object-types-only, and is no longer marked as an
    inference** — the failure type names object types, and FK link edits are
    object edits by `rules.md`'s own instruction.
11. **Apply distinguishes two function failures**: a function that threw a
    user-facing error surfaces that message; any other failure is a function
    failure. Both fail the action, and both are named.
12. **The batch is capped at 10,000 objects**, the published limit, refused by
    name rather than truncated.

## Questions

None outstanding for F2. The three from Addendum II are closed: Q1 by the
flowchart's own `Instructions: Delete / Create / (Modification)` labels, Q2 and
Q3 above.

## Built (2026-08-14) — F2: migrations 509–512, PR pending

Decisions 1–12 shipped as recited, with four build-time findings.

- **The session writer could not carry a function rule.** 509 gave the rule a
  version, an auto-upgrade flag and an input mapping; `apply_action_type` (444)
  inserts six columns and none of the three were among them. A function-backed
  action could be assembled by hand and by nothing else — CLAUDE.md's fourth
  question, "what reaches it?", answered late. 511 extends the writer, taken
  from `pg_get_functiondef` rather than retyped.

- **I clobbered the submission-criteria gate.** 449 wired it into
  `apply_action` by patching the live definition in place; 509 restated the
  function in full from **446's** body, which predates that patch, and the gate
  silently vanished. Nothing static caught it — `actions.test.ts` did, on the
  next run, because it asks the behaviour rather than the text. 512 re-applies
  449's patch to whatever is live. **The rule this repeats: restate from
  `pg_get_functiondef`, never from the migration that first created the
  function.** A function accumulates patches and the oldest source is the least
  true. Same lesson as `object_set_where`, learned again.

- **`executable` had to split.** 446 defined it as "whether apply_action() can
  run it", and the surface's rule picker disables `NOT executable`. A function
  rule is executable but not in SQL, so the registry now answers two questions:
  `executable` (can it be applied at all) and `runtime` (which runtime does it).
  `apply_action` refuses anything whose runtime is not `sql` by name.

- **The isolate is now shared.** `_shared/isolate.ts` and `_shared/ontology.ts`
  are imported by both `function-run` and the new `action-apply`, rather than
  the runner existing twice. `check:edge` grew to parse `_`-prefixed
  directories and to require that shared files be reachable from some
  function's `index.ts` — shared code nothing imports ships nowhere at all.

**Verified live (2026-08-15), after a wrong claim.** I first reported this
unverifiable because `.env.local` held no `SUPABASE_ACCESS_TOKEN` — but the
Supabase CLI carries its own credential store and was already authenticated
and linked. Checking one place and generalising was the error; `supabase
projects list` settles it in a second.

Both functions deployed, and the deploy uploaded all four files including the
three `_shared` ones, which is the reachability model `check:edge` encodes.

- `function-run` on the refactored isolate: `{"value":0,"version":"2.0.0"}` —
  F1's path still works through `_shared/isolate.ts`.
- `action-apply` on a real function-backed action: `{"edits":1,"version":
  "1.0.0"}`, and the batch landed as one `object_edits` row — `modify`,
  `N-E2E-1`, `{"status":"grounded"}`. **So `createEditBatch` in the isolate
  emits exactly what `apply_function_edits` consumes**; the two halves were
  only pinned by a shared literal in the tests, and are now proven against
  each other in production.
- The provenance refusal fired live:
  `Functions:UndeclaredObjectTypeEdited — Nope is not declared in the function spec`.

The fixture was created in production and removed afterwards; `edits_enabled`
on the demo object type was restored to its prior value.

## Corrected (2026-08-14) — UserFacingError, found by crawling

The crawl that followed F2 refreshed the URL index from the sitemap for the
first time, and `functions/python-user-facing-error` **was not in the index at
all** before that. It names the mechanism F2 had guessed at:

> "When running functions in other parts of the platform, such as Workshop or
> actions, you may want to throw an error with a detailed message. To do so,
> throw a `UserFacingError`."

F2 mapped *every* thrown error to `Actions:UserFacingFunctionFailure`, so a
plain bug was reported as though the author had written it for the operator.
The distinction is the author's and is made in code — the guest now exposes
`UserFacingError`, the isolate reports a distinct outcome for it, and only
that becomes the user-facing failure. Anything else is a function failure.

Build-time trap, recorded because it has now bitten twice: the guest harness
lives inside a `String.raw` template, so a backtick anywhere in it — including
inside a comment — ends the template and breaks the deploy. `check:edge`
caught it before the commit, which is what it was restored for.

## Found later (2026-08-15) — "latest version" has two published meanings

`api/functions-v2-resources` was mirrored only after F1 and F2 shipped; it had
never been in reach, because those pages sit at `api/<resource>` with no `/v2/`
segment and every earlier crawl targeted `api/v2/…`.

F1 resolves an API-named function to its latest version. The API says that is a
CHOICE, with a default:

`latestVersionResolution` is an enum of `PUBLISH_TIME` and `SEMANTIC_VERSION`,
described as:

> "Controls how latest version is resolved when `version` is omitted. Defaults
> to `SEMANTIC_VERSION`."

and prereleases have their own rule:

> "When resolving the latest version, whether prerelease versions are
> considered. Defaults to `false`, except when `latestVersionResolution` is
> `PUBLISH_TIME`. Not supported together with `version`."

Ours resolves one way and names neither. `function_latest_version` should say
which of the two it implements, default to `SEMANTIC_VERSION` as published, and
exclude prereleases unless resolving by publish time. Recorded, not fixed.

---

## Upstream moved (2026-08-18) — what the drift sweep found

Re-mirroring `functions/` rewrote the section; one quotation here had gone stale
and is corrected above. Four things were **added**, and the first is a rule about
a combination we have both halves of.

### A function used as an automation effect does not get its edits applied

> "[Automate](/docs/foundry/automate/overview/) does not apply edits returned by functions used as effects. To apply Ontology edits through an automation, configure a function-backed action instead."

We have function effects (`automation_effects.kind = 'function'`, 517) and we
have Ontology edit functions (F1, 501–502). **This sentence says the composition
of the two is not what it looks like**: the function runs, its edit batch is
discarded, and the supported route is a function-backed *action* effect. Nothing
shipped is wrong — our function effect does not apply an edit batch — but it was
unstated, and an unstated case is where an invention goes. It is now stated.

### Extended execution is an administrator's grant, not a function's property

> "Administrators control extended execution capabilities through **Functions settings** in [Control Panel](/docs/foundry/administration/control-panel/). These capabilities grant elevated access, such as calling [actions](/docs/foundry/action-types/function-actions-overview/) from within a function or obtaining authentication tokens with a time-to-live (TTL) of up to four hours."

> "Functions executed through [Automate](/docs/foundry/automate/overview/) run asynchronously for up to **4 hours**, exceeding the standard execution limits."

Two consequences. **Calling an action from inside a function is a privilege that
is granted, not a capability that exists** — which is the shape our declared-import
enforcement already takes, and a good sign the seam was drawn in the right place.
And the execution limit is not a property of the function: the same function gets
a different ceiling depending on who invoked it.

### A registry error worth carrying by name

> "A `PERMISSION_DENIED` error with the code `FunctionRegistry:ReadOntologyFunctionPermissionDenied` typically means the function is not registered or available in Developer Console, rather than indicating a folder-level permissions issue. Add and register the function in Developer Console. Folder and repository permissions alone do not make the function executable."

Namespaced, typed, with a payload — the pattern CLAUDE.md takes from their stack.
And the last sentence is a permission-model claim, not troubleshooting advice:
**registration is a distinct requirement from access.** A caller holding every
folder permission still cannot execute an unregistered function, which is why
the failure surfaces as PERMISSION_DENIED and misleads. Ours has no registry
separate from the function row, so the case cannot arise — recorded because the
first instinct on seeing that error is to widen a grant, and widening would not
have fixed it.

### Staged writes are a second edit mechanism

> "Standard Ontology edits use an edit batch. TypeScript v2 also supports [staged writes](/docs/foundry/functions/typescript-v2-staged-writes/)"

We built the edit batch. Staged writes are a page we have not read.

## Decisions from the sweep

1. **Nothing is rebuilt.** All four additions are additive, and the one that
   touches a combination we have both halves of — function effects and edit
   functions — describes a behaviour we happen not to have implemented.
2. **The function-effect rule is recorded on both sides.** It belongs to this
   reading and to `automate.md`, because whoever later wonders why a function
   effect does not write to the Ontology will be looking at one or the other.
3. **`typescript-v2-staged-writes` is unread and goes on the queue**, not built
   from. It is named as an alternative to the edit batch, which is the mechanism
   F1 shipped, so it is the kind of page that quietly makes a shipped design
   look like the only option.
4. **Extended execution is not built.** It is a Control Panel grant we have no
   counterpart for, and inventing one would put an administrator's decision in
   the function's own definition.
