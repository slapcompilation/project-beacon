<!-- source: https://palantir.com/docs/foundry/slate/concepts-osdk/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Use the Ontology SDK (OSDK) in Slate

The Ontology Software Development Kit (OSDK) allows builders to leverage the full power of the Ontology within Slate's code environment. The OSDK is accessible as a library within the Functions editor, providing type-safe access to object types, link types, actions, and functions from your Ontology.

:::callout{theme="neutral"}
The OSDK in Slate uses the same underlying APIs as the [TypeScript OSDK](/docs/foundry/ontology-sdk/overview/). Slate uses JavaScript but provides IntelliSense for code completion and type hints.
:::

## Overview

The OSDK panel in Slate enables you to:

* Select an Ontology to work with
* Configure data entities including object types, link types, action types, and functions
* Generate a custom OSDK library tailored to your selected entities
* View documentation and code snippets for each entity
* Track changes before committing them to your application

## Getting started

### Access the OSDK panel

1. Open your Slate application in edit mode.
2. In the left sidebar, select the **OSDK** icon to open the OSDK panel.
3. If you have not yet configured an OSDK, you will see the Ontology selection screen.

### Select your Ontology

1. From the **Select Ontology** dropdown, choose the Ontology you want to access.
2. Select **Confirm selection** to save your selection.

:::callout{theme="neutral"}
The available Ontologies depend on your platform setup and permissions. You may only have access to one Ontology. You will have to delete and reconfigure the OSDK to switch to a different Ontology later.
:::

![The Ontology selection screen showing the Select Ontology dropdown in the OSDK panel.](/docs/resources/foundry/slate/select-ontology.png)

### Add data entities

Once you have selected an Ontology, you can add four types of entities to your OSDK configuration:

#### Object types and link types

Object types represent the core data entities in your Ontology. Link types define relationships between object types and appear nested under their parent object type.

1. In the **Object Types** section, select the **+** button.
2. Use the search dialog to find and select object types.
3. When you select an object type, any associated link types are automatically available.
4. Dependencies are resolved automatically, so if you add a link type, the required object types are included.

#### Action types

Action types allow you to execute operations that modify Ontology data.

1. In the **Action Types** section, select the **+** button.
2. Search for and select the action types you need.
3. Object type dependencies required by the action are automatically added.

#### Functions

Functions let you call custom logic defined in your Ontology.

1. In the **Functions** section, select the **+** button.
2. Browse and select the functions you want to include.

:::callout{theme="neutral"}
Functions without an API name or those that edit the Ontology cannot be selected.
:::

### Generate the OSDK

After configuring your entities:

1. Review your selections. Entities marked with an orange indicator have unsaved changes.
2. Select **Generate OSDK** to create your custom OSDK library.
3. Wait for the generation process to complete.
4. Once generated, the OSDK is available for use in your Slate functions.

![The OSDK configuration panel showing added entities and the documentation sidebar with code snippets.](/docs/resources/foundry/slate/slate-osdk-config-with-docs.png)

## Using the OSDK in Slate functions

The [Functions editor](/docs/foundry/slate/concepts-functions/) allows you to access and transform data fetched through the OSDK. To get started, select any entity in the OSDK panel to view its documentation and code snippets in the right panel. These snippets are tailored to your specific configuration and can be copied directly into your Slate functions.

For example, selecting an object type displays:

* A list of all properties with their API names and types.
* Code snippets for loading single objects, fetching pages, filtering, and more.
* The exact import statement and method calls for your generated OSDK.

For detailed syntax reference on filtering, aggregations, actions, and other operations, see the [TypeScript OSDK guide](/docs/foundry/ontology-sdk/typescript-osdk-migration/). Note that Slate uses OSDK version 1 and is in JavaScript, so type annotations are omitted.

## Managing your OSDK configuration

### Viewing entity documentation

Select any entity in the OSDK panel to view detailed documentation in the right panel, including:

* Property definitions for object types
* Parameter specifications for actions and functions
* Code snippets customized for your selected entities

### Tracking changes

The OSDK panel displays indicators for unsaved changes:

* Added entities show an orange indicator until generated
* Removed entities appear crossed out with an undo option
* Select **Discard changes** to revert to the last generated configuration

### Regenerating the OSDK

If you need to regenerate the OSDK (for example, after Ontology changes):

1. Select the dropdown arrow next to **Generate OSDK**.
2. Select **Regenerate last OSDK**.

### Viewing generation logs

To troubleshoot generation issues:

1. Select the dropdown arrow next to **Generate OSDK**.
2. Select **View latest generation logs**.

### Deleting the OSDK

To remove the OSDK configuration entirely:

1. Select the **More** menu (three dots) in the panel header.
2. Select **Delete OSDK**.
3. Confirm the deletion.

:::callout{theme="warning"}
Deleting the OSDK removes all configuration and generated code. This action cannot be undone, and you will need to reconfigure the OSDK if needed later.
:::

## Best practices

1. **Start small:** Add only the object types and actions you need. You can always add more later.
2. **Use error handling:** Always check response types to handle errors gracefully.
3. **Paginate large datasets:** Use `fetchPage()` with appropriate page sizes instead of loading all objects at once.
4. **Leverage the documentation panel:** Select entities to see up-to-date code snippets for your specific configuration.
5. **Save your application:** After generating the OSDK, save your Slate application to persist the configuration.

## Related documentation

* [Ontology SDK overview](/docs/foundry/ontology-sdk/overview/): Learn about the OSDK across all supported languages.
* [TypeScript OSDK migration guide](/docs/foundry/ontology-sdk/typescript-osdk-migration/): Detailed syntax reference for TypeScript/JavaScript OSDK operations.
* [Define and run Slate functions](/docs/foundry/slate/concepts-functions/): Learn more about using JavaScript functions in Slate.
