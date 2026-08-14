<!-- source: https://palantir.com/docs/foundry/workflow-lineage/getting-started/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Getting started

To get started with Workflow Lineage, use the keyboard shortcut `Cmd + i` (macOS) or `Ctrl + i` (Windows) to view the Workflow Lineage graph depicting the objects, actions, and functions that back your resource. You can also navigate to Workflow Lineage from the following applications with the **Open in Workflow Lineage** navigation option commonly found under **File** or **Actions**.

![Example Workflow Lineage graph with split screen.](./images/workflow-lineage-navigation.png)

The following applications support these features:

* Workshop
* Objects in Ontology Manager
* Function repositories
* Quiver dashboards
* Machinery
* Slate
* Chatbot Studio
* Automate
* Third-party applications
* Developer Console (Keyboard shortcut only)
* Marketplace (Keyboard shortcut only, in a draft resource's overview tab.)
* Notepad (Navigation option only)
* Object types in Pipeline Builder (Navigation option only)

## Interface

Workflow Lineage's interface consists of the two main components, as seen in the following notional screenshot:

1. **Graph panel:** An interactive graphical view of the entities backing your workflow and the relationships between them.
2. **Workshop panel:** An interactive view of the selected Workshop applications.

![Example open in Workflow Lineage buttons from other applications.](./images/workflow-lineage-with-numbers.png)

### Graph panel

When you select nodes on the graph panel, you can see the corresponding Workshop components highlighted on the Workshop panel. This makes it easy to see the exact places that are using specific nodes and can help show you where specific objects are being used.

<img src="./images/workflow-lineage-node-highlights.png" alt="Example Workflow Lineage node on graph." width="500">

When you select a specific node on the graph, you can use the **Pin** option to pin it to the left sidebar or view more details about the node.

<img src="./images/workflow-lineage-node.png" alt="Example Workflow Lineage node on graph." width="300">

To see all linked dependencies for a particular node, select the icon corresponding to the input type you want to see on the graph.

You can view the icons of each node type in the legend at the top right of the graph panel. Object type nodes are represented using the icon specified in the Ontology.

In the example below, we want to see the nine actions dependent on the `Outage Alert` object. Select the same icon location inline on the object to show and hide those dependencies from view.

<img src="./images/workflow-lineage-actions.png" alt="Example object with actions expanded out." width="450">

Review details of a specific node by selecting the node and then opening the selection details panel on the left side of the screen. Details displayed vary depending on the type of node selected. The following is a list of sample details that can be found for each resource:

* **Objects:** A list of properties and where those properties are used throughout the workflow (see property provenance linked below), linkages, backing data source, and so on.
* **Object links:** Resource usage by objects, functions, actions, Workshop applications, and more.
* **Functions:** Inputs, outputs, dependencies, repository, and other relevant metadata.
* **Actions:** API, RID, input data, Ontology edits, and submission criteria.
* **AIP Logic functions:** Dependencies, automations, and metadata about creation details.
* **Language models:** Model descriptions and metadata on model creator and context windows.
* **Workshop applications:** Metadata about creation and action, function, and object dependencies.

<img src="./images/workflow-lineage-selection-details.png" alt="Sample **Selection details** tab on the Workflow Lineage graph." width="450">

### Support for multiple ontologies

The Workflow Lineage graph displays resources from all relevant ontologies, allowing you to visualize cross-ontology relationships.

If an object, interface or action node belongs to a different ontology, that node will be gray and a warning icon will appear in the upper right corner of the node.

:::callout{theme="neutral"}
Action type nodes and object nodes will have limited functionality when you select an ontology different from their own. For example, you can only perform bulk updates on function-backed actions within the currently selected ontology.
:::

<img src="./images/workflow-lineage-multi-ontologies.png" alt="A Workflow Lineage graph with objects and actions from multiple ontologies." width="450">

If multiple ontologies are present, a warning icon will also appear next to the blue cube in the upper right corner of the graph. Though you can only select one ontology at a time, you can view the ontologies present in your graph and switch between them by selecting the cube icon.

<img src="./images/workflow-lineage-select-ontology.png" alt="The BD Architecture ontology is selected, but there are other nodes that are from another ontology." width="450">

### Additional details

For **Functions**, you can view the code when you select the node. This includes the objects from which your function reads and a description of the logic. You can also [bulk upgrade functions used in Workshop applications and automations](/docs/foundry/workflow-lineage/refactor-and-understand-workflows/#function-backed-automation-upgrades).

![Example function code.](./images/workflow-lineage-function-panel.png)

For **Actions**, you can view the action function code, the action log, and the option to [upgrade the action](/docs/foundry/workflow-lineage/refactor-and-understand-workflows/#property-provenance). You can also [bulk update the submission criteria on actions](/docs/foundry/workflow-lineage/manage-security/#bulk-update-action-submission-criteria) and [bulk delete actions and objects](/docs/foundry/workflow-lineage/refactor-and-understand-workflows/#bulk-delete-objects-and-actions).

![Example action log.](./images/workflow-lineage-action-logs.png)

For **objects**, you can view a preview of the object data. You can also [bulk delete actions and objects](/docs/foundry/workflow-lineage/refactor-and-understand-workflows/#bulk-delete-objects-and-actions).

:::callout{theme="warning"}
By default, the lines denoting object links and objects that are inputs to actions are not shown on the graph. To see these relationships, select the object nodes. You can use `Cmd + A` on macOS and `Ctrl + A` on Windows as a shortcut to select all nodes.
:::

![Example object view.](./images/workflow-lineage-objects.png)

You can also view object links under the **Links** section of the **Selection details** panel. Hover over each object link to show a preview of all usages.

![Hover over an object link to preview usage.](./images/object-links.png)

Select the link to view full details. If the link is being edited, a pen icon will appear next to the corresponding usage.

![Example of an object link being edited.](./images/object-links-edit.png)

These links will also show up as dependencies in downstream resources.

![Example of object links in a Workshop application.](./images/object-links-workshop.png)

For **Automations**, you can view property usages and dependencies in the **Selection details** sidebar. Under **Condition ontology dependencies**, you can see a breakdown of the specific object properties on which the automate's condition depends. Hover over the number to view the exact property.

![Example Automation view for Condition ontology dependencies.](./images/automate-properties-used.png)

You can also toggle the purple lightning bolt button at the top left of the graph to view the actions and functions that trigger the automation.

![Example Automation view with the lightning bolt disabled.](./images/automate-before-lightning.png)

![Example Automation view with the lightning bolt enabled.](./images/automate-after-lightning.png)

If you have an automation that triggers when a property is a specific value, Workflow Lineage will find the actions or functions that edit that property to that value and link them to the automation.

![A function that triggers an automation property is linked on the Workflow Lineage graph.](./images/automate-static-property.png)

### Workshop panel

On the Workshop panel, you can select different components and view the corresponding nodes highlighted on the Workflow Lineage graph.

At the bottom of the Workshop panel, the **Entities** section shows all backing objects and actions used in the application. When you select a specific entity, you can view exactly where the entity is used throughout the Workshop application.

If you have multiple Workshop applications on your graph, you can use the dropdown menu at the top to toggle between Workshop application views.

![Example Workflow Lineage workshop panel with multiple workshops in the dropdown menu.](./images/workflow-lineage-workshop-dropdown.png)

To reopen the Workshop panel, select any Workshop application on the graph and press `I`, or double-click on the node.

## Color legend options

Workflow Lineage provides a color legend system to help manage security and view metadata about specific applications. Examples of color legends are below:

![Example Workflow Lineage graph with custom colors.](./images/workflow-lineage-colors.png)

### General

* **Node type:** Shows the type of resource that each node represents on your graph.
* **Custom color:** Adds colors into the legend by right-clicking nodes to create a new color group, selecting an existing one, or dragging colors from the legend onto nodes.

### Permissions

![Example Workflow Lineage graph with custom colors.](./images/colors-permission.png)

* **Ontology permissions:** Review the [managing security](/docs/foundry/workflow-lineage/manage-security/) documentation.
* **Resource permissions:** Review the [managing security](/docs/foundry/workflow-lineage/manage-security/) documentation.

### Usage

![A Workflow Lineage graph with Usages colors.](./images/colors-usages.png)

* **Usages:** Applies color to Workshop applications based on how many views that application had over the past four weeks, in both view and edit mode.
* **Out of date functions:** Review the [action-backed function upgrades](/docs/foundry/workflow-lineage/refactor-and-understand-workflows/#function-backed-action-upgrades) section.
* **Application views:** Applies color to Workshop applications based on how many views that application had over the past four weeks, in both view and edit mode.
* **Model usage:** Review the [AIP usage metrics](/docs/foundry/workflow-lineage/aip-usage-observability/#aip-usage-metrics) section.
* **Ontology status:** Applies color to nodes based on `Active`, `Experimental`, `Deprecated`, `Example`, and `Promoted` statuses.
* **Action rule:** Applies color to nodes based on whether it runs a function, creates, modifies, or deletes objects, or does a combination of any of the above.
* **Automation expiration:** Applies color to automation nodes based on their expiration date.
* **Last modified:** Applies color to nodes based on their last modified date.

### Organization

![A Workflow Lineage graph with folder colors.](./images/colors-folder.png)

* **Folder:** Applies color to nodes based on the folder each node lives in.
* **Project:** Applies color to nodes based on the project each node lives in.
* **Portfolio:** Applies color to nodes based on the portfolio each node lives in.
* **Functions repository:** Applies color to function nodes based on the functions repository each node lives in.

## Text nodes

You can add text nodes in Workflow Lineage to help document and call attention to details in your graph. Text nodes use [Markdown syntax ↗](https://www.markdownguide.org/cheat-sheet/), and they can be colored like regular nodes. They will not be affected by layout options and are not attached to any specific node on your graph.

![Text button in the top left of the Workflow Lineage graph.](./images/text-node-add.png)

1. To add a text node to your graph, select **Text** in the top-left of the graph.
2. Double click the text node to edit and add Markdown text.
3. Select **save** when you are done.

To color a text node, right click and select **Color nodes**. Choose a color or add a new color.

![The "Color nodes" menu option to color the text node.](./images/text-node-new-color.png)

You can also resize text nodes using the three lines in the bottom right corner. If the length of your text is greater than the length of the text node, the node will automatically become scrollable.

![A text node that can be expanded and scrollable.](./images/text-node-expand.png)

[Learn more about understanding workflows in Workflow Lineage.](/docs/foundry/workflow-lineage/refactor-and-understand-workflows/)

## Presentation mode

Presentation mode in Workflow Lineage lets you create and organize visual snapshots, or “frames”, of your graph for a seamless way to present you workflow.

![The "Edit presentation frames" button in Workflow Lineage.](./images/presentation-button.png)

:::callout{theme="neutral"}
You must save your graph before you can use the presentation tool.
:::

To create a frame, adjust your graph to capture the desired configuration. This can include the arrangement of nodes, node colors, color mode, and zoom level. Once you are satisfied with the current view, select **Save state as new frame**.

![The Presentation frame pop up.](./images/presentation-save-frame.png)

Each created frame will be given a default name such as “Frame (1),” “Frame (2),” and so on, based on the number of frames in your presentation. If you wish to rename a frame, select the pencil icon next to the frame’s name and enter your preferred title.

![The frame dropdown and edit button.](./images/presentation-frame-1.png)

It is not currently possible to edit an existing frame directly. If you need to update a frame, adjust your graph as needed, save the new state as a new frame, and delete the old frame. To delete a frame, select the dropdown of all frames, and hover over the frame you want to delete. Then, select the red trashcan icon.

![The delete button on a frame](./images/presentation-delete.png)

Note that presentation mode only captures the graph interface. Elements such as the Workshop side panel and the bottom and left side panels are not included in saved frames. You can use the hotkeys `,` and `.` to go backwards and forwards through your presentation frames, respectively.

![The hotkey info on the presentation frame arrows](./images/presentation-hot-key.png)

:::callout{theme="neutral"}
Tip: Use text nodes in your presentation frames. This allows you to guide viewers through each step of your workflow with custom notes or explanations.
:::
