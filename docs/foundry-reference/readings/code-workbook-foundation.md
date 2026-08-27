---
verify: strict
---

# Reading — Code Workbook, the foundation

**Pages read whole: 43 of 43.** Every `.md` in `docs/foundry-reference/mirror/code-workbook/`,
including `_index.md`, which is byte-identical to `overview.md`.

**Images: 139 of 139 opened.** The section references exactly 139 image paths and
exactly 139 files sit in `code-workbook/images/`; the two sets are identical, with
no dangling reference and no orphan on disk. Nothing in this section still points
at `./media/`. **There is no image I skipped**, and the full manifest is at the
end of this reading so the claim is countable rather than asserted. I opened every
image referenced by `code-workbook/workbooks-overview.md`, `code-workbook/transforms-overview.md`,
`code-workbook/branching-getting-started.md`, `code-workbook/branching-merging.md`,
`code-workbook/session-history-pinning.md`, `code-workbook/templates-overview.md`,
`code-workbook/templates-multi-node.md`, `code-workbook/code-repositories-export.md`,
`code-workbook/environment-creation-overview.md` and `code-workbook/project-references.md`.

**Sublinks followed and read:** `administration/configure-code-workbook-profiles.md`
(named by six pages in this section), `platform-overview/development-life-cycle.md`
(named by the Legacy banner), `linter/rules.md`, `checkpoints/checkpoint-types.md`,
`data-lineage/node-coloring.md`, `security/projects-and-roles.md`,
`getting-started/application-reference.md`.
**Sublinks I did NOT read:** `notepad/widgets-code-workbook-chart.md` — the whole
`notepad/` section is absent from the mirror, which is the section-shaped absence
`CLAUDE.md` describes; `model-integration/models`, `model-integration/tutorial-intro`,
`code-workspaces/overview`, `data-lineage/manage-schedules`, `health-checks/overview`,
`transforms-python/*`, `transforms-python-spark/*` — all named by this section but
each is a separate reading's worth of pages and none is needed to settle what Code
Workbook itself is.

---

## 1. Is it Sunset? No. It is **Legacy**, and the difference is defined

The word *sunset* appears **nowhere** in the 43 pages (`grep -rni "sunset"
code-workbook/` returns nothing). What every page carries is a Legacy banner:

> Code Workbook is in the [legacy](/docs/foundry/platform-overview/development-life-cycle/) phase of development, and no additional development is expected. Full support remains available. We recommend exploring other applications and tools to serve your use case purposes.

— `code-workbook/overview.md`

`platform-overview/development-life-cycle.md` makes Legacy and Sunset two distinct
rows of one table, and they differ on availability, not on support:

> Legacy: Production feature without active development

— `platform-overview/development-life-cycle.md`

> Sunset: Feature slated for deprecation, but no date is scheduled

— `platform-overview/development-life-cycle.md`

> In the **legacy** phase of development, features and products enter a stage where work is considered complete and no additional feature development is expected.

— `platform-overview/development-life-cycle.md`

> All products and features in the legacy phase will be labeled as such and thoroughly documented publicly. At this point, no deprecation date is planned or expected.

— `platform-overview/development-life-cycle.md`

The platform-wide index agrees and prints the label in the product name itself:

> Code Workbook is a web-based environment for code-based analysis.

— `getting-started/application-reference.md`

So: **not sunset, not deprecated, no deprecation date, still fully supported, no
further feature work.** For this repo that is the useful reading — the shape is
frozen, so it is safe to copy, and the docs are complete rather than moving.

---

## 2. What the product is, in its own words

> **Code Workbook** is an application that allows users to analyze and transform data in code using an intuitive graphical interface.

— `code-workbook/overview.md`

The four goals it names are iteration speed, low barrier to entry, collaboration,
and platform interoperability. Six features: interactive console, visualization
support, templates, multi-language, branching, and a point-and-click UI that
customises the Spark environment and sets input types.

`core-concepts.md` names the five nouns, and they are the whole model:
**Workbook, Transform, Template, Environment, Branching**.

> The main resource you interact with in Code Workbook is a **Workbook**.

— `code-workbook/core-concepts.md`

> **Transforms** are pieces of logic that take one or more inputs and return a single output. Inputs and outputs can be Foundry datasets or models.

— `code-workbook/transforms-overview.md`

> Code **templates** enable users with a range of technical experience to collaborate by abstracting code away behind a simple form-based interface. Values selected by users are substituted into a code template, which can then be run like any other transform in the Workbook.

— `code-workbook/core-concepts.md`

> Each Code Workbook is associated with an **environment**. An environment includes a set of Conda packages and Spark settings installed on the Spark module backing computation in the Workbook.

— `code-workbook/core-concepts.md`

> **Branching** in Code Workbook provides a version control experience tailored to data transformation, enabling teams to operate on logic and data simultaneously in a Workbook.

— `code-workbook/core-concepts.md`

### 2.1 The graph, the node, and the two views

`workbooks-overview.md` is the structural page. Three claims matter:

> Input datasets are imported from elsewhere in Foundry to be used as source data in the workbook. Other than input datasets, each node in the graph represents a **transform**.

— `code-workbook/workbooks-overview.md`

> There are three types of transforms available in Code Workbook:

— `code-workbook/workbooks-overview.md`

Those three are **Code**, **Template**, and **Manual entry** — stated twice,
identically, in `workbooks-overview.md` and `transforms-overview.md`. That is the
enumeration; see §5.

> By default, this list of transforms is sorted in topological order; input datasets are at the top and the furthest downstream transforms are at the bottom.

— `code-workbook/workbooks-overview.md`

There are **two graph views**, Graph and Paths, and Paths is not a separate store:

> All transforms created in the Paths view are also persisted to the Graph.

— `code-workbook/workbooks-overview.md`

And three panes exist in every view — Contents, Global Code, Console:

