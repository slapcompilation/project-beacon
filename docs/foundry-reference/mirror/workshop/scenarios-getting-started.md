<!-- source: https://palantir.com/docs/foundry/workshop/scenarios-getting-started/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Getting started

:::callout{theme="neutral"}
This tutorial covers **temporary scenarios** (also called dynamic scenarios), which exist only within the current session and are not persisted. For a more comprehensive tutorial including scenario-aware widgets like Scenario Summary, Chart: XY with scenario comparison, and Metric Cards with scenario variables, see [Temporary scenarios](/docs/foundry/ontology/temporary-scenario/). To learn about persisting scenario metadata as Ontology objects, see [Store scenario metadata as objects](/docs/foundry/ontology/persisted-scenario/).
:::

In this tutorial we will walk through building a basic Scenario-powered module.

To begin, create a brand-new Workshop module.

![create-workshop-module](./images/create-workshop-module.png)

First, navigate to the **Settings** panel on the left and ensure Scenarios are enabled in **Advanced Functionalities**.

![scenario-settings](./images/scenario-settings.png)

In the sidebar section, add a Scenario Manager widget.

This is one of the Scenario-specific widgets in Workshop and is used to create and manage Scenarios that will be used throughout the module.

![add-scenario-manager](./images/add-scenario-manager.png)

The configuration options can be left alone for now; we will come back to them later.

![configure-scenario-manager](./images/configure-scenario-manager.png)

In the body of the module, add an [Object table](/docs/foundry/workshop/widgets-object-table/).

![add-object-table](./images/add-object-table.png)

You can use any Object set to populate the table, but we recommend starting with an Object type that already has at least one associated [Action](/docs/foundry/action-types/overview/) configured.

![configure-object-table](./images/configure-object-table.png)

Now, add a few properties to display in the table.

Just below the properties you will see the option to enable Scenario comparison in this widget (that is, the Object table is a Scenario-aware widget).

Once enabled, you can select the Scenario array variable produced by the Scenario Manager widget. This will cause the data in the table to reflect any modifications to Scenarios in the Manager rather than the raw Ontology.

![configure-object-table-compare-scenarios](./images/configure-object-table-compare-scenarios.png)

However, at this point we have not applied any modifications to our Scenario, so the data should be the same.

Add a [Button Group](/docs/foundry/workshop/widgets-button-group/) widget so you can configure an Action to apply to your Scenarios.

![add-button-group](./images/add-button-group.png)

Select an Action that modifies Objects of the type in the table.

![select-action](./images/select-action.png)

In order to apply this action to a Scenario instead of the real ontology, enable the "Apply to Scenario" option and select the active Scenario variable from the manager.

![configure-apply-action-to-scenario](./images/configure-apply-action-to-scenario.png)

Using the newly configured Action, try changing the property of any object in the table to a new value.

However, before applying the action, create a new scenario in the manager widget by clicking the "Create" button.

![create-new-scenario-from-manager](./images/create-new-scenario-from-manager.png)

This example updates the `Balance` for a client in the table.

![apply-action-to-scenario](./images/apply-action-to-scenario.png)

You should see the Object table refresh with the new data, including the modification you just made.

It is important to note that this Action has *not* been applied to the Ontology and exists only within the Scenario.

![scenario-updated-client-balance](./images/scenario-updated-client-balance.png)

We can also create another Scenario for comparison by selecting the **Create** button in the manager again. Once created, you will see the values from the second Scenario side-by-side with the first in the Object table, but only in columns that differ. Since the second Scenario has not been modified yet, it should show the values from the Ontology.

Some widgets, like the table, can take an arbitrary number of Scenarios and display the results.

![create-second-scenario-from-manager](./images/create-second-scenario-from-manager.png)

Now add a section above the table with a [Chart: XY](/docs/foundry/workshop/widgets-chart/) widget.

![add-chart-xy](./images/add-chart-xy.png)

The Chart: XY widget supports an arbitrary number of Scenarios like the table, and different Scenarios can be configured in different layers.

![configure-scenarios-chart-xy](./images/configure-scenarios-chart-xy.png)

Try exploring the various layer types to see how multiple Scenarios are visualized in them.

You can also configure Group Bys and Aggregates which will properly respect Scenario values.

![chart-xy-compare-scenarios](./images/chart-xy-compare-scenarios.png)

## Set a different color for each scenario

When you enable **Compare against Scenarios** on a single chart layer, each scenario in that layer is assigned a color automatically. The layer's **Color** setting then applies to every scenario in the layer. To choose the color of each scenario yourself, configure one layer per scenario:

1. In the **Chart: XY** configuration panel, add a layer and configure its **Data input**, **Layer type**, and **X axis property** as usual.
2. Under **Data input**, leave **Compare against Scenarios** disabled. Instead, enable **Load data from scenario** and select the variable for a single scenario, such as one of the scenario variables produced by the Scenario Manager widget.
3. In the series configuration for that layer, set **Color** to the color you want for this scenario, and set **Legend label** to the scenario name so that the legend identifies each scenario.
4. Repeat these steps for each remaining scenario, adding one layer per scenario and selecting a different **Color** for each.

:::callout{theme="neutral"}
Colors from the module's **Saved colors** palette are selectable in the **Color** picker. Define a saved color for each scenario to keep scenario colors consistent across widgets. See [Used colors](/docs/foundry/workshop/used-colors/) for more information.
:::

We can also populate values in Metric cards from Scenarios.
Add a new Metric card widget now.

![add-metric-card](./images/add-metric-card.png)

In the Metric card configuration, create a new numeric metric with a value defined by a new Object set aggregation variable.

![configure-metric-card](./images/configure-metric-card.png)

In the Object set aggregation variable configuration pane, there is a Scenario config section which will accept a Scenario variable.
If selected, the object set aggregation will be performed with modifications from the Scenario applied.

Similarly, Object property variables also have a Scenario configuration section.
In this way, you can configure variable values from Scenarios to be used in widgets that are not inherently Scenario-aware (like the metric card, which does not have an explicit Scenario configuration section).

The Scenario Selector output variable is chosen here, so you can see the aggregate change based on the selection.

![configure-aggregation-selected-scenario](./images/configure-aggregation-selected-scenario.png)

Congratulations, you have reached the end of your first Scenario tutorial!
We recommend experimenting with various configurations and layouts of all the widgets covered here.

While the layout shown in this tutorial is a common approach to a straightforward Scenario-powered application, it is not the only one.

Many powerful interactions are possible given the tools at your disposal, especially when combined with Actions; experimentation and practice will lead to better results.

![completed-module](./images/completed-module.png)
