<!-- source: https://palantir.com/docs/foundry/slate/concepts-events/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Configure Events and Actions

The **Events panel** in Slate allow application builders to configure **actions** that execute when specific **events** happen.

[Actions](/docs/foundry/slate/concepts-events-and-actions-index/) are changes to the behavior of the application, including opening or closing dialogs/toasts, running queries, or setting variable values.

[Events](/docs/foundry/slate/concepts-events-and-actions-index/) are triggers, such as a user interaction with the application (a user click, change of value, or opening and closing of dialogs) or data loading state (query run completion) that execute an action.

The **Events panel** shows all event/action pairs configured in a Slate application. You can also define custom logic for events using Handlebar references and JavaScript to control which values are sent to the triggered actions. Just like with [functions](/docs/foundry/slate/concepts-functions/), event JavaScript does not have access to the DOM or the Slate [space](/docs/foundry/security/orgs-and-spaces/#spaces), and no state is saved.

Events and actions allow for much more robust application behavior control than when using Handlebar references alone.

![events](/docs/resources/foundry/slate/events-panel.png)

:::callout{theme="neutral"}
The events editor does not accept [helpers](/docs/foundry/slate/references-helpers/) of any kind.
:::

* [Examples](#examples)
  * [Example 1: Trigger a manual query on button click](#example-1-trigger-a-manual-query-on-button-click)
  * [Example 2: Set a variable to be double the value of a dropdown](#example-2-set-a-variable-to-be-double-the-value-of-a-dropdown)
  * [Example 3: Keep track of a list of objects in a variable, accumulated over time](#example-3-keep-track-of-a-list-of-objects-in-a-variable-accumulated-over-time)
  * [Example 4: Triggering a manual query on button click, conditionally](#example-4-triggering-a-manual-query-on-button-click-conditionally)

## Examples

### Example 1: Trigger a manual query on button click

This event will run a query when the button is clicked on:

![buttonTriggerQueryEvent](/docs/resources/foundry/slate/buttonTriggerQueryEvent.png)

Open the events panel and create a new event:

![newEvent](/docs/resources/foundry/slate/newEvent.png)

Choose `w_button.click` for the triggering event, and `q_query.run` for the triggered action, and select **Update** to persist your change. No JavaScript is necessary for this pairing.

Now, whenever the button is clicked, the query will run again, fetching new data for use in other slate functions and widgets.

### Example 2: Set a variable to be double the value of a dropdown

This event will set a variable to double whatever the amount chosen in a dropdown is. Note: this example is for illustration purposes only; normally this sort of thing should be done using slate functions.

Assume there is a dropdown widget named `w_selectionDropdown` which has various numbers that the user can choose among, and a variable `v_doubleSelection` that is meant to contain double the selected value. Then in order to create this, open the events panel and create a new event. Pick `w_selectionDropdown.selectedValue.changed` for the event, and `v_doubleSelection.set` for the action. Then fill in the code in the events panel as follows:

```js
var dropdownSelectionValue = {{slEventValue}};
return 2 * dropdownSelectionValue;
```

The end result should look something like

![doubleDropdownEvent](/docs/resources/foundry/slate/doubleDropdownEvent.png)

`{{slEventValue}}` is a special handlebars value in the events panel. If the triggering action has some associated value, then `{{slEventValue}}` will be whatever that associated value is. In the case of `.changed` actions, the `{{slEventValue}}` is the value of whatever the associated widget property has changed *to*.

Therefore, whenever the dropdown is changed, the code will take the value the dropdown was changed to, double it, and return it. The return value is used by the `.set` action to set the variable to the returned value. The upshot is, whenever the dropdown is changed, the code will take the new value of the dropdown, double it, and set the variable to this doubled value.

### Example 3: Keep track of a list of objects in a variable, accumulated over time

This event will keep a history of all the values that a user has chosen in a dropdown, so that this list of values can be used in some fashion elsewhere in the application.

Assume there is a dropdown widget named `w_selectionDropdown` which has choices that the user can choose among, and a variable `v_selectionHistory` that is meant to contain the selection history. Then in order to create this, open the events panel and create a new event. Pick `w_selectionDropdown.selectedValue.changed` for the event, and `v_selectionHistory.set` for the action. Then fill in the code in the events panel as follows:

```js
var history = {{v_selectionHistory}};
var newValue = {{slEventValue}};
history.push(newValue);
return history;
```

The end result should look something like

![dropdownHistoryEvent](/docs/resources/foundry/slate/dropdownHistoryEvent.png)

Now, whenever the user selects something from the dropdown, the event will be triggered. The code will take the current value in `v_selectionHistory`, and push onto the end of the list, the newly selected value, which is passed in by `{{slEventValue}}`, and then return the newly augmented history. Because the action is `v_selectionHistory.set`, the variable `v_selectionHistory` will be set to this new array, adding the newly selected item to the accumulated history.

### Example 4: Triggering a manual query on button click, conditionally

This event will run a query when the button is clicked on – but only if the user has entered data into the needed input widgets `w_input1` and `w_input2`.

Assume there are two input widgets (user-enterable text fields) named `w_input1` and `w_input2`. Additionally, assume there is a button named `w_buttonConditional` and a manual query `q_queryConditional`.

Assume further that the query depends on the user-entered values into the input boxes, that is to say, `w_input1.text` and `w_input2.text` and it would be useless to run the query without these two having values – so we don’t want to run the query if these are blank, even if the button is clicked. We can implement this in the following way. Create a new event, and then choose `w_buttonConditional.click` for the event, and `q_queryConditional.run` for the action. Then fill in the code in the events panel as follows:

```js
var input1Text = {{w_input1.text}};
var input2Text = {{w_input2.text}};
if (input1Text === "" || input2Text === "") {
  return {{slDisableAction}};
}
```

The end result should look something like

![events](/docs/resources/foundry/slate/events-panel.png)

`{{slDisableAction}}` is a special handlebars value in the events panel. Returning this value from the code in the panel will disable the triggered action. So in other words – if either `w_input1` or `w_input2` are empty, this special value will be returned, and the query `q_query` will not be run. If both of these inputs *do* have values however, then nothing will be returned, and the action will proceed as normal.