> Code Workbook has three interface panes - [Contents](#contents), [Global Code](#global-code), and [Console](#console) - that are always available from the Graph, Paths view, and Full Screen Editor.

— `code-workbook/workbooks-overview.md`

### 2.2 Optional persistence is the execution model

This is the most load-bearing idea in the section, and it is the one that would
survive a port to Postgres. A node is *logic*; whether it becomes a dataset is a
toggle.

> By default, new transforms are not saved as datasets.

— `code-workbook/optional-data-persistence.md`

> When running a node, the logic from all unpersisted nodes upstream of that node will also be run.

— `code-workbook/optional-data-persistence.md`

> If you change the code in Unsaved Transform A but do not run it, and then run Saved Transform C, the result of Saved Transform C will reflect the change in logic.

— `code-workbook/optional-data-persistence.md`

> Unsaved transforms in Code Workbook are logical blocks, not resources in a Project.

— `code-workbook/optional-data-persistence.md`

> With optional persistence, unpersisted nodes compute only a preview, and persisted nodes only compute a write.

— `code-workbook/optional-data-persistence.md`

And the reason every node must return a table, which is the sentence that ties
Code Workbook to our whole dataset layer:

> The atomic unit of artifacts within Foundry is the dataset. Each transformation node needs to return a table or a dataframe (such as a two-dimensional data structure with columns) so that each node can be registered as a Foundry dataset and therefore available throughout the rest of Foundry.

— `code-workbook/faq.md`

> Can I set a transformation node to be a variable?

— `code-workbook/faq.md`

The answer given is no.

### 2.3 Aliases are a second, workbook-local namespace

> Transforms that are not saved as datasets are identified by a workbook-specific alias that allows you to refer to the transform in code. For input datasets, and transforms that are saved as datasets, Code Workbook shows two different names for each dataset: the name of the underlying Foundry dataset, and a workbook-specific alias.

— `code-workbook/transforms-overview.md`

> You can freely edit dataset aliases without changing the dataset names for anybody using the same datasets elsewhere in Foundry.

— `code-workbook/transforms-overview.md`

> You can change the alias of a dataset on a branch and merge this change across branches.

— `code-workbook/transforms-overview.md`

The alias is also the **binding mechanism** — the function's parameter name is
the parent's alias:

> By referencing a transform's alias as a function argument, Code Workbook will automatically pass as input of the transform the output of the mentioned alias.

— `code-workbook/workbooks-languages.md`

…except in SQL, where it is not:

> To add a parent to a SQL node, referencing the alias within the code is not sufficient. You must use the UI by selecting the input bar, or create the child node using the **+** button.

— `code-workbook/workbooks-languages.md`

### 2.4 Preview versus write: two jobs per run

> When you run your transform in Code Workbook, a 50-row preview is calculated to see the shape of your result.

— `code-workbook/transforms-overview.md`

> In Code Workbook, running a transform will start two jobs: one job calculates a 50 row preview, and the other job calculates the transformation on the full dataset and writes the result to Foundry.

— `code-workbook/transforms-overview.md`

> Running a transform requires edit permissions on the workbook, as well as access to all of the [Markings](/docs/foundry/security/markings/) used by any dataset used by the workbook.

— `code-workbook/transforms-overview.md`

Two warnings the page gives about ordering, both of which are Spark facts:

> As with other Spark-based applications, Code Workbook does not by default maintain row order when reading datasets. Sort your data in code if your analysis requires a particular row order.

— `code-workbook/transforms-overview.md`

> Once saved to a dataset, any sorting of the data that was applied in code may not be persisted.

— `code-workbook/transforms-overview.md`

Non-determinism gets its own section, and its conclusion is a persistence rule:

> If there is a non-deterministic transform, the result you see in the 50 row preview may not match the result in the Foundry dataset.

— `code-workbook/transforms-overview.md`

> If a transform computes a function nondeterministically (for example, using a `row_number` function or a function that calls the current time), you should persist the dataset to Foundry.

— `code-workbook/optional-data-persistence.md`

### 2.5 Manual entry

> Enter data in the **Manual Entry** tab. Currently supported column types are Double, Integer, Boolean and String. **Only 500 rows are supported.**

— `code-workbook/transforms-overview.md`

Four column types and a hard row cap. This is the only node kind whose data is
authored in the product rather than computed.

### 2.6 Global code

> The Global Code pane, accessible on the right-hand side of the Workbook interface, allows you to define variables and functions that will be available in all code transforms of that language across the Workbook.

— `code-workbook/workbooks-global-code.md`

> Note that in order to ensure that results are reproducible, mutating variables and functions in global code will not propagate to other transforms.

— `code-workbook/workbooks-global-code.md`

Global code is **per language**, and the reproducibility rule means each transform
gets a fresh copy of the global namespace rather than a shared mutable one.

### 2.7 Console

> On the right side of the workbook, the console provides a REPL (read-evaluate-print loop), enabling rapid, ad-hoc analysis of any transform on the graph. There is one console for each language enabled on your branch.

— `code-workbook/workbooks-console.md`

> If a console command returns a dataframe, you can use the **+ Add to graph** button to convert the console command into a transform.

— `code-workbook/workbooks-console.md`

### 2.8 Duplicate and copy nodes

> Nodes can be duplicated one at a time within a Code Workbook.

— `code-workbook/workbooks-duplicate-nodes.md`

> The following method allows you to create a copy of a node or set of nodes within the same Code Workbook or in different Code Workbooks.

— `code-workbook/workbooks-duplicate-nodes.md`

The FAQ adds a restriction the dedicated page does not:

> Copy-pasting Contour board nodes is not supported.

— `code-workbook/faq.md`

---

## 3. Branching, merging, and what a merge does to *data*

This is where Code Workbook diverges most sharply from Git, and where the docs are
most specific.

> By default, Workbooks are created with a single branch with the same name as the default branch across all of Foundry. Typically, this branch is called `master`.

— `code-workbook/branching-overview.md`

> By default, Code Workbook allows you to create at most 100 branches.

— `code-workbook/branching-overview.md`

**Branch creation snapshots data, not just logic:**

> When you create a branch, Code Workbook keeps track of the state of each dataset at the time of branch creation. Any transforms you run on your new branch will use this stored state to load data.

— `code-workbook/branching-overview.md`

> When you run transforms on a branch, Code Workbook creates branches on the associated Foundry datasets so that the results of your logic changes are stored in isolation from other branches.

— `code-workbook/branching-overview.md`

**Deleting re-parents:**

> Deleting a branch that still has child branches based on it will re-parent those branches.

— `code-workbook/branching-overview.md`

**Merges are only ever one level:**

> Note that Code Workbook only allows branches to be merged into their immediate parent.

— `code-workbook/branching-merging.md`

**A merge gets its own dataset branch, with an attested naming convention:**

> When you run transforms while merging, Code Workbook automatically creates a *merge branch* on output datasets. This allows the merge to be isolated from both the target branch and the source branch. These merge branches will appear on your dataset in the form `vector-merge-{source}-{target}-{uuid}`.

— `code-workbook/branching-merging.md`

`vector` is Code Workbook's internal service name — it recurs in
`vector-spark-module-py`, in the profile RID `ri.vector.main.profile.…`, and in a
generated comment in the exported repository (§7.3).

**Completing a merge always deletes the workbook branch, and optionally the
dataset branches:**

> Note this is different than deleting the workbook branch itself, which is always done with a merge and not configurable.

— `code-workbook/branching-merging.md`

> After the merge is completed, the branch you just merged will be deleted automatically, unless it still has child branches.

— `code-workbook/branching-merging.md`

**Imported datasets fall back up the branch hierarchy:**

> Code Workbook implements branch *fallbacks* for imported datasets, which means that the branch hierarchy in your Workbook will be used to determine where imported datasets should be pulled from.

— `code-workbook/branching-imported-datasets.md`

**Branch protection is two independent switches:**

> Currently, branch settings allow you to set a few options:

— `code-workbook/branching-overview.md`

> Is the branch protected? If a branch is protected, nobody can make edits to the branch directly. Instead, all changes must be merged in through another branch. Note that if a branch is protected, merging into it requires Owner permissions on the Workbook.

— `code-workbook/branching-overview.md`

> Does the branch allow running? If a branch is protected and this setting is turned off, datasets on this branch must be materialized using Foundry builds. This ensures that nobody can initiate an interactive run that prevents builds from succeeding.

— `code-workbook/branching-overview.md`

**And the permission model behind it — an enumerated set:**

> Internally, Code Workbook has four permission levels related to branches: `view`, `edit`, `maintain`, and `manage`. By default, `compass:read` expands to `view`, `compass:edit` expands to `edit`, and `compass:manage` expands to `maintain` and `manage`.

— `code-workbook/faq.md`

> Creating a branch and preparing a merge into a parent branch always requires only `edit` permissions. Merging into a protected branch requires `maintain` permissions. Changing branch protection settings requires `manage` permissions.

— `code-workbook/faq.md`

This is the cleanest published example anywhere in the mirror of an *application's
own operation set* expanding from Compass roles, and it is directly comparable to
`code-repositories/use-project-references.md` and `code-workbook/project-references.md`:

> To reference a resource, you must have `compass:import-resource-from` on the resource (usually expanded from the Viewer role) and `compass:import-resource-to` on the destination project (usually expanded from the Editor role).

— `code-workbook/project-references.md`

---

## 4. Environments, sessions and pinning

### 4.1 One module per user, per project, per environment

> Each user is assigned one Spark module that is used across workbooks in the same project with the same environment. Spark modules are never shared between users.

— `code-workbook/environment-overview.md`

> Because each user is assigned one Spark module that is used across workbooks in the same project with the same environment, your interactive job may queue on other jobs from a different workbook completing. For example, up to five Python jobs can run simultaneously on the same module.

— `code-workbook/environment-batch-interactive.md`

> R in Code Workbook is single-threaded, meaning only one R job can be run at a time on the same Spark module.

— `code-workbook/workbooks-languages.md`

> Within a batch build (for example, a scheduled build or a build from Dataset Preview), one build will use one Spark module per environment in the build.

— `code-workbook/environment-batch-interactive.md`

### 4.2 Solve, install, and the two caches

> Environment creation comprises two major steps: the solve step and the install step.

— `code-workbook/environment-creation-overview.md`

> Code Workbook has moved to using Mamba to resolve package dependencies and install sets of packages into independent environments.

— `code-workbook/environment-creation-overview.md`

The solve step is four stages ending in a SAT solve; the install step is three
stages ending in a link. Two optimisations short-circuit them, and **both expire
after the same interval**:

> Code Workbook avoids the [solve step](#solve-step) of the environment initialization by storing the result of a successful solve in a *spec file*.

— `code-workbook/environment-creation-overview.md`

> Code Workbook will, by default, invalidate a spec file after 24 hours.

— `code-workbook/environment-creation-overview.md`

> Using this image, Code Workbook can request subsequent Spark modules with all necessary packages already present on the module. This bypasses both the solve step and the on-module Conda install step, leading to much faster environment initialization times. Code Workbook will, by default, invalidate a Docker image after 24 hours.

— `code-workbook/environment-creation-overview.md`

> By configuring a warm module queue, Code Workbook ensures that a set of pre-initialized Spark modules are always ready to be assigned.

— `code-workbook/environment-creation-overview.md`

> The solve step scales superlinearly with environment size, so as a general rule of thumb, environments with more packages will take disproportionately longer to initialize.

— `code-workbook/environment-creation-overview.md`

### 4.3 Profiles

> A Code Workbook profile is a predefined set of Conda packages and Spark settings that serves as a useful default environment for a use case or group of users.

— `code-workbook/environment-profiles.md`

> Users are unable to customize the Spark settings for a given Code Workbook profile.

— `code-workbook/environment-profiles.md`

> For a given profile, the permissions boundary is the project.

— `code-workbook/environment-profiles.md`

> An Artifacts profile contains a list of requested packages and a list of backing repositories that provide those packages. To use the profile, all backing repositories on the profile must be added as a project import in the workbook's project.

— `code-workbook/environment-profiles.md`

> Note this means that all users of customized Artifacts environments, across all branches in the Workbook, are adding to and using the same list of backing repositories.

— `code-workbook/environment-profiles.md`

The admin sublink names the two **workflows** that gate profile administration —
which is the vocabulary our own access model uses:

> To create a profile, a user must have the `Manage Code Workbook profiles` workflow, which is part of the `Analytical applications administrator` role (or be an enrollment administrator).

— `administration/configure-code-workbook-profiles.md`

> To configure warm module queues, a user must have the "manage" permission on a profile (`Manage Code Workbook profiles` workflow plus being the Owner of the profile) as well as the `Manage Code Workbook warm module queues` workflow, which is part of the `Resource management administrator` role.

— `administration/configure-code-workbook-profiles.md`

> The profile named `default` is the default environment for users in Organizations in the enrollment.

— `administration/configure-code-workbook-profiles.md`

> In the Prewarming tab, you will see options to prewarm Interactive and Batch modules.

— `administration/configure-code-workbook-profiles.md`

### 4.4 Sessions — requested versus resolved, and why pinning takes the resolved one

> A **session** is an instantiation of these settings as part of a Spark module lifecycle or, informally, “what was true about a given Spark module during its lifetime”.

— `code-workbook/session-history-pinning.md`

> It is important to note that a requested environment is non-deterministic, while a resolved environment, by definition, is a permanent solution of a given requested environment. As a result, two identical requested environments may lead to different resolved environments.

— `code-workbook/session-history-pinning.md`

> **sparkModuleRid:** The unique identifier of the Spark module. Given that there is a 1:1 mapping between a module and a session, you will notice that the `sparkModuleRid` and the `sessionId` will share the same unique identifier

— `code-workbook/session-history-pinning.md`

> **moduleLaunchType:** Can either be `WARM_MODULE` or `ON_DEMAND_MODULE`.

— `code-workbook/session-history-pinning.md`

> **Initialization Mode:** The type of Code Workbook initialization to be performed for that session. It can either be `solve`,  `file`, or `docker`.

— `code-workbook/session-history-pinning.md`

> A pinned session will borrow the **resolved** information from a historical session to initialize a fresh module. This is particularly important, because using the same resolved environment guarantees the installed packages to be the same, while using the same requested environment does not.

— `code-workbook/session-history-pinning.md`

Five restrictions on pinning, all stated:

> The current branch of the Workbook will have a pinned session override that will last up to for 24 hours.

— `code-workbook/session-history-pinning.md`

(the typo `up to for` is Palantir's, quoted verbatim)

> Only previously successful sessions can be pinned.

— `code-workbook/session-history-pinning.md`

> Pinned sessions only affect interactive jobs - not build jobs.

— `code-workbook/session-history-pinning.md`

> Only sessions using [Artifacts Profiles](/docs/foundry/administration/configure-code-workbook-profiles/#artifacts-profiles) can be pinned

— `code-workbook/session-history-pinning.md`

> Re-pinning a session will cause a new module to be spun up and all local state on the module will be lost.

— `code-workbook/session-history-pinning.md`

### 4.5 Failure modes

`environment-troubleshooting.md` enumerates exit codes, not just symptoms:

> The first line of the log will read `Execution failed with non-zero exit code:` followed by an integer error code. This error code indicates the specific failure mode.

— `code-workbook/environment-troubleshooting.md`

Code 1 is a resolution error with five named message shapes (package not found,
dependency not found, duplicate package, permission error, package conflict);
Code 137 is out of memory; anything else escalates. The FAQ adds the timeout:

> If the browser tab is inactive for more than 30 minutes, the environment may be lost due to inactivity.

— `code-workbook/faq.md`

---

## 5. Enumerated sets — the pages that LIST rather than describe

Per `CLAUDE.md`'s enumeration rule, these are the sets, with the page that
enumerates each.

**Transform types (3)** — `workbooks-overview.md` and `transforms-overview.md`
agree: Code, Template, Manual entry.

**Languages (3)**:

> Code Workbook currently supports three languages: Python, R, and SQL.

— `code-workbook/workbooks-languages.md`

**Language versions** — Python 3.10 and 3.12; R 3.6, 4.0, 4.1, 4.2; SQL is Spark SQL.

> The currently supported versions of R include R 3.6, R 4.0, R 4.1 and R 4.2.

— `code-workbook/workbooks-languages.md`

**Permitted output types, by language** — the table in
`workbooks-input-output-types.md` is the enumeration:

| Language | Permitted output types |
|---|---|
| Python | Spark dataframe, Pandas dataframe, FoundryObject, None |
| R | R data.frame, FoundryObject, NULL |
| SQL | Spark dataframe |

> If a transform returns any other type than the ones listed above, Code Workbook will return an unsupported type error.

— `code-workbook/workbooks-input-output-types.md`

> Code Workbook will let you run a transform that has a None/NULL return value, but downstream transforms will not accept None/NULL as an input.

— `code-workbook/workbooks-input-output-types.md`

> However, a transform can only have a single output. Multiple outputs are not currently supported.

— `code-workbook/workbooks-input-output-types.md`

**Input types, by language** — note that **two pages disagree on the R list**, and
this is the enumeration conflict of the section (§8.1).

**Default input type per (parent kind × child language)** — `transforms-overview.md`
carries a four-row table keyed on *Import with no schema*, *Import with schema*,
*Import with custom file format, including models*, and *Derived nodes*. The last
row is the interesting one:

> If the output type of the input node is incompatible with the derived node's language, derived nodes will use defaults as defined above for import node types.

— `code-workbook/transforms-overview.md`

And a disclaimer that saves a whole class of misreading:

> Object input types in Code Workbook are custom file formats and are not related to ontology objects.

— `code-workbook/transforms-overview.md`

**Template parameter input types (8)** — Dataset, Column, Text, Number, Select,
Multiselect, Boolean, List:

> **Multiselect:** Allows users to choose any number of values from a pre-defined list of possible values.

— `code-workbook/templates-overview.md`

And the two-level type model behind that list:

> Once a parameter has been added, you must select the parameter type: dataset, column, or variable. If **variable** is selected, you should also select a param type for that variable: text, number, select, multiselect, boolean, or list.

— `code-workbook/templates-overview.md`

**Manual entry column types (4)** — Double, Integer, Boolean, String (§2.5).

**Branch permission levels (4)** — view, edit, maintain, manage (§3).

**moduleLaunchType (2)** — `WARM_MODULE`, `ON_DEMAND_MODULE`.

**Initialization mode (3)** — `solve`, `file`, `docker`.

**Visualization libraries** — Python: Matplotlib, Seaborn, Plotly. R: ggplot2 and plotly.

> In Python, Code Workbook supports visualizations using Matplotlib, Seaborn, and Plotly.

— `code-workbook/transforms-visualize.md`

> In R, Code Workbook supports visualizations using ggplot2 and plotly.

— `code-workbook/transforms-visualize.md`

**Image output format (2)** — PNG default, SVG opt-in, with a per-language opt-in
syntax (`set_output_image_type('svg')` / `@output_image_type('svg')` in Python, an
`# image: svg` comment hint in R).

**Available fonts** — `available-fonts.md` is a bare enumeration of 56 font file
paths, all DejaVu or Noto CJK. This is the only page in the section that is purely
a set.

**Keyboard shortcuts** — `keyboard-shortcuts.md` enumerates 18 macOS and 18 Windows
bindings in four groups (Editor, Execute, Graph, Workbook).

---

## 6. Attested RIDs

The prose carries two, both placeholders, and they are **not the same service**:

> @transform_pandas(
>     Output(rid="ri.foundry.main.dataset.id-1"),
>     dataset=Input(rid="ri.vector.main.dataset.id-2")
> )

— `code-workbook/hidden-repository.md`

The remaining RIDs in this section exist **only inside screenshots**, and are the
richest attested set I have found outside `api/`:

> ri.spark-module-manager.main.spark-module.9d3ef8fd-2841-4386-8f8f-0c9275621c57
> ri.vector.main.profile.default.80b6ad82-bdea-43a8-a936-db00252722d1
> ri.artifacts.repository.artifactory.internal-docker-release
> ri.vector.runtime.artifacts.repository
> — code-workbook/images/workbooks-view-session-history-window.png

> "sparkModuleRid": "ri.spark-module-manager.main.spark-module.8fe59113-2aa3-4e17-88db-ae3bfa4ae075",
> "profileRid": "ri.vector.main.profile.default.c1346225-a10b-4040-a345-586b50046fbf",
> — code-workbook/images/spark_module_id.png

> ri.artifacts.repository.artifactory.external-conda-bioconda
> ri.artifacts.repository.crp.discovered-foundry-ml-python-bundle-mega
> ri.artifacts.repository.artifactory.external-conda-anacondar
> — code-workbook/images/artifacts_import_dialog.png

Three grammar facts fall out of these, and they bear on migration 396 and 488:

1. **The instance segment can be a word, not only a UUID or empty.** `default`,
   `artifactory`, `crp`, `runtime` all sit where our grammar expects an instance.
2. **The locator segment is not always a UUID either.** `internal-docker-release`,
   `external-conda-bioconda` and `discovered-foundry-ml-python-bundle-mega` are
   human-readable names in the final position.
3. `ri.vector.runtime.artifacts.repository` has **five segments and no locator at
   all** — service `vector`, instance `runtime`, type `artifacts`, then
   `repository`. It does not fit the four-part shape.

The profile diff in `workbooks-compare-session-compute.png` shows the *same* RID
with `default` replaced by a UUID in the instance position, which is the strongest
evidence that segment is a namespace and not a type.

---

## 7. What the images add that the prose does not

This section is long because the prose is thin on UI and the screenshots are not.

### 7.1 The node is a state machine with a published badge set

`workbooks-graph.png`, `overview-screenshot.png`, `mnt_workflow.png` and
`branching_pipeline.png` between them show a node header carrying: a **language
badge** (`DATASET`, `PYTHON`, `SQL`, `MANUAL ENTRY`, and template titles such as
`SCATTERPLOT TEMPLATE`), a **green check**, a **warning triangle**, a **clock**, a
**comment bubble with a count**, a **path glyph**, an ellipsis, and an expand
control. The footer carries the alias chip, a column count, a row count, and `+ New`.

The row-count slot has **three distinct published strings** and no page names any
of them:

> 12 columns • Row count disabled
> 12 columns • Unknown row count
> — code-workbook/images/branching_pipeline.png

("Row count not computed" I had filed under this capture too; the adversary
pass found it lives in save-as-dataset-toggle.png and two others, not here.)

`toggle_transformation.png` explains why: the Edit submenu carries **Enable row
count**, so the count is opt-in per node.

`save-as-dataset-toggle.png` supplies the toggle's own tooltip, which is the
clearest one-line statement of §2.2 anywhere:

> When disabled, results of executions will not be saved to a dataset.
> — code-workbook/images/save-as-dataset-toggle.png

and it confirms that a saved node renders **SAVED DATASET** where an unsaved node
renders a bare alias chip, above the blue bar the prose mentions.

### 7.2 Four different bottom-tab sets, by node kind

The prose describes one set. The images show four:

- **Code transform** — Logic, Inputs, Preview, Visualizations, Logs, Description
  (`workbooks-logic-panel.png`, `transforms-add-input.png`).
- **Imported dataset** — Preview, **Branch**, Logs, Description
  (`getting-started-transform-python.png`, `branching-pin-branch.png`).
- **Manual entry** — Manual Entry, Logs, Description, and a **Preview** button
  where a code node has **Run** (`manual-entry-node.png`).
- **Template instance** — the same six as a code node, but the header gains
  **Toggle view** and **Edit template** (`transforms-template.png`,
  `visualization_tab.png`).

The Branch tab on an imported dataset is where §3's fallback is actually chosen:

> IMPORTED DATASET
> Dataset version based on branch:
> Select input branch...
> — code-workbook/images/branching-pin-branch.png

### 7.3 The New transform menu has a fifth entry the prose never names

> Python code
> R code
> SQL code
> Templates
> Visualize
> — code-workbook/images/transforms_new_transform_button.png

**Visualize** carries a submenu arrow and is disabled in that capture. It appears
again, enabled, in `transforms_plus_button.png` and
`getting-started-transform-python.png`. No sentence in the 43 pages mentions a
Visualize transform kind. Either it is a fourth transform type or a shortcut that
creates a code node — the images do not say, and I did not resolve it (§10, Q1).

The same surface has a **second shape** with a different set:

> Select transform type
> Suggested
> Python Code
> SQL Code
> Templates
> — code-workbook/images/suggested-templates.png

Here **Suggested** is first and R is absent (R was not enabled on that workbook).
So the picker is (a) rendered twice, as a dropdown and as a button bar, and (b)
filtered by which languages the profile enables — which matches
`workbooks-languages.md`'s enablement rules exactly.

### 7.4 The graph context menu is conditional, and I found four variants

None of the four is enumerated in prose. Together they give the node action set:

> Add transform
> Start a new path
> Create new template
> Run 1 selected transform
> Edit...
> Actions...
> — code-workbook/images/workbooks-context-menu.png

> Add transform
> Start a new path
> Run 1 selected transform
> Add to Report...
> Download image
> Edit...
> Actions...
> — code-workbook/images/toggle_transformation.png

whose **Edit** submenu is:

> Delete
> Duplicate
> Add to new color group...
> Show table view
> Show description
> Enable row count
> — code-workbook/images/toggle_transformation.png

> Start a new path
> Create new template
> Run 1 selected transform
> Copy node URL
> Copy 1 node to clipboard
> Edit...
> — code-workbook/images/workbooks-duplicate-nodes.png

whose Edit submenu differs again:

> Delete
> Duplicate
> Add to new color group...
> Edit description
> — code-workbook/images/workbooks-duplicate-nodes.png

and multi-select pluralises the run count and disables Edit:

> Add transform
> Start a new path
> Create new template
> Run 3 selected transforms
> Edit...
> — code-workbook/images/creating_multi_node_template.png

**Copy node URL** appears in no sentence in the section. Neither does
**Add to new color group**, though `workbooks-production.md` describes colour
groups without naming the menu item.

### 7.5 The node Actions menu names two operations the prose never mentions

> Add multiple input datasets
> Create template
> Sever parent permissions
> Cache
> — code-workbook/images/creating_a_template_1.png

**Sever parent permissions** appears nowhere in the 43 pages. **Cache** appears
once, in `faq.md`, as a performance tip. On a *template* node the menu is longer:

> Change template version
> Edit template
> Convert to code transform
> Sever parent permissions
> Cache
> — code-workbook/images/edit-template-button.png

**Convert to code transform** is the escape hatch from a template back to code, and
it too is unmentioned in prose.

### 7.6 The settings cog menu, in two lengths

> Update imported dataset previews
> Run all saved datasets
> Project scope settings
> Export to Code Repository Helper
> Explore data lineage
> — code-workbook/images/repository-export-button.png

> Update imported dataset previews
> Run all saved datasets
> Convert Python 2 code to Python 3
> Project scope settings
> Duplicate branch in new workbook
> Open hidden Code Repository
> Export to Code Repository Helper
> Explore data lineage
> — code-workbook/images/open-hidden-repository-button.png

**Convert Python 2 code to Python 3** and **Duplicate branch in new workbook** are
in no sentence in the section. And the labels contradict the prose (§8.3).

### 7.7 The workbook header bar — an unnamed mode selector and a run counter

> Preview merge
> Waiting for Spark
> Editing mode
> Share
> — code-workbook/images/branching-merging-preview.png

**Editing mode** is a dropdown, so there is at least one other mode, and nothing in
the section says what it is. Beside it sits a three-part counter chip — a circular
arrow with a count, a green check with a count, a red cross with a count
(`0 / 39 / 11` in that capture, `0 / 41 / 9` in `repository-export-button.png`,
`1 / 3 / 4` in `repository-view-export.png`). That is the workbook's queued /
succeeded / failed run tally, and no page describes it.

The environment control is the header's status surface and carries at least five
labels: **Waiting for Spark**, **Initializing environment**, **Environment**,
**Environment (pinned)** (`branching_prepare-merge.png`), and **Failed to create
environment** (`environment_error_dialog.png`). Its menu is:

> Profile: default
> View resolved packages
> Restart Spark session
> View session history
> Configure environment
> — code-workbook/images/workbooks-view-session-history-button.png

and it shows the profile name and language inline:

> Environment (default PYTHON3)
> — code-workbook/images/repository-export-button.png

The error dialog also states the inactivity rule the FAQ states, in the product:

> You are using a custom profile. It will take longer to initialize the spark environment. If this browser tab is hidden for over 30 minutes, you may lose your environment due to inactivity.
> — code-workbook/images/environment_error_dialog.png

### 7.8 The Contents pane has a section the prose omits entirely

> Contents
> Edit saved datasets
> Search in workbook...
> Sort by depth
> Python global code
> R global code
> Workbook Inputs
> Add workbook input
> — code-workbook/images/workbooks-interface-with-panes.png

**Workbook Inputs** and **Add workbook input** appear in no sentence in the 43
pages. They also appear in `getting-started-transform-python.png` and
`branching-merging-graph.png`, so they are not a one-off. What a "workbook input"
is — a parameter? a bound dataset? — the images do not say (§10, Q2).

The sort control has **two published modes**: `Sort by depth`
(`workbooks-interface-with-panes.png`) and `Sort by persistence`
(`bulk-persistence-sidebar.png`). The prose says the list is sorted in topological
order and names no control.

The bulk persistence editor is a staged edit with a confirm step, which the prose
does not say:

> 1 change
> Confirm
> Cancel
> Sort by persistence
> Saved as datasets
> Not saved as datasets
> — code-workbook/images/bulk-persistence-sidebar.png

Also visible there: Global Code is docked at the **bottom** as `Python global code`
/ `R global code` tabs, not only on the right rail as `workbooks-overview.md` says.

### 7.9 The merge UI, which is far more specific than the prose

> Go to master
> Merging
> into
> Run Affected
> Ready to merge!
> Exit Merge
> Merge Branch
> — code-workbook/images/branching-merging-graph.png

The Contents pane in merge state annotates every node with a **schema delta**, not
just a Modified tag:

> 7 Columns added
> 5 Columns added
> 3 Columns added
> MODIFIED
> — code-workbook/images/branching-merging-graph.png

The diff panes are titled by branch on the left and by intent on the right:

> master
> Changes in this merge
> — code-workbook/images/branching_merge-diff.png

Inline conflict resolution offers **three** choices, where the prose says only that
you pick which logic to use:

> Accept edits from master | Accept edits from feature/filter-logic | Accept from Both
> — code-workbook/images/branching_conflict-editor.png

Template conflicts resolve differently — each pane gets its own **Accept**
(`branching_conflict-split-screen.png`), and a template diff renders as a
parameter-by-parameter comparison rather than text
(`branching_merge-diff-templates.png`).

The confirm dialog gives the two toggles their real labels and defaults —
copy-data **off**, delete-dataset-branch **on**:

> Are you sure you want to merge
> The branch
> on this workbook will be deleted.
> Copy data from
> Transactions on
> created after
> was created will no longer appear on datasets.
> Delete
> branch on datasets after merging?
> No, go back
> Merge into
> — code-workbook/images/branching-merging-conflict-confirm.png

And the branch menu publishes **per-branch state badges** that no page names:

> BRANCHES
> Create or find branch...
> master
> Last modified 6 minutes ago
> ACTIVE
> test
> Branched from master · Last modified 5 minutes ago
> MERGING
> — code-workbook/images/branching-menu.png

`ACTIVE` and `MERGING` are branch states. Nothing in prose enumerates them, and
there are presumably others.

Branch protection's dialog names the second switch differently from the prose:

> CONFIGURE MASTER
> Protect this branch
> Allow interactive runs
> — code-workbook/images/pipeline-branch-protection.png

and the protected-branch banner is:

> This branch is protected. To make changes, create another branch.
> — code-workbook/images/pipeline-readonly.png

### 7.10 The conversion flowchart carries execution locality, which no sentence does

> Driver only — pandas DataFrame
> Driver + Executors — Spark DataFrame
> Driver only — R data.frame
> structured dataset (Parquet files)
> unstructured dataset
> other files (.csv, .zip, .rds, ...)
> Object (Foundry Model)
> — code-workbook/images/workbooks-languages-conversion-flowchart.png

Two things here are load-bearing and appear in no sentence:

1. **Spark DataFrame is the only hub.** Every conversion routes through it, which
   is why the prose's pandas→R example takes two hops.
2. **`Object (Foundry Model)` has no arrows at all.** It is drawn disconnected. The
   prose never says a model input cannot be converted; the diagram implies it
   (inference, marked).

It also names the on-disk representation — **Parquet** — which the prose of this
section never does, and which `transforms-faq.md` assumes.

The per-input menu is a small enumerated set the prose does not give:

> Spark dataframe
> Reveal in inputs tab
> Select in graph
> Remove this input
> — code-workbook/images/workbooks-languages-py-update-input.png

and the type submenu differs between two eras of the capture — see §8.1.

`changing_input_type.png` adds that the Inputs tab prints a **per-column type row**
(Integer, Integer, Integer, String, String, Double) and labels the control
`Input type:`, neither of which is in prose.

### 7.11 Templates: version numbers, a status, and a commit message

The template editor is a versioned artifact editor, and the prose says only that
edits create a new version.

> Create template
> Title* :
> Description:
> Parameters:
> Highlight variables in the code to create parameters below
> Add new parameter
> Status:
> Released
> Commit Message:
> Description of your change...
> Save as dataset
> Cancel
> Create template
> — code-workbook/images/creating_a_template_2.png

The Status dropdown shows **Released** here and **Unreleased** in
`template_creation_side_by_side_view.png`, which also adds a checkbox the prose
never mentions:

> Status:
> Unreleased
> Save as default version
> Update template
> — code-workbook/images/template_creation_side_by_side_view.png

Instances display the version they are pinned to — `(v0)` in
`use-template-initial-screen.png`, `(v1)` in `mnt_logic_pane_1.png`, `(v3)` in
`transforms-template.png` — so versions are **zero-indexed integers**, not semver.

The substitution syntax is triple-brace, visible in every template capture:

> def bar_chart(&#123;&#123;&#123;titanic_dataset&#125;&#125;&#125;):
> categorical_column = "&#123;&#123;&#123;param1&#125;&#125;&#125;"
> — code-workbook/images/template_creation_side_by_side_view.png

and the global-code append the prose describes is a literal banner in the body:

> ## Global imports and functions included below ##
> # Functions defined here will be available to call in
> # the code for any table.
> — code-workbook/images/template_creation_side_by_side_view.png

A **dataset** parameter carries four fields beyond what prose describes — Type,
**Input type**, an always-use toggle, **Input tags**, Description, and **Group**:

> Type*
> Input type
> Spark dataframe
> Always use "" for this parameter?
> Input tags
> Description
> — code-workbook/images/filter_template.png

A **column** parameter carries a **Column type** dropdown, defaulting to `Any`:

> Type*
> Column
> Source dataset*
> Column type
> Any
> List of columns?
> — code-workbook/images/creating_a_template_4.png

Neither `Input type` on a parameter, nor `Column type`, nor `Group` is described
anywhere in `templates-overview.md`.

The template browser has a full facet set:

> ONLY SHOW
> Catalog items
> Favorites
> STATUS
> Select a status...
> TAGS
> Filter by tag
> PROJECTS
> Filter by project
> IN PATH
> CREATED BY
> — code-workbook/images/search_available_templates.png

and a second, in-graph shape with folder navigation and counts:

> Favorites
> Recent
> All Templates
> TEMPLATE FOLDERS
> — code-workbook/images/template-library.png

`templates-multi-node.md` describes the feature in three sentences and never uses
the product's own noun for it:

> Code Workbook supports multi-node templates for templatized workflows. A template can be created from multiple other templates, and you can bind the values of parameters in these templates together.

— `code-workbook/templates-multi-node.md`

> If you change the value of a shared parameter in the child node pane, the value will also be changed for all instances in the multi-node template.

— `code-workbook/templates-multi-node.md`

> Select `View Group` at the top of the pane. You now see a view highlighting the nodes in the Multi-Node Template, and listing the shared parameters in the template.

— `code-workbook/templates-multi-node.md`

**But in the product they are called Template Groups.** The editor adds
a `Nodes:` list above `Parameters:` with an **Add new node** control:

> Nodes:
> Add new node
> Parameters:
> Add new parameter
> — code-workbook/images/shared-mnt-parameter.png

and the binding dropdown's only option is:

> Create shared parameter
> — code-workbook/images/shared-mnt-parameter.png

while the instance header reads:

> Part of New Template Group , created from
> View Group
> Set Color
> — code-workbook/images/mnt_logic_pane_1.png

and the group view sections are:

> New Template Group
> Return to child node
> NODES
> SHARED PARAMETERS
> — code-workbook/images/mnt_logic_pane_2.png

The prose calls this a *multi-node template* throughout and never says
**Template Group**. Per-node **Output tags** live on the node row in the editor
(`mnt-output-tags.png`), matching `templates-suggested.md`.

### 7.12 Data Lineage sees the workbook as two dataset kinds and a code blob

`workbook-in-data-lineage-2.png` is the visual proof of the §2.2 claim, and it
carries a resource-type legend the prose does not:

> Uploaded Dataset (1)
> Code Workbook Dataset (1)
> View in code workbook
> — code-workbook/images/workbook-in-data-lineage-2.png

The unsaved node `selection` is **absent as a node**, and its code is prepended to
`limiting`'s, exactly as the prose says. The Code panel sits beside **Preview** and
**History** tabs.

`build_datasets.png` gives the build strategy set:

> Builds
> Select a build strategy
> Selected dataset(s) only
> All transforms in between selected dataset(s)
> All ancestor datasets
> Next (View preview)
> — code-workbook/images/build_datasets.png

and `workbooks-build-schedules.png` gives the schedule trigger set and the
schedule-colouring legend:

> When to build
> When specific dataset(s) update
> At a specific time
> When multiple time or event conditions are met
> — code-workbook/images/workbooks-build-schedules.png

> Will attempt build (0)
> Excluded dataset (0)
> Unbuilt dataset (1)
> Target dataset (2)
> Trigger dataset (0)
> — code-workbook/images/workbooks-build-schedules.png

### 7.13 The build details pane publishes a job-state vocabulary that is neither of ours

`details_button.png` is the single most consequential image in the section for this
repo. It shows a Gantt legend:

> Received by worker
> Queueing in Code workbook
> Running in Code workbook
> Starting
> Finishing
> — code-workbook/images/details_button.png

and, per job, a five-step timeline:

> Started job
> Received by code workbook worker
> Queued in code workbook
> Ran in code workbook
> Succeeded
> — code-workbook/images/details_button.png

plus the build-level record:

> Build info
> Status
> Duration
> Estimated
> Started
> Ended
> Started by
> Progress
> Build ID
> Job type: Vector write
> — code-workbook/images/details_button.png

and the detail popover:

> This job is assigned to an initialized Spark module and is running.
> isInteractive: true
> — code-workbook/images/details_pane.png

**`Job type: Vector write` is the job kind Code Workbook emits.** `Estimated` and
`Typically 1m 29s` are a per-dataset duration forecast, which nothing in prose
mentions. This is a **third** vocabulary alongside the two in `CLAUDE.md`'s table:
the Ontology Manager's job tokens, the public API's, and now Code Workbook's own
worker stages.

### 7.14 Session history is a JSON document with named fields

`spark_module_id.png` shows the compute record is a **tagged union**:

> "moduleAssignmentInfo": {
> "sessionType": {
> "type": "interactive",
> "interactive": {
> "userId":
> — code-workbook/images/spark_module_id.png

and `workbooks-compare-session-compute.png` gives the resource block verbatim:

> "isCustomEnv": true,
> "jarDependencies": [],
> "moduleLaunchType": "ON_DEMAND_MODULE",
> "moduleResources": {
> "type": "staticAllocation",
> "staticAllocation": {
> "driverCores": 1,
> "driverMemoryInMib": 4096,
> "gpuResources": null,
> "executorCores": 0.6,
> "executorMemoryInMib": 4096,
> "executorInstances": 2
> — code-workbook/images/workbooks-compare-session-compute.png

`moduleResources` is itself a tagged union on `type`, with `staticAllocation` as
one member — the same discriminator pattern the `api/` section uses, which is
useful corroboration that Foundry's internal wire format and its public one agree
on shape.

The resolved-environment view is `name=version=buildstring`:

> python=3.8.15=h257c98d_0_cpython
> — code-workbook/images/workbooks-compare-session-resolved.png

and the resolved dialog counts both tiers with a **Build string** column that no
sentence mentions:

> 218 TOTAL DEPENDENCIES
> 12 DIRECT DEPENDENCIES
> Version
> Build string
> 206 TRANSITIVE DEPENDENCIES
> — code-workbook/images/environment-view-resolved.png

`environment-overview-profile.png` names five profiles, and the prose names none:

> SELECT PROFILE
> default
> no-conda-docker
> python3
> graphframes
> interactive-conda-docker
> Customize Profile
> AUTOMATIC
> Spark module ID:
> Update Spark environment
> — code-workbook/images/environment-overview-profile.png

`AUTOMATIC` is the version sentinel the prose mentions once in
`environment-overview.md`; here it is shown as the per-package default.

### 7.15 Project scoping is a dialog with a stated blast radius

> Project scope settings
> Enabled
> All inputs and outputs in this workbook need to be part of the workbook's project scope. To enforce this requirement, please resolve all of the issues below.
> IMPORTED DATASETS
> OUTPUT DATASETS
> TEMPLATES
> Add all references
> Add reference
> — code-workbook/images/psj-dialog-enabled.png

> Disabled
> Once project scoping is enabled, builds will fail if any inputs or outputs are outside of the project scope, and the job token will no longer have permissions to make external service calls.
> None of the outputs are outside of the workbook's project.
> None of the templates are outside of the workbook's project scope.
> Enable
> — code-workbook/images/psj-dialog-disabled.png

Three scoped resource classes, not two: datasets in, datasets out, **and templates**.

`add-reference-project.png` shows the Projects app rail that hosts the other half:

> Preview
> Visible to others
> Cover page
> Project workspace
> Members only
> Files
> Autosaved
> Project Catalog
> References
> File references
> External references
> Trash
> Inference
> — code-workbook/images/add-reference-project.png

### 7.16 Export to Code Repository, in its generated form

The export panel's own text is stricter than the prose (§8.2):

> Select datasets from this workbook to export to a code repository through a pull request.
> An export must include a connected set of Python datasets. Selection of a node will select all valid upstream nodes, and deselection will deselect all valid downstream nodes.
> — code-workbook/images/repository-selection.png

> This is a one-time action that will create new datasets in the code repository. Additional edits to this workbook will not automatically export to the code repository.
> Create pull request
> — code-workbook/images/repository-select-nodes.png

The generated repository shape is visible, and it is exactly our job-spec model:

> transforms-python/src/codeWorkbookExport/__init__.py
> transforms-python/src/codeWorkbookExport/global_code.py
> transforms-python/src/codeWorkbookExport/pandas_1.py
> — code-workbook/images/repository-view-export.png

> # Global imports
> from codeWorkbookExport.global_code import *
> # Local imports
> from transforms.api import transform, Input, Output
> — code-workbook/images/repository-view-export.png

> # Imports from vector export
> import codeWorkbookExport
> my_pipeline.discover_transforms(codeWorkbookExport)
> — code-workbook/images/repository-view-pipeline.png

> # Imported to match Vector environment
> — code-workbook/images/repository-view-packages.png

Global code becomes a module and is star-imported into every generated transform —
which is exactly the semantics `workbooks-global-code.md` describes, expressed in
Python. The generated wrapper is a `@transform` function named `<alias>_transform`
that calls the workbook's own `<alias>` function, so the workbook function survives
the export unchanged.

### 7.17 Notepad embedding is a three-part reference

> WIDGET PROPERTIES
> Code workbook
> Change
> Board
> Branch
> — code-workbook/images/present-visualizations-notepad.png

> SOURCE
> Lock data
> — code-workbook/images/present-visualizations-notepad.png

The embed is **(workbook, board, branch)** — and the field is called **Board**,
Contour's noun, for what Code Workbook calls a transform. The `notepad/` section is
not mirrored, so this screenshot is the only description of the contract we have.

### 7.18 Visualizations get a full-screen viewer with a gallery

> Visualization
> Add a comment
> Download image
> Add to report
> Expand gallery
> — code-workbook/images/transforms-visualize-py-plotly.png

**Expand gallery** implies a workbook-wide visualization index, which no page
mentions. The Plotly modebar is present, confirming the prose's claim that
in-graph Plotly is interactive while console Plotly is not.

### 7.19 Colour groups are named and counted

> COLOR GROUPS
> Create color group
> — code-workbook/images/node_coloring.png

The panel lists group names with member counts. `graph_autolayout.png` gives the
layout menu with its two entries and their shortcuts, matching
`keyboard-shortcuts.md`:

> LAYOUT GRAPH NODES
> Layout all nodes
> Layout 3 selected nodes
> — code-workbook/images/graph_autolayout.png

Notably the shortcuts page also lists a *layout by colour group* binding that this
menu does not offer.

### 7.20 A graph tool that exists in no sentence

`branching-merging-graph.png` shows a **fourth** graph tool button, left of
Pan/Select, labelled **Object Links** with a cube glyph. It appears in no other
capture and in no sentence in the 43 pages. I did not resolve what it does (§10, Q3).

### 7.21 The Paths view has more structure than the prose says

> Filtering Addresses by City
> Deep dive into Cleveland
> TRANSFORMATION PATHS
> CODE TRANSFORM
> Add input dataset
> Collapse code
> Dataset preview
> Description
> GLOBAL CODE
> — code-workbook/images/paths_1.png

A path has a **title and a subtitle/description**, a transform count, and its own
per-step input-adding affordance. The prose says only that Paths is an alternate
linear mode.

### 7.22 Images that add nothing beyond the prose

Named here so the coverage claim is honest rather than padded — I opened each and
it is a plain screenshot of something a sentence already says:
`transforms-names.png`, `manual-entry-button.png`, `workbooks-global-code.png`,
`workbooks-passengers-by-bracket.png`, `template-bar-chart.png`,
`plot_with_korean_and_japanese_fonts.png`, `transforms-visualize-r-plotly.png`,
`branching_code-changes.png`, `branching_create-branch.png`,
`branching_merge-sidebar.png`, `branching_run-affected.png`, `branching_merge.png`,
`branching_merge-conflict.png`, `branching-merging-conflict.png`,
`branching_prepare-merge.png`, `pipeline-branch-menu.png`,
`pipeline-folder-management.png`, `pipeline-move-datasets.png`,
`environments_initialization.png`, `environments_specfiles.png`,
`environments_conda_docker.png`, `environments_conda_docker_toggle.png`,
`environment-view-tree.png`, `environment-overview-profile-customize.png`,
`op-diagram-1.png`, `op-diagram-2.png`, `op-diagram-3.png`,
`workbook-in-data-lineage-1.png`, `workbooks-copy-node-to-clipboard.png`,
`workbooks-duplicate-nodes-select-tool.png`, `code-workbooks-cache.png`,
`console-add-to-graph.png`, `getting-started-python-console.png`,
`workbooks-console-overview.png`, `workbooks-console-input-type.png`,
`configure-input-tags.png`, `add-tags-dataset-app.png`,
`repository-view-button.png`, `python-transform-input.png`,
`select-r-transform-input.png`, `logs_tab.png`, `visualization_tab.png`,
`transforms-visualization.png`, `workbooks-open-path-from-graph.png`,
`path_graph_interaction.png`, `workbooks-full-screen-editor.png`,
`workbooks-open-full-screen-editor.png`, `overview-screenshot.png`,
`mnt_workflow.png`, `mnt_workflow_new_instance.png`, `add-new-mnt-titanic.png`,
`filter_then_histogram.png`, `scatterplot_template.png`,
`creating_a_template_3.png`, `template-persistence.png`,
`template_creation_highlight_parameter.png`, `pipeline-data-health.png`,
`artifacts_import_dialog.png`, `spark_module_id.png`,
`workbooks-compare-session-requested.png`, `gear-icon.png`,
`workbooks-expand-icon.png`, `workbooks-collapse-icon.png`,
`workbooks-open-transform-in-graph-icon.png`, `manual-entry-node.png`,
`branching_data-independence.png`, `branching_conflict-split-screen.png`,
`branching_merge-diff.png`, `branching_merge-diff-templates.png`,
`branching_conflict-editor.png`, `branching-merging-conflict-code.png`,
`workbooks-languages-update-input.png`,
`workbooks-languages-r-update-inputs.png`, `suggested-templates.png`,
`mnt-output-tags.png`, `use-template-initial-screen.png`,
`transforms_plus_button.png`, `getting-started-transform-python.png`,
`transforms-add-input.png`, `workbooks-logic-panel.png`, `workbooks-graph.png`,
`repository-export-button.png`, `repository-view-export.png`,
`repository-view-pipeline.png`, `repository-view-packages.png`,
`open-hidden-repository-button.png`, `psj-dialog-enabled.png`,
`psj-dialog-disabled.png`, `add-reference-project.png`,
`workbooks-view-session-history-button.png`,
`workbooks-view-session-history-window.png`,
`workbooks-compare-session-compute.png`,
`workbooks-compare-session-resolved.png`, `environment-view-resolved.png`,
`environment_error_dialog.png`, `environment-overview-profile.png`,
`details_button.png`, `details_pane.png`, `build_datasets.png`,
`workbooks-build-schedules.png`, `search_available_templates.png`,
`template-library.png`, `template_creation_side_by_side_view.png`,
`creating_a_template_1.png`, `creating_a_template_2.png`,
`creating_a_template_4.png`, `filter_template.png`, `shared-mnt-parameter.png`,
`mnt_logic_pane_1.png`, `mnt_logic_pane_2.png`,
`creating_multi_node_template.png`, `edit-template-button.png`,
`transforms-template.png`, `node_coloring.png`, `graph_autolayout.png`,
`bulk-persistence-sidebar.png`, `save-as-dataset-toggle.png`,
`changing_input_type.png`, `workbooks-languages-conversion-flowchart.png`,
`workbooks-languages-py-update-input.png`, `workbooks-interface-with-panes.png`,
`workbooks-context-menu.png`, `toggle_transformation.png`,
`workbooks-duplicate-nodes.png`, `branching-menu.png`,
`branching-pin-branch.png`, `branching-merging-preview.png`,
`branching-merging-graph.png`, `branching-merging-conflict-confirm.png`,
`pipeline-branch-protection.png`, `pipeline-readonly.png`, `paths_1.png`,
`workbook-in-data-lineage-2.png`, `present-visualizations-notepad.png`,
`transforms-visualize-py-plotly.png`, `repository-selection.png`,
`repository-select-nodes.png`, `transforms_new_transform_button.png`.

(That trailing list holds 138 of the 139 files — `branching_pipeline.png` is
named in §7.1 instead, so every file is named somewhere in this reading, but
the block that claimed completeness was off by one (caught by the adversary
pass; CLAUDE.md rule 7 exists because this exact assertion has now been false
three times). The coverage claim in the header is countable. The first paragraph of this
subsection names only the ones that genuinely added nothing.)

---

## 8. Contradictions I found, in the section and against the corpus

### 8.1 The R input-type list disagrees with itself

`workbooks-input-output-types.md` lists R input types as **Spark dataframe, R
data.frame (default), R transform input, Object**.
`transforms-overview.md`'s table lists them as **Spark dataframe, R transform
input, R data.frame, Object** — same members, different order, and only the first
page marks a default.

Worse, the *screenshots* disagree on the **label**. The prose calls them
`Python transform input` and `R transform input`; the menu in
`workbooks-languages-py-update-input.png` calls it plain **Transform input** with a
Python glyph, while `python-transform-input.png` calls it **Python transform
input**. Two eras of one menu. Applying `CLAUDE.md`'s enumeration rule: the page
that LISTS the set is `workbooks-input-output-types.md`, so its spelling and its
membership win, and `transforms-overview.md`'s ordering is a restatement.

### 8.2 The export page says Python **and SQL**; the export dialog says Python only

> Python and SQL code can be exported from a Code Workbook to a Code Repository.

— `code-workbook/code-repositories-export.md`

> Currently, only SQL nodes or Python code nodes with Pandas or Spark dataframe inputs and outputs are supported.

— `code-workbook/code-repositories-export.md`

The dialog in `repository-selection.png` says an export must be a connected set of
**Python** datasets, with no mention of SQL. I did not resolve this (§10, Q4). Note
the prose also expects SQL to be handled by a *subproject*:

> For example, if you export both SQL and Python nodes, you may need to add a new subproject to your SQL-only or Python-only repository.

— `code-workbook/code-repositories-export.md`

### 8.3 Menu labels do not match the prose that describes them

- `transforms-overview.md` says to select **Run all transforms** from the cog; the
  cog menu says **Run all saved datasets** (`repository-export-button.png`). Given
  §2.2 those are not the same operation.
- `faq.md` says **Update table preview**; the menu says
  **Update imported dataset previews**.
- `branching-overview.md` phrases the second branch setting as
  *Does the branch allow running?*; the dialog calls it
  **Allow interactive runs** (`pipeline-branch-protection.png`).
- `environment-overview.md` says the wait state reads *Waiting for resources*; the
  three environment diagrams and the merge header all show **Waiting for Spark**.
- `code-repositories-export.md` twice says `meta.yml`; the diff in
  `repository-view-packages.png` is of `transforms-python/conda_recipe/meta.yaml`.
  `code-repositories/anaconda.md` uses `meta.yaml` throughout, so the export page
  is the outlier.

### 8.4 `transforms-faq.md` is filed under Code Workbook and is about Code Repositories

Every answer on that page uses `from transforms.api import transform, Input,
Output`, Java `FoundryOutput`, `@transforms_df`, and `Pipeline()` — Code
Repositories syntax. Its second question is:

> Can I build multiple output datasets from one Python transform?

— `code-workbook/transforms-faq.md`

and it answers yes, while the sibling page in the same section says:

> Multiple outputs are not currently supported.

— `code-workbook/workbooks-input-output-types.md`

and the comparison table says Code Workbook does not support multi-output
transforms. **`transforms-faq.md` is not about Code Workbook** and should not be
read as such. It appears to be a shared FAQ mounted under this slug.

### 8.5 The Global Code pane's location

`workbooks-overview.md` and `workbooks-global-code.md` both place Global Code on
the right-hand side. `bulk-persistence-sidebar.png`, `template-library.png`,
`repository-select-nodes.png` and `transforms-visualize-r-plotly.png` all show it
docked at the **bottom** as two language tabs. Both placements are real; the prose
names only one.

### 8.6 Corroboration, not contradiction, from outside the section

`linter/rules.md` confirms that Code Workbook output datasets carry a job spec,
which is what `code-repositories-export.md` tells you to delete:

> **Logic:** The dataset has a Code Workbook JobSpec.

— `linter/rules.md`

> **Why:** Datasets in production and scheduled datasets should not be built in Code Workbook where possible; instead, they should be migrated to an application designed for in-production pipeline building such as Pipeline Builder or Code Repositories.

— `linter/rules.md`

`checkpoints/checkpoint-types.md` names a checkpoint scoped to the product:

> Code Workbook build | Building in a [Code Workbook](/docs/foundry/code-workbook/overview/). | Code Workbook

— `checkpoints/checkpoint-types.md`

`data-lineage/node-coloring.md` confirms the legend in §7.12 is a general lineage
feature, not a Code Workbook one:

> Colors the nodes based on the code repository used to create them. You can either color the nodes by the name of the repository, or by its type (e.g. Code Repository, Code Workbook).

— `data-lineage/node-coloring.md`

---

## 9. Where this depends on runtimes we do not have

This platform is TypeScript + Postgres + a QuickJS/WASM function isolate (501-502).
Code Workbook is Spark, Conda, Python and R end to end. These are **recorded
divergences, not gaps to invent around**:

1. **Spark is the execution substrate, not an implementation detail.** A workbook
   *is* a Spark module: the environment installs onto it, sessions are its
   lifecycle, the run counter counts its jobs, and the conversion flowchart is
   organised around driver-versus-executor locality. Nothing in Postgres
   corresponds to a driver.
2. **Conda/Mamba dependency solving** — the solve step, spec files, Conda Docker,
   the warm module queue and every troubleshooting code exist because packages are
   resolved by a SAT solver at session start. Our isolate has declared imports
   enforced at publish time (501), which is a different mechanism with a different
   failure surface.
3. **Python and R execution, and their libraries** — pandas, PySpark, SparkR,
   Matplotlib, Seaborn, Plotly, ggplot2, r-arrow. `r-filesystem.md` and
   `transforms-unstructured.md` are entirely API surface for these runtimes.
4. **The FileSystem / TransformInput / TransformOutput APIs** operate on
   FoundryFS blobs inside a dataset. Our dataset layer (393) models files and views
   but has no in-transform file handle.
5. **Spark SQL is not Postgres SQL.** `SELECT max(Age) AS max_age FROM
   titanic_filtered` happens to be portable; `CREATE TABLE '/path' USING CSV AS
   SELECT` is not.
6. **Java** appears in `transforms-faq.md`. `CLAUDE.md` rules it out by name.

The consequence for a build: **the parts of Code Workbook worth copying are the
parts that are not Spark** — the persistence toggle, the alias namespace, the
branch-with-data model, the template abstraction, and the session record. Those are
graph and ledger concerns and port cleanly. Anything that needs a driver does not.

---

## 10. Connects to what we already have

- **Datasets, transactions, views (391-396).** `faq.md`'s *atomic unit of
  artifacts* sentence is the strongest statement in the mirror of why our dataset
  wrapper exists. The merge-branch form `vector-merge-{source}-{target}-{uuid}`
  and the transaction-copy toggle are transaction-level operations our branch
  overlay (461-471) does not have an equivalent for.
- **Builds and schedules (493-496).** `details_button.png` gives a build record
  with `Status`, `Duration`, `Estimated`, `Started`, `Ended`, `Started by`,
  `Progress`, `Build ID` — a close match to our ledger — plus a per-job stage
  vocabulary that is a *third* spelling beside the two in `CLAUDE.md`'s table. The
  build-strategy radio set and the three schedule triggers line up with 495's
  trigger grammar.
- **Functions in isolates (501-502).** The closest analogue to a Code Workbook
  transform we have. Both are versioned code with declared inputs; the difference
  is that a function returns a value to a caller and a transform's *return value is
  a dataset*.
- **Code Repositories (690-692), where `692_a_transform_file_is_a_job_spec`
  already names the concept.** `code-repositories-export.md` is the round trip: it
  generates transform files, and it tells you to delete the workbook's job spec so
  the repository can own the dataset. `linter/rules.md` confirms the job spec is
  the ownership marker. Our 692 is the same idea from the other end.
- **Models and objectives (699-702).** `Object` is a Code Workbook input type
  meaning a Foundry Model, and `transforms-overview.md` says model-returning
  transforms are written to Foundry as models. That is the adapter seam 699
  describes, reached from an analysis tool rather than a repository.
- **Compass (497-500) and the access model (557-560).** `faq.md`'s four branch
  permission levels expanding from `compass:read` / `compass:edit` /
  `compass:manage` is a published example of the operation-expansion model, and
  `administration/configure-code-workbook-profiles.md` names two more entries for
  the workflow catalogue we do not yet have: `Manage Code Workbook profiles` and
  `Manage Code Workbook warm module queues`, in the `Analytical applications
  administrator` and `Resource management administrator` roles.
- **Data Lineage reading.** `workbook-in-data-lineage-2.png` shows unsaved nodes
  are not lineage nodes, which constrains any lineage graph we build over a
  transform DAG.
- **Health checks.** `pipeline-data-health.png` shows a check carries a rule name
  and a severity in parentheses (`Column unique (moderate)`) and a watch setting.

---

## 13. Corrected BEFORE building — the adversary pass

A foundry-adversary pass ran before any migration was written: all 117
attributed prose quotations byte-exact, image accounting structurally sound,
the branch semantics confirmed — and twenty-four findings, of which these
change or complete the build's shape:

**A workbook holds a FOURTH input class, and my "I grepped and found
nothing" was false.** `time-series/foundryts.md` documents Workbook Inputs:

> Any queried object types (accessed by time series properties) or time series catalog syncs (accessed by series ID or a search query) must be added as workbook inputs from the left **Contents** panel.

— `time-series/foundryts.md`

So a Workbook Input is a non-dataset input — an ontology OBJECT TYPE or a
time-series catalog sync — registered at workbook scope. We have object
types; catalog syncs are recorded unbuilt. This also weakens Q3's premise:
"Object input types … are not related to ontology objects" is about custom
file formats, a different sense of the word.

**Unsave and re-save is a documented state machine**, one line below the
sentence I quoted:

> If you choose to change a transform from not saved to saved, it will re-link to its previous saved dataset. If a previous saved dataset does not exist, a new dataset will be created.

— `code-workbook/optional-data-persistence.md`

So persistence is a TOGGLE beside a persistent dataset link — re-link or
create, never a second dataset.

**A save validates the schema**, in the sentence's unquoted second half and
a whole FAQ section (`## Failed to save as dataset`): at least one column,
valid column names, no duplicates.

**Every workbook is backed by a hidden, read-only code repository** — the
page I had read only for a RID placeholder:

> every workbook is backed by a special hidden code repository. This repository serves as a secure backup of the code written in a code workbook while also exposing the history of all code changes made on the workbook.

— `code-workbook/hidden-repository.md`

> Every code change made on a workbook branch automatically creates a new commit to the corresponding branch in the hidden code repository.

— `code-workbook/hidden-repository.md`

with three per-language files (`pipeline.py`, `pipeline.R`, `pipeline.sql`)
plus a `workbook.yml`. We built code repositories in 690 — this is a real
integration, not a note. It also resolves an intra-corpus contradiction my
§8 missed: faq.md says intermediate-transform code "cannot be recovered"
while this page calls the hidden repo "the recommended way to restore code
that was lost".

**Templates pin and prompt, never auto-upgrade** — the sentence that defines
the mechanism, which I paraphrased down to its first clause:

> The version history of templates is saved, and new edits to a template are always saved as a new version of that template. Edits to a template do not automatically update instances of that template; each instance of the template will include a prompt to update to the latest version if they are using an outdated version of the template.

— `code-workbook/templates-overview.md`

A template also carries a PERSISTENCE DEFAULT ("By checking the **Save as
dataset** box, when added the template will be added as a persisted
transform by default" — `code-workbook/templates-getting-started.md`), is a
Compass resource in a FOLDER whose promotion is a move ("you can save a
Template in your home folder while you are still working on it, and move it
to a shared folder once you want to promote it"), appends its home
workbook's global functions at creation and has no access to global code
where applied. My earlier claim that the always-use toggle goes beyond
prose was wrong — prose states it twice.

**master is special**: "Project scoping can only be enabled on the master
branch" (`code-workbook/project-references.md`) — and scoping, once on, has
no UI off-switch. The scoped classes are FOUR with Workbook Inputs, not my
three.

**A protected branch's documented DEFAULT is no running**:

> By default, a protected branch does not allow any user to use the Run button on that branch to compute output datasets.

— `code-workbook/workbooks-production.md`

And batch builds recompute unpersisted logic without updating previews —
the other half of optional persistence I had not carried. The
Owner-vs-maintain/manage wording across three pages is the two-vocabularies
rule: prose speaks roles, the faq speaks the internal permission tokens,
one mechanism.

**The input-type enumeration carries a persistence qualifier I dropped**:
Python/R "transform input" types are "only available on inputs 'saved as
dataset'" — a cross-product of the two headline features, and the reason
the export page excludes those inputs.

**Smaller corrections, recorded:** Preview-vs-Run follows the persistence
toggle, not the node kind; SQL references a parent ALIAS AS A TABLE NAME
("The dataframe can be read within SQL as a table") and a transform "can
have any amount of inputs"; §8.2/Q4 dissolve — the export page states SQL
support three times and the dialog string is the connectedness rule; the
conversion flowchart has a second hub (`transform input (Python or R)`);
"SAVED DATASET" in §7.1 is a dataset NAME, the real rule being the
two-names-per-persisted-node sentence; §7.17's "only description" is false
(two prose pages describe the Notepad/Reports embed, where "board" is the
embedding noun); "Sever parent permissions" is DEPRECATED severing per
building-pipelines/remove-markings — copied nowhere; §7.13's "third
vocabulary" is the api's Succeeded plus a per-job STAGE vocabulary;
`api/` attests `CODE_WORKBOOK` as a first-class resourceType and
`CODE_WORKBOOK_BUILD` as a checkpoint record type (Q8 answered);
Matplotlib's parallel-node execution and the 20,000-point Plotly limit;
Run Affected is defined in prose; and code-products-comparison (the
section's largest page) contributes "does not support incremental
computation, transform generation, or multi-output transforms" to the
divergence ledger.

## Decisions I had to make

1. **I read `Legacy` as *not* Sunset, and said so explicitly**, because the task
   asked either way and because the two are separate rows of one published table
   with different availability. Quote, not inference.
2. **I treated `code-workbook/transforms-faq.md` as not being about Code
   Workbook** (§8.4). It is filed in the section but every example is Code
   Repositories syntax and it directly contradicts two sibling pages on
   multi-output. I did not use it as evidence for anything about Code Workbook.
   This is my judgement, not a statement the page makes.
3. **Where the prose and a screenshot disagree on a label, I recorded both and
   picked neither** (§8.3). I did not "resolve" `Run all transforms` versus
   `Run all saved datasets`; given §2.2 they are plausibly different operations and
   choosing one would be inventing.
4. **For the R input-type set I applied the enumeration rule and let
   `workbooks-input-output-types.md` win** over `transforms-overview.md`, because
   the former is the page whose whole job is the list. This is a rule application,
   not a Foundry statement.
5. **I called `Object (Foundry Model)`'s isolation in the flowchart an inference.**
   The box is drawn with no arrows; no sentence says a model input cannot be
   converted. I marked it as what the diagram implies.
6. **I did not propose a schema.** A faithful shape-on-Postgres build of this
   section would need, at minimum: a `workbooks` resource with a RID; a
   `workbook_branches` table carrying parent, protection and allow-interactive-runs;
   a `workbook_transforms` table carrying (branch, alias, language, kind, code,
   `saved_as_dataset`, optional `dataset_id`); a `workbook_transform_inputs` join
   carrying the per-input type; and a `workbook_templates` table with integer
   versions, a status and parameters. **Foundry publishes none of these table
   names** — I am naming them so a builder can see the shape I read, and every one
   of them is my invention, not a citation. The three parts I would *not* invent
   are: the alias is workbook-local and mergeable across branches (quoted), a
   transform has exactly one output (quoted), and an unsaved transform is not a
   resource (quoted).
7. **I proposed nothing for Spark.** §9 is written as divergences rather than as a
   port, deliberately. Where a Code Workbook feature exists only because there is a
   driver — the conversion matrix, driver memory profiles, module queues — I
   recorded it and did not suggest a Postgres analogue, because there is not one
   and inventing one is how a half-built foundation gets started.
8. **I quoted the typo `up to for 24 hours` verbatim** rather than silently
   correcting it, since the checker compares byte-for-byte after normalisation and
   a "corrected" quote would be a false citation.
9. **I listed the complete 139-file manifest inside §7.22** rather than a separate
   appendix, so the header's coverage claim is mechanically checkable in one place
   and the honest subset ("added nothing") stays visibly smaller than the total.

## Questions I could not answer

**Q1 — What is `Visualize` in the New transform menu?** `blocks: nothing`
It sits as a fifth entry with a submenu arrow in `transforms_new_transform_button.png`,
`transforms_plus_button.png` and `getting-started-transform-python.png`. I grepped
the section for `Visualize` and every hit is the *Visualizations* tab or the
`transforms-visualize` page, neither of which is a transform kind. If it is a
fourth transform type, the "three types of transforms" enumeration is wrong.

**Q2 — What is a `Workbook Input`?** `blocks: nothing`
`Workbook Inputs` / `Add workbook input` appears in three screenshots and zero
sentences. I grepped the section and the whole mirror for the phrase and found
nothing. It could be a workbook-level parameter (which would make templates and
workbooks the same idea at different scopes) or a pinned import list. I did not guess.

**Q3 — What is the `Object Links` graph tool?** `blocks: nothing`
One capture only, `branching-merging-graph.png`, top-right beside Pan/Select. It
suggests Code Workbook can see ontology object links, which would contradict
`transforms-overview.md`'s statement that Object inputs are *not related to
ontology objects*. I searched the section for `Object Links` and found nothing.

**Q4 — Can SQL nodes actually be exported to a Code Repository?** `blocks: nothing`
The page says yes twice; the dialog says Python. I have no third source — the
`code-repositories/` section is mirrored but I found no page describing the import
side of a workbook export.

**Q5 — What is the full set of template `Status` values?** `blocks: nothing`
I have two attested: `Unreleased` and `Released`. It is a dropdown, so there are
plausibly more. `templates-overview.md` never mentions status at all. If a build
ever models template status, this set is not enumerated anywhere I could find.

**Q6 — What is the full set of branch state badges?** `blocks: nothing`
`ACTIVE` and `MERGING` are attested in `branching-menu.png`. `branching-overview.md`
describes protection and merging but names no state vocabulary. A protected branch
presumably shows something; I have no capture of it.

**Q7 — What are the modes in the header's `Editing mode` dropdown?**
`blocks: nothing`
Attested once, in `branching-merging-preview.png`. A read-only or presentation mode
would be the obvious guess and I am not making it. Related: `pipeline-readonly.png`
shows a protected branch greying the toolbar, which may be the same mechanism.

**Q8 — What is the wire shape of a Code Workbook resource in `api/`?**
`blocks: nothing`
I did not search `api/` for a Code Workbook endpoint. `CLAUDE.md` says `api/`
settles shape questions the prose cannot, and given this is a Legacy product there
may simply be no public API. Worth one grep before anyone builds from §Decisions 6.

**Q9 — Does `Group` on a template parameter mean the multi-node group?**
`blocks: nothing`
The field appears in `filter_template.png`, `scatterplot_template.png` and
`configure-input-tags.png` as an empty clearable dropdown on a *single*-node
template's dataset parameter. `templates-multi-node.md` describes shared parameters
but never uses the word Group for a parameter attribute. It may be the same
mechanism seen from the child side, or a display grouping. I did not decide.

**Q10 — What does the Notepad widget's `Lock data` do?** `blocks: nothing`
Attested only in `present-visualizations-notepad.png`. `present-visualizations.md`
says nothing about it and `notepad/` is not mirrored, so I have no second source.
Re-mirroring `notepad/` would settle Q10 and the §7.17 contract together.
