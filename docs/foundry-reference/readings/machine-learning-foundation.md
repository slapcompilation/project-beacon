---
verify: strict
---

# Machine Learning — the model lifecycle, and the seam we do not have a language for

**The area is five sections, not the two I had queued: `model-integration` (21),
`manage-models` (17), `integrate-models` (40), `model-studio` (10) and
`model-catalog` (3) — 91 pages and 272 images.**

**Pages read whole (17):** `model-integration/{overview, what-to-use, models,
objectives}`, `manage-models/{submit-model, review-model, release-model,
create-a-model-deployment, archive-model, set-up-checks, set-up-batch,
set-up-live, models-in-the-ontology}`, `integrate-models/{integrate-overview,
model-adapter-overview, model-adapter-api}`, `model-studio/core-concepts`.

**Images: those 17 pages reference 50 distinct files, of which I opened seven** —
`model-integration/images/concepts_concept-flow1.png`,
`model-integration/images/concepts_concept-deployments.png`,
`manage-models/images/concepts_concept-review.png`,
`integrate-models/images/custom_adapter-lifecycle.png`, and — after the
adversary pass in §10 falsified my claim that the unopened rest were "button
locations" — `manage-models/images/howto-create-deployment.png`,
`manage-models/images/manage_release-history.png`,
`manage-models/images/setup-configure-objective-check.png`. Those last three
each changed or confirmed schema (§10).

**Forty-three I did not open**, named so the debt is recorded as mine:
`model-integration/images/2-Models.svg`,
`model-integration/images/concept_foundry-model.png`,
`model-integration/images/concept-metric-flow.png`,
`manage-models/images/manage_submit-model-new.png`,
`manage_submit-model-existing.png`, `manage_submit-model-popover.png`,
`manage_release-staging-home.png`, `manage_create-release-staging.png`,
`manage_create-production-release.png`,
`model-direct-deployment-start.png`, `configure-modeling-direct-deployment.png`,
`model-deployment-function-publish.png`, `edit-runtime-configuration.png`,
`schedule-overrides.png`, `model-deployment-debugging.png`,
`direct-run-debug.png`, `archive_view-archive.png`, `archive_howto-archive.png`,
`archive_no-archive.png`,
`objective-checks.png`, `setup-submission-checks.png`,
`evaluation-checks-create-check.png`,
`evaluation-checks-evaluation-results.png`, `evaluation-checks-result.png`,
`setup-archive-a-check.png`, `setup-filter-submissions-by-check.png`,
`howto-configure-batch-deployment.png`,
`howto-edit-batch-deployment-configuration.png`, `howto-view-deployment.png`,
`howto_open_batch_deployment_output.png`,
`howto_configure_batch_deployment_schedule.png`, `howto-live-create.png`,
`howto-live-update.png`, `publish_function_objective_deployment.png`,
`howto-live-success.png`, `howto-live-actions.png`, `howto-live-disabled.png`,
`howto-configure-live-deployment.png`,
`howto-edit-live-deployment-configuration.png`, `howto-live-logs.png`,
`howto-live-metrics.png`, `integrate-models/images/model-architecture-foundry.png`,
`integrate-models/images/model-adapter.png`.

---

## 1. A model is two things, and only one of them is code we could run

> "In Foundry, a model is an artifact for inference that contains machine learning, forecasting, optimization, physical models, or business rules."

— `model-integration/models.md`

The definition is deliberately wide — "business rules" is in it — and that
matters for what we can honestly build. The architecture is exactly two parts,
stated the same way on three pages:

> "Model artifacts: The model weights or container where the trained model is saved."

— `model-integration/models.md`

> "Model adapter: The logic that describes how the platform can interact with the model artifacts to load, initialize, and perform inference with the model."

— `model-integration/models.md`

The adapter is the seam, and it is a **declared, typed interface** rather than
an opaque callable:

> "The model adapter's `api()` method specifies the expected inputs and outputs in order to execute this model adapter's inference logic. Inputs and outputs are specified separately."

— `integrate-models/model-adapter-api.md`

> "At runtime, the model adapter's `predict()` method is called with the specified inputs."

