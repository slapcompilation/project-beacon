---
verify: strict
---

# Reading — the Ontology SDK, and generating ours

Read to build the thing that **deletes `check:rpcs`** rather than maintaining it.

Pages read in full: `mirror/ontology-sdk/typescript-osdk.md` (1,024 lines),
`overview.md`, `how-to-add-to-existing-typescript.md`. Images parsed separately:
`osdk-overview.png`, `osdk-demo-app.png`, `app-ontology-resource-scopes.png`.
Builds on `osdk-and-ontology-as-code.md`, which settled that our ontology is
database-authored and code is generated *from* it.

---

## The page

Documented against one example object type, given as a property table with the
two keys annotated inline — `Restaurant Id` **(primary key)** → `restaurantId`,
`Restaurant Name` **(title)** → `restaurantName`, `Number Of Reviews` →
`numberOfReviews` (Integer). That table is `object_type_properties`: display
name, API name, base type, and both designations as annotations.

**Reads.** `fetchOne("primaryKey")`, `fetchPage({ $pageSize: 30 })`,
`asyncIter()`, `$orderBy: { restaurantName: "asc" }`. Every response carries a
`$`-prefixed envelope beside the camelCase properties — `$primaryKey`,
`$apiName`.

**Filters are constrained per base type, and the page says which:**

| operator | "Only applies to…" |
|---|---|
| `$startsWith`, `$containsAnyTerm`, `$containsAllTerms`, `$containsAllTermsInOrder` | String |
| `$lt` `$gt` `$lte` `$gte` | Numeric, String and DateTime |
| `$eq` | Boolean, DateTime, Numeric, and String |
| `$isNull` | Array, Boolean, DateTime, Numeric, and String |
| `$not` `$and` `$or` | any, and composable |

**Actions are separate values, not methods on the object type:**

> "Action types in the Ontology refer to predefined operations that you can
> perform on objects within your data model. These actions can **create, modify,
> and delete objects** in the Ontology."

`client(addReview).applyAction({…}, { $returnEdits: true })`, returning
`result.type === "edits"` with a per-parameter `validation` block and counts.
`batchApplyAction` "does not return validations, only edits."

**Functions** are the read half:

> "Functions provide a way to **define and execute custom logic** on the data
> stored in the Ontology, allowing users to create more sophisticated data
> **transformations, validations, and analytics**."

`client(findSimilarRestaurants).executeFunction({ restaurantId })`.

## What the images add that the prose does not

**`osdk-overview.png`** — the Application SDK panel. Tabs **Data entities · SDK
generation · Settings**. Three sections, each with an `⊕ Add` control:
**OBJECT TYPES (4)**, **ACTION TYPES (4)**, **FUNCTIONS (2)**. An object type row
is `icon · Display Name · [ApiName] · Experimental` — the status chip we already
have — expanding to `1 LINK TYPE / 3 ACTION TYPES / 0 FUNCTIONS`, with the zero
counts **greyed and non-expandable**. At the bottom, **Discard changes / Save
changes**.

That is the detail the prose hides. "based on just **the subset** of the Ontology
relevant to you" reads as automatic. **The image shows a curated list you edit and
save** — the SDK's contents are a decision.

**`osdk-demo-app.png`** — generated SDKs as published artifacts: NPM
`@todo-app/sdk` **0.3.0**, PyPI, Conda, each with a registry URL and "View past
versions", while the app itself is at **0.1.0**. They version independently. And:
"This application and its viewers can only access entities that have been **added
to the data scope**."

**`app-ontology-resource-scopes.png`** — "Application access is limited to the
scopes below, **in addition to the user's permissions**." Two layers, exactly as
the overview claims. Same three sections again, which is what confirms **object
types / action types / functions is the structure of an SDK**, not one page's
layout.

## The finding, before building

**The ontology holds zero object types.** The teardown emptied it at 355. And
`gen:ontology` was **broken** — still querying the `properties` column dropped in
408, so `pnpm gen:ontology` failed outright while CI's `gen:ontology:check` sat
behind the secret.

