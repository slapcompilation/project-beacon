---
verify: strict
---

# Reading — the Ontology SDK, and where the ontology is authored

Read to settle a fork I refused to guess at: **should application code name
storage, and should the ontology live in code or in the database?**

Both are answered, and the second is answered in a way I did not expect — Foundry
supports *both*, and names the path that matches us.

Pages read:
- `mirror/ontology-sdk/overview.md`, `typescript-osdk.md` (query shapes, filtering),
  `unsupported-types.md`, `how-to-add-to-existing-typescript.md`
- `mirror/superrepo/core-concepts.md`

Read, and nothing below quotes it: `mirror/superrepo/overview.md` — the section
front door, which names the components `core-concepts` then defines.
  *(the superrepo section is not in `all-foundry-urls.txt` — the index predates it.
  Fetched by following links from its overview.)*

---

## Application code never names storage

```typescript
const result = await client(Restaurant).fetchOne("primaryKey");
const page   = await client(Restaurant).fetchPage({ $pageSize: 30 });
const filtered = await client(Restaurant)
  .where({ restaurantName: { $isNull: true } })
  .fetchPage({ $pageSize: 30 });
```

`Restaurant` is an **imported generated value**, not a string. Property names are
**typed keys** in `where`. There is no table, no column literal, no join to spell
wrong — the failure mode we spent this session guarding against does not exist in
the shape.

The response carries a `$`-prefixed envelope beside the camelCase properties:

```json
{ "$primaryKey": "Restaurant Id", "$apiName": "Restaurant",
  "restaurantId": "…", "restaurantName": "…", "numberOfReviews": 123 }
```

And the doc's own property table annotates the two keys inline —
`Restaurant Id (primary key)` → `restaurantId`, `Restaurant Name (title)` →
`restaurantName` — which is the `properties-and-keys` reading showing up in the
generated artifact.

One behaviour that ties back to the storage layer: "If `Restaurant` is backed by
**Object Storage v2, there is no request limit**. If backed by Object Storage v1
(Phonograph), there is a limit of **10,000 results**." The backend leaks into the
client's contract.

### The four stated benefits, and the third is the one that matters here

> * "**Strong type-safety:** The functions and types generated for the OSDK are
>   based on just **the subset of the Ontology relevant to you**. Types and
>   functions are generated from your Ontology, allowing you to query and
>   explore your Ontology directly in your editor."
>
> * "**Centralized maintenance:** As the Ontology is **built and managed
>   centrally in Foundry**, you can focus on application building and decrease
>   the typical maintenance burden required to build a data foundation."
>
> * "**Secure by design:** The OSDK uses a token that is **scoped only to the
>   ontological entities** you want your application to access, in addition to
>   the user's own permissions to the data."

The third is the one that matters here.

`unsupported-types` is the honest limits page. For the TypeScript SDK:

The unsupported ones are `Cipher`, `Marking` and `Vectors`, and for each:

> "the code generator will **skip that property and log the error**."

**`Marking` is unsupported.** Mandatory control properties never reach application
code, by design — the marking value is enforcement metadata, not application data.
That confirms migrations 399–407 belong entirely server-side and should never have
a client representation.

## Where the ontology is authored — Foundry supports both

This is the fork I would have got wrong by guessing.

### Path 1 — Ontology-as-code (code is the source)

> "Ontology-as-code provides a pro-code way for you to define your Ontology
> entities in a SuperRepo. **TypeScript definitions** of your object types,
> interfaces, actions, and other entities are **compiled and materialized into
> real entities** on your enrollment after your product is deployed.
> **Ontology-as-code acts as the source of truth for your entities**, so you should
> manage all changes from your code definitions."

### Path 2 — import (the platform is the source)

> "Ontology entities that **already exist on your enrollment, including those
> created in the Ontology Manager**, can be **imported** into your SuperRepo with
> the `foundry import ontology` command **instead of being redefined in code**. Importing
> **generates the OSDK and Ontology-as-code types for those entities**… The command
> writes the import metadata to a **lock file that you should commit to your
> repository, because code generation is based on it**."

**Our ontology is database-authored** — `object_types` rows, written by migrations
and the Ontology Manager surface. That is path 2 exactly: the platform holds the
entities, code is *generated from* them, and the generation input is committed.

**And we already do a thin version of it.** `gen:ontology` read `object_types` and
wrote `ontology.generated.ts`; `gen:ontology:check` failed CI when it was stale.
The committed generated file *is* the lock file.

*(Superseded 2026-08-07: that generator was broken — it queried the `properties`
column dropped in 408 — and its output was empty. Replaced by `gen:client`; see
[the-generated-client.md](the-generated-client.md).)*

### And the SDK regenerates on change

> "SuperRepo **automatically generates SDK bindings** for your Ontology-as-code
> definitions… The local development servers **watch for changes to the Ontology
> and automatically regenerate the bindings** when needed."
>
> "you can extend the Ontology and consume the new types within a **single
> edit-and-preview loop, without republishing an SDK version between each change**."