— `integrate-models/model-adapter-api.md`

**What the image adds that the prose does not.**
`custom_adapter-lifecycle.png` draws the whole thing as one flow, and gives the
join point a name the prose never quite does. Two creation paths — a model
trained in Foundry (`init ModelAdapter` → `Model.publish`, both marked *called
by a user*) and a container model (adapter library published, container
uploaded to a model asset) — converge on a single **Model Version** box whose
caption, the three inference steps, and their annotations read:

> Model Version … Model dependencies are resolved and saved … If container-backed model, launch container(s) as sidecar to transform … ModelAdapter.load … initialize … load … ModelAdapter.predict … The arguments to the run inference are what is defined in the API … Results are written to Foundry
> — integrate-models/images/custom_adapter-lifecycle.png

So the **version** — not the model — is what gets deployed, and the API
declaration is what binds a call to it.

## 2. The objective is an interface; a submission is its implementation

This is the sentence the whole application is built on, and it is a design
statement, not a description:

> "You can think of an objective as the definition for a modeling problem—the *interface* of the problem, for which the models submitted provide the *implementation*."

— `model-integration/objectives.md`

> "When a model is submitted to a modeling objective to be managed and evaluated, a copy of that model version is created. This immutable submission is akin to a code Pull Request - when submitting a model, you are asking for a comprehensive review."

— `model-integration/objectives.md`

**A submission is a COPY, and the image proves it.**
`concepts_concept-flow1.png` shows `MODEL C` standing alone in a *Foundry model
container* on the left, an arrow labelled `SUBMITTED`, and on the right a
*Modeling Objective* holding `MODEL A`, `MODEL B` and `MODEL C` — the same
model, drawn in both places at once. A submission is not a pointer.

## 3. Two release kinds, and one of them is a promotion target

> "A **production release** represents the best current model and will power all production deployments in its modeling objective."

— `manage-models/release-model.md`

> "A **staging release** is a release that is staged to become the production release; staging releases are used in all staging deployments."

— `manage-models/release-model.md`

Promotion is a named act — *Mark as production* — not an edit. And a release
carries three things:

> "A Release includes configurable environment tags (such as \"Staging\" or \"Production\"), a user-defined version number, and a short descriptive field—a release note."

— `model-integration/objectives.md`

One rule follows that has a clean home in a trigger:

> "Once a model submission has been released, it can no longer be archived."

— `manage-models/release-model.md`

## 4. Deployments consume the TAG, not the release

> "Deployments can be configured to pick up the latest tagged release. For example, a deployment with a \"Production\" environment will take the latest tagged \"Production\" release."

— `model-integration/objectives.md`

Two kinds, and the batch one is a shape we already have:

> "**Batch deployments** run models within a pipeline by executing the model on a designated input Foundry dataset and publishing results into an output dataset."

— `model-integration/objectives.md`

> "For low-latency or interactive settings, models can be served via **Live deployments**, which provide a serverless REST API endpoint that can be interactively queried."

— `model-integration/objectives.md`

A batch deployment is *a job spec*: declared inputs, one computation, one
output dataset locked by a transaction. That is 493-496 exactly.

**What the deployments image adds.** `concepts_concept-deployments.png` shows
the section is grouped **by environment**, with the environment's current
release named in the group header (`Production (1)` … `All deployments
upgraded` … `Release 4.0 · spark_random_forest_classifier`), and a table whose
columns are `DEPLOYMENT NAME`, `TYPE`, `LAST UPDATED`, `RELEASE`, `HEALTH`,
`UPGRADE`. So a deployment carries **both** a health state and an upgrade
state, and the group header answers whether everything is on the current
release, which is the whole CI/CD claim made visible.

## 5. Checks and reviews are two different mechanisms

Reviews are a decision on the submission. **The capture enumerates the three
options with the page's own descriptions** — and because it is a screenshot,
this set may not carry a `Values from` declaration:

> Leave comment … Submit general feedback without explicit approval … Accept … Approve this model to be tagged as a release … Reject … Reject this model
> — manage-models/images/concepts_concept-review.png