The five names `check:rpcs` guarded — `dataset_markings`, `dataset_view`,
`object_type_problems`, `project_role`, `save_object_type` — are **not
object-type reads**. Four are functions in Foundry's sense; `save_object_type` does what the page calls an
action — "create, modify, and delete objects in the Ontology".
They map onto the image's second and third sections.

So the guard-deleting half is functions and actions, and it needs no object
types. Built that; the object-type section waits for a type to exist, because an
empty one is the half-built version that looks like a foundation.

## What was built

`scripts/generate-client.mjs` → `packages/platform/src/generated.ts`, 47
entities: 3 actions, 44 functions, each with its `COMMENT` as a doc comment, a
typed parameter object, and the return type the database declares (a `TABLE(…)`
becomes a row-object array).

**The scope is derived, and this is the part that could have gone wrong.**
Foundry's is curated — Add controls, Save changes — and "Application access is
limited to the scopes below" makes it a **security scope, not an exemption
list**. Hand-listing five names in a generator would have been the allowlist
instinct again. Ours asks the catalog what the scope would express: `EXECUTE`
granted to `authenticated`, the role the app connects as, minus what the catalog
also disqualifies — trigger functions, which nothing can call, and anything an
extension owns. 176 → 50 → 47.

**Overloads have no representation.** An entity has one API name, so `rid_of`
(3-arg and 4-arg, migration 396) is left out — and *named in the generated file*,
so the gap is visible rather than silent.

## Four defects found while wiring it

1. **The overload could not discriminate.** `ActionType` and `FunctionType` were
   structurally identical, so TypeScript matched the first every time and every
   entity offered `applyAction`. They carry a literal `kind` now.
2. **The type map used internal names.** `bool`, `int4` never appear in
   `format_type` output — it prints `boolean`, `integer`. Every boolean and
   integer generated as `unknown`, which compiles at the definition and fails at
   the use.
3. **A name collision**: the generated `saveObjectType` against the wrapper of
   the same name.
4. **`rls_violations` classifies as an action** because it is VOLATILE — it sets
   a GUC to switch roles. It only reads. Volatility is the best signal the
   catalog offers and it is a *proxy*; noted rather than papered over by lying
   about the function's volatility to please the generator.

## What is deliberately absent

Foundry's action response carries a per-parameter `validation` block and an
`edits` summary with counts. Ours has neither — our actions are Postgres
functions that throw or return. Building that envelope with nothing behind it
would be a shape pretending to a mechanism.

The NPM registry, `FOUNDRY_TOKEN`, OAuth and Developer Console are for the case
where the ontology lives in a *different system* from the application. Ours
evolve together, which `osdk-and-ontology-as-code.md` already settled.

## Decisions taken

- `check:rpcs` **deleted**. A wrong name is now `TS2724: has no exported member
  named 'datasetViewz'. Did you mean 'datasetView'?` — verified by mutation.
- `generate-ontology-types.mjs` and `ontology.generated.ts` deleted: broken,
  empty, and nothing consumed them.
- `gen:client:check` replaces `gen:ontology:check` in CI. Verified by mutation:
  changing a generated `apiName` makes it fail.
- The client lives in `@beacon/platform`; `pg` moved to devDependencies so the
  browser never pulls it.

## Open questions

1. **The object-type section.** Blocked on an object type existing. When one
   does, the per-base-type filter vocabulary above is the spec for `where`.
2. **`$primaryKey` / `$apiName`.** The envelope belongs on generated object
   instances; nothing to attach it to yet.
3. **The action/function proxy.** Volatility is not intent. If actions ever gain
   validation semantics, the split needs a declared signal — and Foundry's is
   declared, not inferred (you *Add an Action type*).
4. **`check:surfaces` is the same category** and goes the same way once object
   surfaces are generated from their registration.
