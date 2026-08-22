<!-- source: https://palantir.com/docs/foundry/action-types/function-actions-overview/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Function-backed actions

In an action type, [rules](/docs/foundry/action-types/rules/) define the ways objects should change when the action is applied. Many action types can be defined using simple rules which allow you to create, modify, and delete objects, or create and delete links between objects.

In some cases, however, simple rules are not sufficient to describe the changes that you want to make. For example, you may want to:

* Modify multiple objects that are currently linked together. For example, you may want to set the `status` field of an `Incident` object to `Closed`, and also set the `status` of all linked `Alert` objects to `Resolved`.
* Modify an object's properties based on some more complex logic. For example, you may want to compute a value based on some business logic that reads data from several objects, then write that value into an object property.
* Create several different types of objects and set up links between them.

To support use cases like these, action types can be configured to call a [function](/docs/foundry/functions/overview/) that defines the logic of how objects should be modified. These action types are often referred to as **function-backed actions**. By using a function, you can create action types of any level of complexity, reading any number of objects and modifying objects as you see fit.

Although function-backed action types are very flexible, you should note that they are subject to both [action type limits](/docs/foundry/action-types/scale-property-limits/) and [function execution limits](/docs/foundry/functions/manage-functions/#enforced-limits).

Get started with function-backed actions by following the [tutorial](/docs/foundry/action-types/function-actions-getting-started/).