The same capture gives the submission page's four tabs — `Model details`,
`Metrics`, `Checks`, `Reviews` — a right rail of `RELEASES` / `CHECKS SUMMARY`
/ `REVIEWS` / `MODEL DETAILS`, and a green **Create new release** button at top
right, so release is an action ON a submission.

Checks are separate, configured per objective, and can be automatic:

> "Modeling objective checks are a way to ensure that models pass predefined quality checks before a model is operationalized."

— `manage-models/set-up-checks.md`

> "A `PASS` status is achieved when the metric satisfies the requirement. If the metric fails the requirement or is not found in the set of metrics produced by the chosen evaluation library, a status of `REJECT` is given with a message describing the reason for rejection. If metrics were not yet built for the combination of submission, input dataset, and evaluation library associated with the check, the status of the check will be `PENDING`."

— `manage-models/set-up-checks.md`

**And here is the trap this reading exists to avoid, caught BEFORE building
rather than in reconciliation:**

> "Currently, it is not mandatory for all checks to be approved before creating a release for a model submission."

— `manage-models/set-up-checks.md`

A check that blocks a release would be stricter than Foundry. It advises; it
does not refuse. That is the `ontology_warnings()` rung of the ladder, not the
trigger rung.

## 6. Metrics are a set, bound to one evaluation

> "A `MetricSet` encapsulates the numerical metrics, images, and charts for a single model evaluation. `MetricSets` contain a reference to the corresponding model (and version), as well as the singular dataset and transaction (i.e. version) on which the metrics were computed."

— `model-integration/objectives.md`

A metric set therefore names **four** things: model, version, dataset, and the
dataset's transaction. That last one is why our dataset layer matters here —
"reproducible" means the transaction is pinned, not just the dataset.

## 7. Model Studio: three trainers, and training is a transform

> "Model studio trainers are the actual model training implementation that is used to train a model. Each trainer is targeted at a specific task."

— `model-studio/core-concepts.md`

Three, enumerated on that page: **Time series forecasting**, **Regression**,
**Classification**. And the sentence that puts training inside machinery we
already have:

> "Training jobs run as standard transforms in Foundry, meaning that data lineage is respected and any markings applied to input datasets will be applied to the output model."

— `model-studio/core-concepts.md`

> "Experiments are artifacts that represent a collection of metrics produced during a model training job."

— `model-studio/core-concepts.md`

## 8. The honest problem: we have no Python

`what-to-use.md` names the library the whole pro-code path is built on:

> "The `palantir_models` library provides flexible tooling to publish and consume models within the Palantir platform, using the concept of **model adapters**."

— `model-integration/what-to-use.md`

CLAUDE.md's substrate rule is "**Python for modelling, behind an adapter seam**
— when there is a model, not before." This is that moment, and we still have no
Python runtime. What we do have is 501-502: **versioned code with a declared
typed signature, executed in a QuickJS/WASM isolate under the caller's JWT**.
That is structurally the same seam — declared interface, immutable version,
host-mediated reads — in a different language.

**Inference (not from any page):** an adapter here is a `function_version`
whose signature plays the role of `api()`, and `predict()` is the function
call. The divergence is the language and the sandbox, and it should be recorded
on the adapter table itself rather than implied.

## 9. Connects to

- **Datasets, transactions and builds (391-396, 493-496)** — a batch deployment
  is a job spec; a metric set pins a transaction; training "runs as a standard
  transform".
- **Functions (501-502)** — the adapter seam, in the only language we can run.
- **Approvals (651) and proposals (680-681)** — reviews are the same
  accept/reject/comment shape, but on a different resource; do not reuse the
  table, reuse the pattern.
- **Projects and roles** — "Objective owners can set roles to control access
  for review, release, and deployment" (`manage-models/review-model.md`).
- **`ontology_warnings()`** — where a check belongs, since checks advise.
- **Quiver (696)** — `card-code-function-object-set` and the modelling cards are
  in its catalogue unbuilt; a model that can be called makes some of them real.

## 10. Corrected BEFORE building — the adversary pass