The non-SuperRepo path — Developer Console, an NPM registry, `FOUNDRY_TOKEN`,
publishing SDK versions — is infrastructure for the case where the ontology lives
in a *different system* from the application. We do not have that split, and the
SuperRepo paragraph describes our situation almost verbatim: "an Ontology and
application that **evolve together** and that you want **versioned and released as
a single artifact**."

### Two practices worth stealing

> "**Ontology linting** is a second established pattern: Ontology owners who need
> to enforce style and design-pattern guidelines write **linters that check the
> entity definitions** in code before they are deployed."

That is the Foundry-endorsed form of the guard I was groping at — applied to
*ontology definitions*, not to table-name strings.

> "The CLI ships with the **embedded Ontology**, so you can write **integration
> tests that span the breadth of your workflow**."

A local ontology to test against, rather than a live one. `check:datasets` runs
against the real database; this is the alternative shape.

`foundry.yml` names the components — `ONTOLOGY`, `TYPESCRIPT_FUNCTIONS`, `APP` —
with `osdkOutput: ontology/osdk-output` and an `apiNamespace`. SuperRepo is **Beta**.

---

## Decision

**Fork (a) — code or database as the ontology source? → the database, unchanged.**
Foundry supports both and names the import path for "entities created in the
Ontology Manager", which is ours. Moving object type definitions into TypeScript
files would be choosing the *other* documented path for no stated reason.

**Fork (b) — generate the access layer? → yes.** Unambiguous, and it removes the
failure classes rather than guarding them.

**But the ordering resolves itself, and this is the finding:** a typed client
cannot be generated from what `object_types` currently holds. `client(Aircraft)
.where({ tailNumber: … })` needs a per-property **API name**, a real **base type**,
a **primary key**, and the **datasource binding** — none of which exist while
properties are a jsonb blob.

**O2 and O3 are not an alternative to the generated client. They are its input.**
The question "should we generate?" turns out not to compete with the object-layer
work at all; it is what the object-layer work is *for*.

So: **O2 → O3, then extend the generator from interfaces into a client.** No fork
to take, and nothing to empty.

## A correction the operator caught

I applied CLAUDE.md's *wanting an allowlist is the signal to index instead* to `check:tables`
and **exempted my own work from it**. Categorising `check:datasets`' 40 assertions:

| kind | count | verdict |
|---|---|---|
| **behavioural** — execute, compare to a documented answer | 35 | keep, grow |
| **liveness** — every guarded table readable as `authenticated` | 1 | keep; it found the outage |
| **structural** — grep the policy text for a literal function name | 1 | **the allowlist instinct** |

And migration 407 contains a hand-written list of seven function names, justified
in the words CLAUDE.md warns about — "listed explicitly rather than inferred, so
adding one without adding it here is a visible omission."

Both had strictly better behavioural equivalents:

- *the list policies compose `resource_file_access`* → **the list agrees with the
  detail**: a dataset you cannot read must not appear in `select from datasets`,
  and one you can must. That tests the property rather than the spelling, and it
  catches a policy that composes the right function *wrongly* — which the grep
  could not.
- 407's SECURITY DEFINER list → already redundant with the liveness probe. A
  resolver left with invoker rights and called from a policy **recurses**, and the
  probe fails. The list detected what the probe prevents.

`check:datasets` now has **no structural assertions at all** — every one executes
behaviour. 41 assertions.

### And the deeper half of the question: is the ontology the right registry?

Yes, for one of the two things `check:datasets` does, and it is not the one it does
today.

- **Engine conformance** — does the view algorithm match the published example, do
  the commit rules hold, does RLS actually work. This tests *machinery*. The
  ontology knows nothing about `SNAPSHOT` semantics; a bespoke suite is right, and
  it is the part that keeps catching real bugs.
- **Content well-formedness** — does every object type have a primary key, does
  every property map to a column that exists in its datasource's schema, does any
  bound datasource carry a `MAP` column. **That is ontology linting**, and today it
  is scattered into triggers (405) and one assertion here.

It is scattered because **the ontology cannot yet answer those questions** —
properties are a jsonb blob with no api name, no base type, no column mapping.
After O2/O3 each becomes a *query against the ontology* rather than a bespoke
assertion, and the trigger in 405 becomes a lint rule.

So the trajectory is: `check:datasets` shrinks toward engine conformance and
liveness, and content checks migrate into the ontology as it becomes able to hold
them. Same direction as everything else here — **O2/O3 are the enabling step.**

## Open questions

1. **The application-scoped token.** "scoped only to the ontological entities you
   want your application to access, in addition to the user's own permissions." We
   have only the second layer. What builds the first — Developer Console — is
   unread.
2. **What does an Ontology-as-code definition look like?** The API reference is an
   open-source repo (`palantir/osdk-ts`, `packages/maker`), not a docs page. Worth
   reading before designing the generator's output shape.
3. **`developer-console/`** is unmirrored and is where OSDK applications are
   created and scoped.

## Decisions taken

Recited to the operator 2026-08-07. Nothing built from this reading; it settles
the ordering rather than adding work.
