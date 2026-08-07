<!-- source: https://palantir.com/docs/foundry/quiver/cards-index-writeback/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Writeback cards

Back to: [Index of cards](/docs/foundry/quiver/cards-index/)

**Action buttons** can be added to your Quiver analysis canvas, time series charts, and dashboards to allow users to write data back to the Ontology; for example, by creating objects, updating properties on existing objects, or modifying object links.

* [Add and configure an Action button](#add-and-configure-an-action-button)
* [Invoke Ontology Actions directly from a time series chart](#invoke-ontology-actions-directly-from-a-time-series-chart)
* [Use selection boundary values as input to Ontology Actions](#use-selection-boundary-values-as-input-to-ontology-actions)
* [Customize the button display](#customize-the-button-display)

### Examples

This capability can be used to enhance a variety of workflows, including:

**Example 1: Create an `Annotation` object instance**

Within a time series chart, you can create an object that captures context on an observed phenomenon, such as reasons for a machinery malfunction or a market macro event that affected a stock index. The start and end temporal values of the x-axis selection are passed as inputs to the `Create annotation` Ontology Action, resulting in an annotation event. The ability to annotate the plot with multiple events provides greater clarity on the data visuals at hand.

![The search bar showing an action button card option after searching for the word 'action'](/docs/resources/foundry/quiver/howto-action-button-create-annotation-example.png)

**Example 2: Adjust operational values**

You can also invoke an Ontology Action to update a property value based on an observed phenomenon. For example, the time series chart below displays two curves that show the predicted total cost per barrel for two types of products, Gasoline (in blue) and Diesel (in red). We can note that today’s actual total cost per barrel (y-axis) for Gasoline (dark blue dots) ranges from 6.35 to 8.45 cents/barrel and is far from the minimal predicted total cost which is 6.01 cents/barrel. To lower the production cost we can adjust the DRA concentration rate from 15 ppm to a value closer to 6.5 ppm. By selecting a range around 6 on the x-axis, we can then select the **Adjust DRA level** Ontology Action which will be set with the selection boundary values automatically.

![The search bar showing an action button card option after searching for the word 'action'](/docs/resources/foundry/quiver/howto-action-button-adjust-values-example.png)

## Add and configure an Action button

To add an Action button to an analysis:

1. Open the [search bar](/docs/foundry/quiver/analysis-toolbars/#search-bar) by selecting **Search cards** from the analysis top bar.
2. Search for `action` or navigate to the **Writeback** category on the left.
3. Select the **Action button** card.

![The search bar showing an Action button card option after searching for the word "action"](/docs/resources/foundry/quiver/howto-action-button-add.png)

To configure an Action button card:

1. Find the Action button in the Parameter panel.
2. Open the Action button editor by selecting the **Configure** cog wheel icon.
3. Select an existing Ontology [Action](/docs/foundry/action-types/overview/) from the dropdown list. If the Action does not exist yet, you will need to [create a new Action](/docs/foundry/action-types/getting-started/) in the Ontology.

<img alt="Action button Editor showing the select action dropdown with existing actions to select from" src="./media/howto-action-button-select-action.png" width="350px">

Selecting the Action button displays a form to fill out the inputs and submit the action. In the Action button editor, default inputs can be provided.

For example, in the following image, the `Event start` parameter is configured with a default value of January 1, 2010.

<img alt="Action button editor showing default input configuration" src="./media/action-default-input.png" width="450px">

Selecting the action button shows January 1, 2010 as the input value for `Event start` parameter. Users can still edit this value before submitting the action.

<img alt="Action button form submission showing the pre-filled input" src="./media/action-default-input-form.png" width="450px">

## Invoke Ontology Actions directly from a time series chart

It is possible to expose **Ontology Action** buttons directly from the selection menu of a time series chart. To add an Action button to a time series chart selection menu:

1. Open the time series chart editor by selecting the **Configure** cog wheel icon on the card header.
2. Under the **Action Buttons** section, open the dropdown and select an existing Action button from the analysis or create a new one. The Ontology action button will now be visible in the selection menu.

<img alt="Time series chart editor showing the select ontology action button dropdown with existing buttons to select from" src="./media/howto-action-button-add-to-time-series-chart.png" width="350px">

## Use selection boundary values as input to Ontology Actions

When an Ontology Action button is added to a time series chart, the inputs to the Ontology action can be parameterzied using the boundary values of the x- or y-axis selection.

To use the selection boundary values as Ontology Action inputs:

1. Open the Action button editor and expand the **Time Series Chart Input Override** section.
2. Add overrides based on x-axis selection, y-axis selection, or both. The selection boundaries are mapped to an action parameter based on the data type. For example, x-axis selections on a time axis can be mapped to a date/time action parameter.

<img alt="Action button showing a time series chat override" src="./media/action-time-series-override.png" width="350px">

In the following example, the selection left and right bounds were mapped to the `Event start` and `Event end` parameters. Selecting the action button from the time series chart selection menu auto-populates those values.

<img alt="Action button form submission showing the pre-filled input form chart selection" src="./media/action-time-series-override-form.png" width="450px">

## Customize the button display

You can customize the appearance of the button in the **Display** tab of the Action button editor. You can choose a label, an icon, a color, and a style.

<img alt="Action button Editor window showing the button display configuration options" src="./media/howto-action-button-display-config.png" width="350px">
