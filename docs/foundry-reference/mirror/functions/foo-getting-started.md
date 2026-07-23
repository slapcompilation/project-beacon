<!-- source: https://palantir.com/docs/foundry/functions/foo-getting-started/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Getting started with functions on objects

One of core features of functions is they can easily access data that has been integrated into the Foundry Ontology. The Ontology provides semantic modeling of data for your organization, which makes it easy to access structured data and reuse logic across use cases.

:::callout{title="Prerequisites"}
This tutorial assumes that you have created and set up a TypeScript repository. If you haven't yet, complete the [Getting started](/docs/foundry/functions/getting-started/) tutorial first.
:::

### Import Ontology types

Any object, interface, or link types you want to use in your function must be imported into the Project that contains your repository. Selecting the **Resource Imports** side bar shows you the object types which have been imported into the Project.

![ontology-import-side-panel](/docs/resources/foundry/functions/ontology-import-side-panel.png)

:::callout{theme="neutral"}
Your organization may not have the Airport and Flight objects. Use any object types you have access to when following along.
:::

To import additional object types, you will need to select the **Add** button in the **Resource Imports** side bar. If no Ontology has been selected you will be prompted to select an Ontology. If you have at least one imported Ontology type, the selected Ontology will automatically be resolved.

Once an Ontology is selected, a search modal will appear. Your Ontology will depend on the object types available in your organization. Start by selecting a few object types and link types that connect them. In this example, we'll import the Airport and Flight objects, in addition to the link type between them.

![ontology-import-example](/docs/resources/foundry/functions/ontology-import-example.png)

Choose **Confirm selection** to import the Ontology types into the project. Code Assist will automatically be restarted to regenerate code bindings to reflect the new object and link types you have imported.

In your code, you may now import Ontology types from the `@foundry/ontology-api` package. If you are using a private Ontology, the package name will instead be `@foundry/ontology-api/<ontology-api-name>`.

:::callout{title="Private Ontologies"}
If you are using a private Ontology, replace `@foundry/ontology-api` with `@foundry/ontology-api/your-private-ontology-api-name-here` in all the following examples.
:::

### Add an object-backed function

Next, let's write a function using an object type you just imported. Your code will depend on the object types, properties, and link types available to you. Switch back to the **Code** tab, and try importing one of the object types you just added:

```typescript
import { Airport } from "@foundry/ontology-api";
```

Then, write a function that takes that object as input:

```typescript
@Function()
public myObjectFunction(airport: Airport) {
    airport.
}
```

Once Code Assist has started, simply type `airport.` to see autocomplete for the properties and link types available to you:

![autocomplete](/docs/resources/foundry/functions/autocomplete.png)

In this example, we use a [template string ↗](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#syntax) to combine the `city` and `country` fields on an Airport into a human-readable location:

```typescript
@Function()
public airportLocation(airport: Airport): string {
    return `${airport.city}, ${airport.country}`;
}
```

Experiment with the APIs based on your own Ontology and write a function that returns a value based on your object type.

### Test in live preview

Open the **functions helper**, toggle to **Live Preview**, and choose the function that you wrote above. To run an object-backed function in live preview, you have to import the backing datasource for the object type. Select the warning icon next to the **Run** option:

![helper-datasource-import](/docs/resources/foundry/functions/helper-datasource-import.png)

Then, use the dialog to import the backing datasources for your object types:

![helper-datasource-import-dialog](/docs/resources/foundry/functions/helper-datasource-import-dialog.png)

After you've imported the datasources, choose an object and select **Run** to see results:

![helper-preview-run-foo](/docs/resources/foundry/functions/helper-preview-run-foo.png)

:::callout{theme="warning" title="Live preview permissions"}
The permissions on object types in live preview are determined by the [TypeScript repository's permissions on the backing datasources underlying each object type](/docs/foundry/functions/permissions/#object-loading-permissions). When testing [functions that create notifications](/docs/foundry/functions/configure-notifications/#configure-notifications), the recipients' permissions are not enforced. For this reason, a function that creates a notification may succeed in live preview but fail when used by an action elsewhere in Foundry.

Learn more about [configuring notifications for actions](/docs/foundry/action-types/notifications/).
:::

### Publish the new function

Publish the new function by committing your code and publishing a new tag using the **Branches** tab. Once your function has been published, you can test it using the **functions helper**.

![helper-run-foo](/docs/resources/foundry/functions/helper-run-foo.png)

After the function has been published, you can start using it in other applications throughout the platform.

### Next steps

This tutorial just scratches the surface of what you can do with functions on objects. To learn more, refer to these resources:

* Refer to the [object API documentation](/docs/foundry/functions/api-objects-links/) to learn what you can do with objects
* Read the [object Sets documentation](/docs/foundry/functions/api-object-sets/) to learn about searching for objects and aggregations on-demand
* Learn about ways you can [use functions in the platform](/docs/foundry/functions/use-functions/)
