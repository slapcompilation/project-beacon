<!-- source: https://palantir.com/docs/foundry/action-types/function-actions-getting-started/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Getting started

This tutorial explains how to create an action type that is backed by an [Ontology Edit function](/docs/foundry/functions/edits-overview/).

## Prerequisites

In this tutorial, we will use the same `Demo Ticket` object type and sample objects as in the [Getting Started with Actions tutorial](/docs/foundry/action-types/getting-started/).

Start by writing an Ontology edit function that performs the desired edits for your action. This requires:

* Setting up a repository using the functions on objects TypeScript template,
* Importing the relevant object types into your repository, and
* Publishing the Ontology edit function for actions to read.

Information on these steps can be found in the functions documentation:

* **[Getting started](/docs/foundry/functions/getting-started/):** Follow this tutorial to create a basic functions repository and publish a function.
* **[Functions on objects](/docs/foundry/functions/functions-on-objects/):** Follow this tutorial to create a function that uses object data.
* **[Ontology edits](/docs/foundry/functions/api-ontology-edits/):** Use this reference to create an Ontology edit function.

Once you have written and published an Ontology edit function, the steps below will connect the function to an action so that the function can be used to make edits to objects. For the purposes of this tutorial, we have written and published the following Ontology edit function from a repository:

![Ontology edit function](./images/function_backed_actions_ontology_edit_function.png)

For convenience, the code is available here:

```typescript
@OntologyEditFunction()
public addPriorityToTitle(ticket: DemoTicket): void {
    let newTitle: string = "[" + ticket.ticketPriority + "]" + ticket.ticketTitle;
    ticket.ticketTitle = newTitle;
}
```

:::callout{theme="warning"}
Functions for use in action types must be annotated with `@OntologyEditFunction()` instead of `@Function()`. Further details can be found in the documentation for [functions on objects](/docs/foundry/functions/api-ontology-edits/#declaring-an-edit-function).
:::

## Creating a function-backed action

In the **Rules** section, add a single rule of type **Function**. Search for the function you published as part of the [prerequisites](#prerequisites), and pick the latest version. Configure the inputs to match up to the action parameters, as below. Note that a function rule cannot be combined with [other Ontology rules](/docs/foundry/action-types/rules/#ontology-rules).

![Configure inputs](./images/function_backed_actions_configure_inputs.png)

When selecting the function, all inputs of the function will automatically be created as parameters and added to the **Parameters** tab. In the example shown in these screenshots, a `Demo Ticket` parameter of type **Object reference** has been created. The parameter can now be customized further if needed.

![Demo Ticket](./images/function_backed_actions_demo_ticket.png)

![Demo Ticket Details](./images/function_backed_actions_demo_ticket_details.png)

Save your action and configure it across the platform as described in the [guidance for integration with other applications.](/docs/foundry/action-types/use-actions/)

## Changing function version

By default, if the function logic is changed, the action does not automatically update to match it. Instead, you must return to the **Rules** section of the action and upgrade the version of the function that the action is referencing. For example, if we published version 0.1.2 of the function, we would need to update it here:

![How to update the version of the function](./images/function_backed_actions_update_function_logic.png)

### Auto upgrades

You can optionally choose to enable auto upgrades for the function that the action is referencing. If enabled, the action will depend on the function at a [version range](/docs/foundry/functions/version-range-dependencies-for-functions/) and [resolve the version](/docs/foundry/functions/version-range-dependencies-for-functions/#version-range-resolution) at runtime.

To enable auto upgrades for an action, navigate to the **Rules** section of the action and select the **Function** parameter. In the **Function** dropdown, select the minimum version of the function that you want to be run and enable the **Auto upgrade** option. This will correspond to a version range dependency that comprises all backward compatible versions, such as minor or patch upgrades, of the selected minimum version.

![How to enable auto upgrades for a function-backed action](./images/function_backed_actions_auto_upgrade.png)

:::callout{theme="neutral"}
Auto upgrades are disabled for function versions of the form `0.y.z`. These versions are reserved for initial development where function API and behavior may change frequently and should not be considered stable. Refer to the documentation on [choosing a release version](/docs/foundry/functions/functions-versioning/#choosing-a-release-version).
:::

#### Security

If auto upgrades are enabled for a function-backed action, users who do not have [edit permissions on the action](/docs/foundry/object-permissioning/ontology-permissions-legacy/#permissions-for-editing-link-types) can modify the action's behavior by making changes to the backing function. This is because edit permissions on the function are not tied to the permissions on the action.

#### Breaking changes

Auto upgrades can result in action execution failures due to [breaking changes](/docs/foundry/functions/version-range-dependencies-for-functions/#risks) in bad function releases.

#### Provenance

The provenance of the action is set according to the provenance of the selected minimum function version. If a newer release of the function returns edits outside of this provenance (for example, an additional object type), action execution will fail.

:::callout{theme="neutral"}
Currently, the provenance consists only of the object types that the action may edit at runtime.
:::
