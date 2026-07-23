<!-- source: https://palantir.com/docs/foundry/action-types/inline-edits/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Inline edits

Action-backed inline edits are validated and submitted differently than standard [actions](/docs/foundry/action-types/getting-started/). For standard actions, multiple parameters need to be set in order for the action to be valid. However, for action-backed inline edits, every parameter is optional and defaults to the existing value of the object, so a user can make individual changes to properties one at a time.

This documentation discusses how to avoid unexpected results when using inline edits. Inline edits are available in both Workshop and Object Explorer. The configuration of the inline edit action depends on where the action is used.

## Object Explorer inline edits

Inline edits allow users to quickly edit values of an object in the [Object Explorer results view](/docs/foundry/object-explorer/view-results/) or native Object View widgets, like the property or metric cards widget.

### Configuration

![Inline edit action configuration](/docs/resources/foundry/action-types/inline-action-configuration.png)

To set up an inline edit action, navigate to the **Properties** tab of your object type and then to the **Interaction** tab in Ontology Manager. Select a property and navigate to **Inline edit** in the sidebar. In the dropdown menu, select one of the available action types or create a new one. Creating a new one will trigger the action type creation workflow. Each property can have only one inline edit action type.

You can use the same action type as an inline edit for multiple properties, or you can have separate action types for different properties.

#### Action type requirements for inline edits

Not all action types can be used as inline edit action types. To be accepted, the action type must meet the following requirements:

* May only modify a single object of a single object type.
* Default values must be enabled.
* Default values must come from the object reference parameter on which the inline action is defined. As a result, properties that are being changed in the action cannot be mapped to static values or special values like "Current User" or "Current Time".
* Visibility status and overrides can be set; however, they will be ignored if the inline edit is used in Object Explorer and Object Views.
* [Side effect webhooks](/docs/foundry/action-types/webhooks/#webhooks-writeback-vs-side-effect) or [side effect notifications](/docs/foundry/action-types/notifications/) cannot be enabled.

## Workshop inline edits

No additional configuration is required to use an action type as an inline edit in Workshop, but not all actions are suitable for cell-level editing. For information on how to configure inline edits, see the [Workshop documentation](/docs/foundry/workshop/widgets-object-table/#inline-edits-cell-level-writeback).

### Background

When running a single action, edits are validated and submitted one at a time (sequentially). Inline edits differ in that they are validated and submitted in bulk. Because of this, not all actions are suitable for inline edits. Actions that may fail or have unexpected results due to inline edits include:

* Any action that attempts to read data to which another action could have written, or
* Two actions that try to write to the same object.

:::callout{theme="neutral"}
When inline edits are applied to a [Scenario](/docs/foundry/workshop/scenarios-overview/), the submitted actions are applied sequentially (in a non-deterministic order) rather than simultaneously (as is normally the case with inline edits). As a result, inline edit actions that ordinarily fail due to multiple actions trying to write to the same object may succeed when applied to a scenario, though we do not recommend building applications that depend upon this difference in behavior.
:::

### Valid inline Actions

Actions must submit non-conflicting edits to be effective as Action-backed inline edits. In practice, this means multiple Actions configured in the same table edit widget must not:

* Write to the same object,
* Create the same link, or
* Attempt to keep aggregate values consistent.

### Invalid inline Actions

**Actions will return an error if an inline edit attempts to edit the same object twice.** Also, adding or deleting join table links is not supported by inline edits and will result in a user-facing error message.

As users apply inline edits, [submission criteria](/docs/foundry/action-types/submission-criteria/) will be applied to each edit, but the edits will be submitted in bulk. Both parameter and global submission criteria will be evaluated for each edited object, but submission criteria that reference shared or linked objects are not compatible with inline edits. This is because when applying inline edits, cumulative submission criteria compare the edited value to the unedited values for the column. At final submission, the edits will be submitted all at once and will succeed if they all pass parameter and global submission criteria for the corresponding object.

Submission criteria on objects shared between multiple Action types or linked objects are therefore evaluated once per edit, before any edits are made.

:::callout{theme="warning"}
Submission criteria that reference shared Action types or linked objects are not compatible with inline edits, and bulk updating objects could violate submission criteria rules that work as expected when applied sequentially (one at a time).
:::

#### Example: Invalid inline Actions

Imagine a `Delay Flight` Action that can delay a single flight by a maximum of 20 minutes at an airport that can delay all flights by a maximum of 50 minutes.

* Both submission criteria – the 20 minute requirement and the 50 minute total –  will be evaluated each time a cell is updated.
  * Because no edits are yet submitted, the 50 minute total will compare the new delays to the sum of unedited delays in the column (the delays from before inline editing began).
* The second submission criteria (that all the delays at the airport sum to less than 50 minutes) relies on an aggregated value and is shared by all the objects in the column.
  * Since inline edits are submitted in bulk, this second submission criteria will not be effective in limiting the total duration of flight delays at a given airport; the resulting edits could sum to greater than the 50 allowed by the second submission criteria.
* This Action would not be suitable for table editing as it would cause inconsistent results compared to running the Action individually for each cell.