Before any migration was applied, a foundry-adversary pass tried to falsify
this reading against all five sections, the `api/` mirror and the images. It
confirmed the load-bearing claims — checks never block, the submission copy,
batch-through-builds, the model-catalog exclusion, all 22 quotations byte-exact
— and falsified enough that the build would have shipped 691's class of defect
three more times. Each catch, with what the schema now does instead:

**A release carries tags, PLURAL.** §3 modelled `environment` as one value that
promotion flips. The release history capture — which I had dismissed unopened —
shows one release wearing both badges:

> 2.0 … Staging … Production … Tagged production on Mon, Nov 28, 2022
> — manage-models/images/manage_release-history.png

and the prose I myself quoted says "configurable environment tags", plural. So
there is no environment column at all: a release is staging-tagged from birth
and promotion ADDS the production tag with its own timestamp, which is the
capture's "Tagged production on" line. The skipped **Release history** section
of the same page carries the currency rule:

> "Every release will overwrite the previous release for that environment, and all deployments in that environment will automatically be upgraded to use the newly released model."

— `manage-models/release-model.md`

**Direct model deployments are a second resource, and I had silently skipped
them.** `create-a-model-deployment.md` was on my read-whole list while I had
read three of its nine sections. It is about a deployment bound to a model
BRANCH, with no objective, no submission and no release anywhere in it:

> "One direct model deployment can be created for each branch of a [model](/docs/foundry/model-integration/models/). When a new model version is published to that branch, the direct model deployment will automatically upgrade to the new endpoint with no downtime."

— `manage-models/create-a-model-deployment.md`

Its comparison table is the page that settles which features belong to which
kind — automatic upgrades and type safety to direct, pre-release review,
inference history and automatic evaluation to objective live deployments. The
enumerating table I skipped on `what-to-use.md` lists both kinds under **Model
deployment**, and its **Batch inference** row carries a caveat the batch runner
now inherits verbatim:

> "Does not support multi-output and external models, [models as sidecars](/docs/foundry/integrate-models/transform-model-input/#running-models-as-sidecar-containers), or deployment via Marketplace as [detailed here](/docs/foundry/model-integration/marketplace-models/)."

— `model-integration/what-to-use.md`

