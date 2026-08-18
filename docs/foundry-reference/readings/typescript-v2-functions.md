---
verify: strict
---

# TypeScript v2 functions — the flavour we built, read properly

The functions reading deferred the language-implementation pages by name ("the
TypeScript v1/v2 and Python getting-started, API-reference and unit-test
families"). We then built the v2 contract from the API corpus alone. This reads
the v2 pages themselves.

**Read in full, with every image parsed:** `functions/typescript-v2-getting-started`
(7 images), `functions/typescript-v2-migration` (4 images),
`functions/typescript-v2-staged-writes`, `functions/language-feature-support`,
`functions/branching-functions` (5 images), `functions/resource-imports-sidebar`,
`functions/ontology-imports`.

**Read in full since:** `functions/functions-versioning`, `functions/version-range-dependencies-for-functions` (both after the operator pointed out that my open questions were answered in the docs).

**Read for one section:** `global-branching/integrations` — the "Notable
limitations" list only.

**Previously read in full, not re-read:** `functions/typescript-v2-ontology-edits`,
`functions/edits-overview` (both in `readings/functions.md`).

**Named and NOT opened:** `functions/types-reference` (1,604 lines of language
bindings), `functions/functions-deployed`, `functions/webhooks`,
`functions/api-calls`. Nothing below rests on them.

**Eleven images were not on disk.** Every screenshot on these pages is
referenced by absolute URL (`/docs/resources/foundry/...`), which the mirror
script does not localise, so `pnpm check:readings` had nothing to check and a
reader had nothing to look at. They are now downloaded and the links rewritten.
Three of them carried the load-bearing facts below.

## 1. A function is a file, and its identity is the path

> "To write a new function, create a new file in the `typescript-functions/src/functions` directory of your repository and give it a descriptive name, for example, `helloWorld.ts`. Write your function using `export default` for Foundry to detect it."

The four published conditions are exact: a `.ts` file in that directory, **the
file name matching the function name**, the function as the default export, and
input/output types from the type reference. Then:

> "Your function's file path is used to uniquely identify the function that gets published from it. Note that a change in your function's file path will therefore result in a new function being published."

**Connects to us:** our identity is `functions.api_name` unique per ontology,
which is the same *shape* — a stable name that a rename breaks — arrived at from
the API pages rather than the repository layout. Nothing to change.

## 2. Versioning is per REPOSITORY, and this is a real divergence

> "After committing your work, you will see the **Tag version** option. This will publish all of the functions in your repository."

> "You can release functions by tagging a branch or a commit."
> — functions/images/new-functions-tag.png

**What the image adds that the prose does not.** The publish dialog shows a
`Stable | Prerelease` toggle, three suggestions computed against the last
release — `Patch 0.0.2`, `Minor 0.1.0`, `Major 1.0.0`, each with the sentence
explaining what it signals — a `Use custom tag` escape, and a footer reading
`Releasing: 0.1.0`. The 0.x rows carry a `Development` chip that 1.0.0 does not.
Above the suggestions sits the comparison that drives them:

> "Comparing the current commit with latest version 0.0.1. No breaking changes have been detected."
> — functions/images/new-functions-tag.png

and on a branch, the same panel says the opposite and moves the recommendation:

> "Major 6.0.0 Recommended ... Comparing the current commit with latest version 5.0.0. Some breaking changes have been detected."
> — functions/images/branch-function-publish.png

**So the release unit is the repository, not the function.** One tag publishes
every function in it, and all of them share that version number.

**We version per function** (`function_versions.function_id`), and 536 built
resolution on that. This is a divergence, and it is the one thing in this
reading I would not change without being told to: our functions are rows, not
files in a repository, so "the repository" has no representation here. The
honest description is that we have collapsed repository-and-function into one
thing, the same way 442 collapsed Foundry's four Funnel jobs into one. It is
recorded rather than silently kept.

**What we did get right by accident:** the breaking-change comparison against
the last release is `signature_breaks`, and the Major recommendation is our
`Functions:BreakingChangeNeedsMajor`. The dialog computes and suggests; we
compute and refuse. Refusing is stricter, and 536's guard now orders prereleases
the same way the resolver does.

## 3. The client is the first parameter

> "In TypeScript v2, you must access an Ontology SDK client by specifying it as the first argument in the function signature"

with the printed shape `export default async function countAircraft(client: Client)`,
and objects arriving as `Osdk.Instance<Aircraft>`. That is what F1 built.

Three details we do not have:

- **Streaming reads.** `client(Aircraft).asyncIter()` is the recommended way to
  process many objects, because `.all()` "can lead to high memory usage and
  slower performance as the number of objects in your Ontology grows". Our host
  mediator answers whole result sets.
- **A full Node.js runtime**: "supporting core modules like `fs`, `child_process`, and `crypto`". Ours is QuickJS/WASM with a host-mediated read API and no
  core modules at all — deliberately, and recorded in `readings/functions.md`.
- **Resource requests**: "TypeScript v2 functions allow you to request up to 8 vCPUs and 5GB of memory". Supabase edge gives us 256 MB and 2 s of CPU.

## 4. Warm invocations — and we are cold

> "TypeScript v2 functions use warm invocations where all module-level code is evaluated once during initialization and then reused across subsequent invocations. This means that a `randomUUID` call at the module level will be evaluated a single time and produce the same value for every warm invocation. Always generate random values inside the function body to ensure uniqueness."

**Checked against our isolate rather than assumed:** `_shared/isolate.ts` builds
a QuickJS runtime and context per invocation and disposes both, so module-level
code runs every time. We are cold, and the trap this callout warns about cannot
occur here.

## 5. Staged writes are a second execution model, in Beta

> "Staged writes are in the beta phase of development and may not be available on your enrollment."

Against the model F2 built (`createEditBatch`, return `batch.getEdits()`), a
staged-write function:

> "Provide a read-after-write guarantee for Ontology edits applied in the function. All edits applied within the function are staged and will be reflected in Ontology queries and aggregations later in the function."

> "In staged-write functions, the Ontology edits are automatically staged and will be applied to the Ontology at the end of the function execution when the action completes. This frees up the return value of the function to return other information to the caller."

> "If the function throws an error, the Ontology remains unmodified and all staged edits are discarded before the function is retried by the action."

It takes a `WriteableClient<T>` rather than a `Client`, with `create`, `update`,
`delete`, `link` and `unlink` methods, and nested calls — including AIP Logic —
join the same staged edits. Two constraints worth keeping:

> "Interface edits are not supported in staged-write functions."

> "To edit one to many links, edit the foreign key property using a create or update object edit."

That second sentence is our link-backing model exactly: a one-to-many link is a
foreign key, so editing it is an object edit, and only many-to-many gets
`link`/`unlink`.

## 6. The feature matrix, which settles three questions at once

`functions/language-feature-support` is one table, and three rows matter:

- **Ontology interfaces support** is `Yes` for TypeScript v2 and `No` for AIP
  Logic, TypeScript v1 and Python. v2 is the only language that can touch
  interfaces — while staged writes cannot.
- **Deployed execution support** is `Yes` for v2, and the page recommends
  against it: "Serverless functions enable different versions of a single function to be executed on demand, making upgrades safer. With deployed functions, you can only run a single function version at a time."
  **That sentence is the reason 536 exists.** Version resolution is a serverless
  property, and serverless is the recommended mode.
- **Webhook support** and **Functions on models support** are `No` for v2. Two
  things we will never owe this flavour.

## 7. Imports carry versions, and we import two kinds of six

`resources.json` is the checked-in import manifest, and its shape is published:
`objectTypes` and `linkTypes` are `{ rid }`, while `functions`, `valueTypes` and
`functionInterfaces` are **`{ rid, version }`**, plus `sources`.

Our `function_versions.imports` is `{"object_types": [], "link_types": []}` —
the first two categories, by id rather than rid. The gap is not the missing
four; it is that **an imported function or value type is pinned at a version**,
which is the same pinning 536 built for the caller side and which we do not yet
record on the callee side.

Note the page's own banner: "The following documentation is specific to TypeScript v1 functions." The `resources.json` shape is therefore v1's, and the
v2 equivalent describes the same sidebar without publishing a file format —
what it does publish is the scope an import lives in:

> "Any object, interface, or link types you want to use in your function must be imported into the Project that contains your repository."

(`functions/ontology-imports`.) **Which is where ours already lives**: `functions.project_id` places a function
in a project, and `function_to_run` refuses a caller with no role on it.
**Marked as inference: that the v2 manifest carries the same six categories.**

## 8. Branching does not apply to us

> "You can develop, publish, and consume functions on a global branch. This is currently supported for TypeScript v1 functions and AIP Logic functions."

> "**TypeScript v2 and Python functions:** Currently, you cannot modify TypeScript v2 or Python functions on a branch."

Settled in PR #604 and not revisited here. The screenshots did correct one
assumption: a branched version is a normal version number carrying a label —

> "4.0.1 Branched pre-release"
> — functions/images/rebasing-functions.png

— beside a plain `4.0.0`, **not** a semver prerelease tag.

## Decisions

1. **Keep per-function versioning.** Foundry tags a repository and publishes
   every function in it at one version. We have no repository, so the collapse
   is recorded here rather than corrected. Nothing in the API corpus depends on
   the repository being the release unit.
2. **Stay cold per invocation.** The documented model is warm; ours re-evaluates
   module code every call. Cold is stricter, and it makes the module-level
   `randomUUID` trap impossible. Not changing this for performance without a
   measurement that says it matters.
3. **Do not build staged writes.** It is Beta, "may not be available on your
   enrollment", and it is a second execution model beside the one F2 built and
   verified. Recorded in the gaps list.
4. **Do not build deployed execution.** The page recommends serverless, and the
   sentence recommending it is the justification for the resolution work we
   already shipped.
5. **Build nothing from this reading yet.** The two candidates are the import
   manifest's version pinning (§7) and streaming reads (§3), and both are
   additive rather than corrective.

## Questions — two of three answered by pages I had not opened

The operator's response to this reading was that both questions are answered in
the documentation. **Both were.** Recorded as found, because the failure mode
here is asking rather than grepping.

1. **~~Is per-function versioning the right collapse?~~ ANSWERED: yes, at the
   level that matters.** `functions/functions-versioning` treats the version as
   the function's throughout — its worked example opens:

   > "You have a function called `myFunction` at version `1.0.0` which takes a single string input."

   and the API's Query resource carries `apiName` and `version` per function.
   The repository tag is the *authoring* act that assigns them in bulk; the
   *contract a consumer sees* is a function at a version, which is exactly our
   model. One repository-scoped rule we do not have:

   > "Dropping a function. This includes deleting a function in your Python or TypeScript function code repository."

   counts as a breaking change, and our compatibility check is per function.
2. **~~Should an imported function be pinned?~~ ANSWERED, and it is richer than
   pinning.** `functions/version-range-dependencies-for-functions` is a whole
   page I had never opened:

   > "Workshop, Actions, and Automate can depend on either a pinned function version or a version range. A version range enables automatic runtime upgrades, which can reduce development work and allow [deployed functions](/docs/foundry/functions/functions-deployed/) to upgrade without downtime."

   **Reworded upstream by 2026-08-18, and it grew a third application**: the
   sentence named Workshop and Actions when this was written and now names
   **Automate** too. Nothing here rests on the list being two — but a reading that
   had turned that list into a constraint would now be wrong, which is why the
   drift sweep re-reads rather than re-quotes.

   > "Applications like Workshop and Actions currently only allow version ranges that comprise backward compatible versions (that is, minor or patch upgrades)."

   > "The NPM equivalent of this backward compatible range used by Workshop and Actions is the caret range"

   > "when you depend on a Function at a version range, a concrete version that satisfies the range will be chosen at runtime during execution. In particular, the *maximum* satisfying version will be chosen"

   **This is what `action_type_rules.auto_upgrade` meant all along.** 509 took
   that toggle from a screenshot and shipped it off by default; nothing ever
   read it. 538 makes it a caret range resolved to the maximum satisfying
   version. Pinned remains the documented conservative choice: "if your
   application has strict uptime requirements and cannot tolerate any breaks,
   you should use pinned version dependencies."
3. **~~Does `functions/types-reference` add anything?~~ ANSWERED, and it found a
   real error.** The page prints every type once per language tab, and two of
   the nine tokens `function_type_valid` accepted were **TypeScript v1's**:

   > "TypeScript v1 uses the `LocalDate` and `Timestamp` types from the `@foundry/functions-api` package for working with temporal data. TypeScript v2 replaces these with the `DateISOString` and `TimestampISOString` types from the `@osdk/functions` package"

   We built the v2 contract while accepting v1 spellings, so an author writing
   the v2 code we claim to run would be refused for `DateISOString` and
   accepted for two types that do not exist in their language. Fixed in 539; no
   stored signature used either, so nothing was rewritten.

   **Everything else survived the crossing, checked tab by tab rather than
   assumed:** `Integer`, `Long`, `Float`, `Double` are the same names from
   `@osdk/functions`; `boolean` and `string` are themselves; `ObjectSet<T>`
   comes from `@osdk/client`; and `OntologyEdit[]` is what the v2 examples print
   verbatim, so it is a v2 spelling rather than a v1 leftover.

   The families it publishes that we do **not** accept are listed in
   DELIVERABLE-MAP. They are not oversights — each needs the isolate to marshal
   it, and a token the runtime cannot carry is worse than a missing one: the
   signature passes and the call fails.

## A correction to 536

536 marked prerelease ordering as inference, saying the documentation "does not
say how two prereleases of the SAME `x.y.z` order against each other". It does,
by reference, on the range page:

> "You should also be familiar with the rules around version precedence as defined in the Semantic Versioning specification … In other words, you should be able to determine, given two distinct versions, which one has lower precedence. For example, `1.0.0-rc.1` < `1.0.0` < `1.0.1` < `1.1.0` < `2.0.0`."

The printed example confirms both things 536 implemented — a release outranks
its own prerelease, and prerelease identifiers are dot-separated — so what was
marked as invention was documented all along. Corrected forward in 538 rather
than edited into the applied migration.
