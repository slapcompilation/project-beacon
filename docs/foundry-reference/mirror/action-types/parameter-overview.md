<!-- source: https://palantir.com/docs/foundry/action-types/parameter-overview/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Parameters

**Parameters** are the inputs of an action type. They are the interface between the **Rules** and other Foundry applications, such as [Workshop](/docs/foundry/workshop/overview/), [Slate](/docs/foundry/slate/overview/), and [Object Views](/docs/foundry/object-views/overview/). Parameters are treated like variables that contain external values. Each parameter is defined by a type, which dictates what kind of values it can take. Beyond its type, parameters have a variety of other potential configurations. Each parameter can be individually configured as to whether they are exposed in the form or not, or whether they can be changed by the user or not.

Parameters transport values across the action type and can be referenced in rules to pass the value back on an object, link, or side effect, in submission criteria, to check if an action can be submitted, to access the current value of an object property before it is changed by the action or in overrides to change the configuration of a following parameter.

:::callout{title="Example"}
A parameter can take the form of a `Ticket` object type in an action type which allows users to modify the status of a selected ticket. A `Status` parameter is defined as a string. When submitting the action, the object type parameter will take the value of a selected `Ticket` object and the `Status` parameter contains the future status. The action type then passes both parameter values to the rules and executes them to edit the object.
:::

:::callout{title="Example"}
As a variable in Workshop, `previous_status` can take the current value of the `Status` property of the selected `Ticket` object. This can be passed to a hidden parameter in the action, `Previous Status`, and the `Status` parameter can contain the updated status. Upon submitting the action, the action type then passes both the `Previous Status` and the `Status` values to the rules and executes them to edit the object.
:::