**The create form is one resource with a type radio.** Opening
`howto-create-deployment.png`: Deployment name, Description, `Release tag to
deploy` (Staging/Production radios, captioned "a production environment will
take the latest production tagged release"), `Deployment type` —

> Batch … Models will take in and output a dataset in one build. … Live … Models are available online as near real-time runtime inference endpoints, which can be executed by API calls.
> — manage-models/images/howto-create-deployment.png

— then Input dataset (branch-stamped `master`), Output dataset (create new /
select existing), Spark profiles, and a `DEPLOYING RELEASE 1.0 Staging`
preview. "In one build" is the batch runner's warrant.

**The check form confirms the approver split.** `setup-configure-objective-check.png`
holds exactly: Check name, Description, **Reviewer groups** (multi), **Reviewer
users** (multi) — the user-or-group approver rows the schema has.

**Submission immutability is scoped to the COPY.** The word "immutable" in
`objectives.md` modifies the copied model version; the submission row itself is
archived and carries editable per-objective metadata ("Custom metadata fields
can be collected with each model submission" — the `## Metadata` heading I
skipped). The guard freezes the snapshot and the references, nothing else.

**The `api/` mirror publishes what the prose omits, and the reading never
looked.** Now wired in: `ModelVersion.source` is a seven-member union
(`importedContainerizedModel`, `external`, `codeWorkspace`, `modelStudio`,
`codeRepository`, `sdk`, `promoted` — `api/models-v2-resources-model-versions-get-model-version`),
a live deployment's `status.state` is `ACTIVE`/`STARTING`/`DEGRADED`/`DISABLED`/`FAILED`
(recorded unbuilt — no runtime exists to be in those states), and a Model
Studio training run speaks the builds vocabulary (`buildStatus`:
RUNNING/SUCCEEDED/FAILED/CANCELED).

**Also surfaced, recorded not built:** the adapter API's seven input/output
types and eleven column types (now the declared vocabulary of a version's
`api`), the batch asymmetry "Column types are generally *not* enforced for
batch inference, unlike live inference" (`integrate-models/model-adapter-api`),
trainer parameters and the always-latest training configuration, and archived
checks keeping their history.

## 11. Post-build reconciliation (2026-08-27)

After the merge, the three cited pages I had still only read in part —
`set-up-batch`, `set-up-live`, `review-model` — were re-read whole
(review-model turned out to be complete already). Two finds, neither a
wrongness, both recorded rather than quietly absent:

**A live deployment RID is attested.** The curl example queries

> "https://<URL>/foundry-ml-live/api/inference/transform/ri.foundry-ml-live.main.live-deployment.<RID>"

— `manage-models/set-up-live.md`

so the service is `foundry-ml-live` and the kind `live-deployment`. Neither of
our deployment tables carries a RID column; the attested token covers only the
live kind, so this waits for a deliberate migration rather than a guessed one.

**A release triggers the rebuild through a schedule.**

> "You can [create a schedule](/docs/foundry/building-pipelines/create-schedule/) on the output dataset of a batch deployment for it to automatically update whenever a new model is released to that deployment environment."

— `manage-models/set-up-batch.md`

Foundry wires release → output-dataset logic update → logic schedule. Our
batch runs are caller-triggered; wiring a deployment to a job spec so a
release rebuilds the output is the same residual 695 recorded for Fusion
syncs, and it is named here rather than implied. Also confirmed on the same
pages: dataset-backed deployments answer only single-I/O queries (ours do,
by the inherited caveat), and the objective live deployment's Publish
Function step is trivially satisfied here because the adapter already IS a
function.

## Decisions

1. **Build the lifecycle, which is the documented part**: models → versions →
   adapters (declared api) → objectives → submissions → checks → reviews →
   releases (staging/production, with promotion) → deployments (batch/live) →
   metric sets and experiments.
2. **A submission COPIES the model version**, per §2 and the image. It is
   immutable and it is what everything downstream points at.
3. **A release's environment tag is the deployment's selector.** A deployment
   names an environment, not a release, and resolves to the latest tagged one.
   Corrected by §10: the tag set is additive — staging from birth, production
   by promotion — and DIRECT deployments are a second resource that skips
   releases entirely, following the model's latest version. Ours bind one per
   model because models here have no branches; the branch column is the
   recorded gap.
4. **Checks never block a release** (§5). They are advisory, and the automatic
   status set `PASS` / `REJECT` / `PENDING` is declarable from
   `manage-models/set-up-checks`.
5. **Released submissions cannot be archived** (§3), and archived ones cannot
   be released ("Removes the ability to create a release from that model",
   `manage-models/archive-model`) — one trigger, one refusal in create_release.
   The submission's metadata stays editable; only the copy is frozen (§10).
6. **The adapter is a function version**, with the language divergence recorded
   on the table. Batch inference runs through the build engine so it is a real
   pipeline rather than a stored intention.
7. **Model Studio's three trainers are a catalogue**, not three implementations
   — the same treatment as Quiver's 203 cards. `Regression` is the one worth
   building, because it is the one our substrate can actually compute.
8. **Not in this build, recorded by name:** containers and container model
   adapters; external model connections (SageMaker, Vertex AI, Databricks,
   OpenAI); Hugging Face import; GPU training; Spark distributed training;
   serialization and `@auto_serialize`; the model catalogue and model
   deprecation; live deployment replica scaling, logs and metrics; compute
   usage accounting; marketplace models; the 74 unread pages.

## Questions

1. **Does a live deployment mean anything here?** We can hold the resource and
   its release binding, but a "serverless REST API endpoint" is an edge
   function per deployment, which we do not generate. I have assumed live
   deployments are modelled and their endpoint recorded as unbuilt, while
   **batch** deployments actually run.
2. **How much of a trainer should exist?** A regression trainer that fits a
   least-squares line over a dataset column is honestly computable in SQL and
   makes the whole loop demonstrable end to end. Fitting anything more is
   inventing a product Foundry documents but does not specify.
3. **Is `model_catalog` a separate resource or a view over models?** Three
   pages, unread, and the name collides with our own `catalog` (499-500). I
   have left it out entirely rather than guess.
