# Reading — Data Lineage

Read because two features are blocked on a `derived from` edge — the data half of
markings, and Data Lifetime — and because the operator's screenshot showed object
types sitting in the same graph as datasets.

Pages read in full:
- `mirror/data-lineage/overview.md`, `elements-reference.md`, `navigation.md`
- `mirror/data-lineage/explore-lineage.md`, `node-coloring.md`
- `mirror/data-lineage/see-impact-marking-changes.md` — **the reason for the reading**
- `mirror/data-lineage/check-permissions.md`, `explore-artifacts.md`
- `mirror/data-lineage/stale-datasets.md`, `find-column.md`, `build-timeline.md`,
  `dataset-preview-logic.md`

Images read closely:
- `images/data-lineage-ui-reference.png` — the numbered app layout
- `images/marking-simulation-analyze.png` — **the most valuable image in the section**

---

## What it is

> "**Data Lineage** is an interactive tool that facilitates a holistic view of how
> data flows through the Foundry platform."

Three stated jobs: find datasets (by "Project, table, and column names"), explore
pipelines ("Expand or hide ancestors and descendants", "Visualize your pipeline
through coloring", "Drill into details… its schema, when it was last built, and
the code that generated the data"), and collaborate ("Create pipeline snapshots").

## The graph is not dataset-only — four node types

`elements-reference` gives the whole vocabulary, and **object types are first-class
nodes**:

| node | quoted |
|---|---|
| **Data source** | "the name of the data source as it appears in Data Connection" |
| **Dataset** | "Foundry datasets and the lineage between them… **Dashed border indicates unstructured datasets.**" |
| **Object type** | "Ontology object types. The icon and color of the node depends on the definition of each object type. When clicking on the '**link**' icon next to the object type name, Data Lineage shows the **relations between this object type and other object types**." |
| **Artifact** | "Contour analyses, Reports, etc. The color of the node depends on the artifact type" |

So **link types are edges in the same graph as dataset dependencies.** One graph
spans the Dataset Layer and the Object Layer — which is what the operator's
capture showed with its legend counting `Uploaded Dataset (5)`, `Pipeline Builder
Dataset (11)`, `Object type (1)`.

Four **node indicators** sit on top of dataset nodes, and one of them is the
datasource binding made visible:

> **Defines an object type** — "This indicator appears on **datasets that are used
> to define Ontology object types**. Hovering over the right arrow allows you to
> expose those linked object types."

The others: **Open issues** (with a count on hover), **Syncs** ("datasets with this
indicator have syncs to other databases or systems"), and **Trashed** ("Deleted
nodes are also partially faded with their name crossed out").

`explore-artifacts` gives the same edge from the dataset's side: "In the **About**
tab, you will see any object types that were **created with** the selected
dataset."

## The application layout

`data-lineage-ui-reference.png`, numbered ① to ⑥:

1. **Lineage graph** — the canvas. Nodes carry `‹` and `›` chevrons to expose
   parents and descendants in place.
2. **Branch settings** — a `master` selector. "If the branch does not exist for a
   resource, the listed **fallback branches** would be used instead (in the order
   they appear on the list)."
3. **Side panel** — a vertical icon rail: Search & Browse, Properties/Histogram,
   Manage Builds, Manage Schedules, Related Artifacts.
4. **Node details panel** — bottom tabs: `Preview`, `History`, `Code`,
   `Data health`, `Build timeline`.
5. **Graph tools** — Tools, Layout, Undo/redo, Clean, Select, Expand, Color, Find,
   Remove, Align, Flow · Layout by color, Group by color, Legend · **Node color
   options** dropdown.
6. **Save** — "Save / Open", "Get quick share link" (read-only), "Export graph to
   SVG". And: "Your **branch choice is saved with your saved graph**."

Two behaviours worth keeping. Expansion is depth-controlled — "Click on the
chevron button to **define the number of levels** to expose. Click the
double-chevron to expand **all the way to the raw data**" — with a warning that
"Adding too many nodes simultaneously may affect the graph's performance." And the
histogram, for multi-select: "displays common properties and their values alongside
**the number of appearances of each value on the graph**", clickable to highlight,
with **Frequent Columns** as the column-search mechanism.

## Node coloring — 24 options, and several are facts we already store

The list is a catalogue of what Foundry considers worth knowing about a pipeline
node. The ones that map onto things we have or nearly have:

| coloring | quoted, abridged |
|---|---|
| **Permissions** | "the level of access the user has to the data or the resource… allows you to choose **any Foundry user and view their permissions**" |
| **Transaction type** | "Indicates each node's transaction type: **Append or Snapshot**" |
| **Out-of-date** | "**Out-of-date with parent**… a direct parent had been updated and the resource itself hasn't. **Out-of-date with ancestor**… up-to-date with its direct parents, but there is a resource upstream that is more updated." Filterable by **Data** vs **Logic** — "**Logic out-of-date** means job-specs has changed." |
| **Storage** | "Will be **Foundry** unless you are using Virtual Tables" |
| **Row count**, **Files** | size metrics; row count "could be calculated in the dataset details helper" |
| **Build status**, **Data Health**, **Schedule count**, **Sync status**, **Time last built**, **Build duration**, **Spark usage**, **User views**, **Branch**, **Code Status** | pipeline operations |
| **Project**, **Folder**, **Data Catalog**, **Repository**, **Resource type**, **Resource overview**, **Issues**, **Custom color**, **No color** | organisation |

"If the nodes are grouped, the more severe status would be presented" — grouping
aggregates by worst case, which is the right default for a health signal.

## Permissions coloring confirms the file/data split — from a third source

`check-permissions` offers exactly two permission types to colour by, and they are
the two halves migration 401 built:

> * **Data access in datasets** — "a user's data access is **affected by data
>   lineage**… By coloring your nodes based on the user's access to data, you can
>   easily see what the **upstream datasets** are that may restrict the user's
>   access to data." And: "this option **only works on dataset nodes**."
> * **Resource access** — "the **role** (such as Editor, Viewer, etc.) that is set
>   for the selected user on the selected resource."

With the distinction stated outright:

> "**Roles do not correspond to data lineage the same way that data access does.**
> For example, a user being an 'Editor' on a Contour Analysis does not guarantee
> they have permissions to see the data that the analysis depends on."

## Marking simulation — the reason for the reading

> "You can use Data Lineage to **evaluate how changes to dataset Markings can
> impact derived datasets**."

Flow: open **Access information**, toggle **Simulate access requirements**, select
a dataset, **Edit markings** — "search for the Marking you want to apply, check the
box… and then select **Simulate changes**. Markings that are already applied on a
dataset will appear as selected. To simulate Marking removal, **uncheck** the box."

Four result states, which is the output contract:

> * "**Simulate changes applied** appears on the datasets to which you applied changes."
> * "**Access affected** appears on datasets for which the Markings **before and after
>   the change will be different**."
> * "**Access unaffected** appears on datasets for which the Markings before and after
>   will **remain the same**."
> * "**No visible transactions** appears on datasets that have **not been built yet**,
>   or where you do not have permission to see transactions."

And one hard constraint on what may be simulated:

> "You can **only remove Markings that were applied directly on the dataset**.
> Removal of Markings that were **inherited through a dataset's lineage or from the
> parent Project cannot be simulated**."

Which is exactly the `direct` / `file_hierarchy` / `data_dependency` distinction
`file_marking_origin()` already returns.

Three tips that are really behaviour notes:

- "Datasets can **stop propagating Markings via code**… nodes on the Data Lineage
  graph that stop propagating Markings show that data access was **modified via
  code**." Searchable in the Code Helper "by using the term `stop_propagating`."
- "Datasets can have Markings propagated to them **from other inputs**; expand the
  dataset inputs by clicking on the left arrow."
- "Markings can be applied on the **parent Project or folder**; Markings will have
  a **folder icon** on their left."

A warning about what the simulation is worth: "Marking simulation relies on the
**most recent dataset builds** and does not account for changes that are not yet
finalized."

### What the simulation image adds — and it validates migration 401 verbatim

`marking-simulation-analyze.png`. The right-hand **Access information** panel, in
simulation mode, is headed with the two sections we built, with their prose:

> **File access requirements**
> "People must have a **role** and meet these access requirements in order to
> access this file."
> `ORGANIZATIONS · Any of` → `Palantir`
>
> **Data access requirements**
> "People must meet these **additional** requirements **propagated from data
> upstream** in order to access **data in this file**."
> `MARKINGS · All of` → `[lineage icon] Content: PII`

**That is a second, independent source for the split** — the first was
`data_dependecies_message.png` on the markings page. Same words, different
application. Note also that *roles* are named as part of **file** access, which is
how 401 has it.

The legend is the simulation contract with counts: `Simulated changes applied (1)`
pink · `Access affected (3)` blue · `Access unaffected (1)` grey.

The graph shows why the tool exists. `transactions_without_ssn` is pink and
labelled "*1 change simulated*"; two paths lead from it; `transactions_anonymised`
at the far right is **grey — access unaffected** despite being downstream, because
something between stops the propagation. **Seeing that before you apply the
marking is the whole product.**

And there is a **fourth banner producer** at the top of the window: a blue
full-width strip reading "🛡 **Security simulation active • marking changes are
hypothetical**", with `Clear changes` and `Exit simulation`. A *mode* banner,
alongside CBAC, static, and the scoped-session workspace banner.

---

## Connects to

- **`markings`** — closes its open question. The simulation is the missing piece,
  and its four states plus the direct-only removal constraint are a specification.
  `file_marking_origin()` already returns what the constraint needs.
- **`datasets-rid-and-object-storage`** — Data Lineage is where a dataset's
  `Inputs` come from; **Transaction type** is a colouring option, and
  **Out-of-date** distinguishes *data* from *logic* staleness, which is the
  changelog/replacement-pipeline distinction from `funnel-batch-pipelines`.
- **`create-object-type`** — the **Defines an object type** indicator is the
  datasource binding, drawn. We still do not have it.
- **`control-panel-and-banners`** — a fourth banner producer, and Data Lineage's
  own top bar (title, branch selector, build chips, `Save as`) is more evidence
  that each application owns its strip.
- **Our `dataset_inputs`** (migration 401) — already the edge this whole
  application is built on. What is missing is object types as nodes, and a query.

## Open questions

1. **Where does the `Data source` node come from?** It is Data Connection's, and
   `data-connection/` is unread. Our datasets have no upstream source concept.
2. **What is an "artifact"?** Contour analyses, Reports, Slate apps — resources
   derived from data that are not themselves datasets. We have none.
3. **How is "Out-of-date with ancestor" computed cheaply?** It needs a comparison
   of build times across a transitive closure, and no page says how.

## Decisions

Recited to the operator 2026-08-06. Plan below; nothing built from this reading
yet.
