<!-- source: https://palantir.com/docs/foundry/data-lineage/navigation/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Navigation

To make the best use of the Data Lineage application, you will need to know how to navigate the graphs, use tools, and configure branch and graph properties. The following numbered sections correspond to the numbers on the screenshot below:

1. [Lineage graph](#lineage-graph)
2. [Branch settings](#branch-settings)
3. [Side panel](#side-panel)
   * [Search & Browse](#search-and-browse)
   * [Properties and Histogram](#properties-and-histogram)
   * [Manage Builds](#manage-builds)
   * [Manage Schedules](#manage-schedules)
   * [Related Artifacts](#related-artifacts)
4. [Node details panel](#node-details)
5. [Graph tools](#graph-tools)
6. [Save graph](#save-graph)

![Data Lineage](./images/data-lineage-ui-reference.png)

## Lineage graph

The graph is your workspace for arranging and manipulating nodes as you explore your data pipeline.

After adding nodes to the graph, you can add their related resources by clicking on the arrows on either side of the node or by using the **Expand** option in the [graph tools](#graph-tools).

Nodes are arranged with auto-layout by default, but you can rearrange nodes manually by clicking and dragging them. To re-enable auto-layout, choose **Layout all nodes** under the **Layout** option in the [graph tools](#graph-tools).

Click and drag to pan around the graph when in the default **Panning mode**. To use the cursor to select multiple nodes, switch to **Drag select** mode in the [graph tools](#graph-tools) or hold `Shift` while clicking and dragging. You can select a node by clicking it, or select multiple nodes with `Ctrl/Cmd` + click.

## Branch settings

Select a branch from the list to explore data pipelines in that branch. The graph and any of the other helpers would show information based on the selected branch. If the branch does not exist for a resource, the listed fallback branches would be used instead (in the order they appear on the list).

To learn more about branching, see the [branching documentation.](/docs/foundry/data-integration/branching/)

## Side panel

### Search and browse

Use the search helper to find Foundry resources and add them to the graph. Use the free-text search or browse the tree to find resources. Add a resource by clicking on it or use the buttons at the bottom of the view to add all search results (including or excluding the content of sub-folders). Use the **Advanced** tab to add filters to your search and sort your results.

:::callout{theme="warning" title="Warning"}
When viewing a folder with subfolders, you can recursively add *all* tables in all subfolders to the graph. Adding too many nodes at once may effect the graph's performance.
:::

### Properties and histogram

When you select a single node on the graph, the properties helper shows you the details of the resource. Depending on the type of resource you select, the properties helper shows available Foundry apps under the **Actions** menu and other links and actions (reporting issues, adding descriptions, etc.).

When you select multiple nodes on the graph, you will see the histogram helper. The helper displays common properties and their values alongside the number of appearances of each value on the graph. By clicking on the values, the matching nodes are highlighted. If you want to drill down to just those resources, click on **Update selection.**

<img src="./images/data-lineage-histogram.png" alt="View histogram" width="400" />

:::callout{theme="success"}
Use the **Copy names** button in the histogram to copy the names of all currently selected resources. The full names (including path) are copied to the clipboard as a comma-separated list.
:::

### Manage builds

The builds helper offers you three build strategies:

* Build only selected datasets
* Build all datasets between the selected datasets
* Build the selected datasets and all of their ancestors

[Learn more about managing builds.](/docs/foundry/data-lineage/build-datasets/)

### Manage schedules

The schedules helper allows you to set and edit build schedules for selected resources on the graph.
[Learn more about build schedules.](/docs/foundry/building-pipelines/scheduling-overview/).

:::callout
When viewing and creating schedules in Data Lineage, the schedules apply to the branches (including fallback branches) configured in the graph.
:::

### Related artifacts

The related artifacts helper displays artifacts directly linked to the nodes selected on the graph. Deleted and automatically saved files are excluded from the list unless chosen otherwise. You can also get to the same list of related artifacts by hovering over the right arrow of each node on the graph.

## Node details

Click on a node to see more details:

* **Preview:** A sample of the data in the selected dataset.
* **History:** An overview of dataset change history. The overview includes tabs for logs, files, metadata, schema and job specifications.
* **Code:** If code was used to generate the dataset, it will display here
* **Data Health:** All the [health checks](/docs/foundry/health-checks/overview/) set on the selected datasets.
* **Build timelines:** A Gantt chart of actual build time for the selected datasets.

## Graph tools

The graph tools provide a set of graph exploration, navigation, and customization capabilities:

* [Node coloring](#node-coloring)
* [Layout](#layout)
* [Expand](#expand)
* [Find](#find)
* [Selection](#selection)

### Node coloring

You can color the nodes on your lineage graph by several properties and metrics. Node coloring is commonly used to communicate lineage structure, troubleshoot issues, monitor pipelines health, and manage builds. You can also create your own custom coloring and arrange the graph based on the colors you assigned.

[Read more about node coloring options.](/docs/foundry/data-lineage/node-coloring/)

:::callout{theme="success"}
You can arrange your nodes on the graph by color group under **Layouts**.
:::

### Layout

The layout button provide various arrangement option for the nodes on the graph.
**Layout all nodes** applies automatic layout for all the nodes on the graphs. When you select multiple nodes on the graph, you can apply other layouts (vertical, hierarchical, by level, etc.).

:::callout{theme="success"}
You can use various useful keyboard shortcuts in the lineage graph. View the full list under the **Keyboard shortcuts** button at the top right corner of the app.
:::

### Expand

Use the **Expand** tool to expose ancestors and descendants of nodes in the graph. [Learn more about exploring data lineage.](/docs/foundry/data-lineage/explore-lineage/).

### Find

Use **Find** to search for nodes on the graph. You can either search for the name of the node or column names in datasets.

### Selection

The **Selection** tool allows you to easily select nodes on the graph:

* **Select All:** Selects all the nodes currently on the graph.
* **Invert selection:** De-selects all currently selected nodes and selects the rest of the nodes on the graph.
* **Select children:** Adds all the direct children of the currently selected nodes to your selection
* **Select parents:** Adds all the direct parents of the currently selected nodes to your selection.

## Save graph

You can save and share your lineage graph with other Foundry users in the following ways:

* **Save / Open:** Save your Data Lineage graph and re-open it by clicking on **Open graph**.
* **Get quick share link:** Generates a shareable link that provides read-only access to your graph.
* **Export graph to SVG:** Generates a static image of your lineage graph.

:::callout
Your branch choice is saved with your saved graph. If you load a graph with a different branch configuration than you currently have, you will be asked if you would like to switch branches to the saved branch configuration.
:::
