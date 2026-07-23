<!-- source: https://palantir.com/docs/foundry/functions/ontology-imports/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Import object, interface, and link types

Any object, interface, or link types you want to use in your function must be imported into the Project that contains your repository. Select the **Resource Imports** sidebar to view the object types which have been imported into the Project.

![ontology-import-side-panel](/docs/resources/foundry/functions/ontology-import-side-panel.png)

:::callout{theme="neutral"}
Your Organization may not have the `Airport` and `Flight` objects. Use any object types you have access to when following these steps.
:::

To import additional object types, you will need to select the **Add** button in the **Resource Imports** sidebar. If no ontology was selected, you will be prompted to select an ontology. If you have at least one imported ontology type, the selected ontology will automatically be resolved.

Once an ontology is selected, a search modal will appear. Your ontology will depend on the object types available in your Organization. Start by selecting a few object types and link types that connect them. In this example, we'll import the `Airport` and `Flight` objects, in addition to the link type between them.

![ontology-import-example](/docs/resources/foundry/functions/ontology-import-example.png)

You can also import ontology interfaces by selecting **Interfaces** under the **Add** button.

![The option to import interfaces under the "Add" dropdown.](/docs/resources/foundry/functions/interface-import-example.png)

Choose **Save** to import the ontology types into the Project. Code Assist will automatically restart to regenerate code bindings to reflect the new object and link types you imported.

In your code, you may now import ontology types from the `@foundry/ontology-api` package. If you are using a private ontology, the package name will instead be `@foundry/ontology-api/<ontology-api-name>`.

Once Code Assist starts, you can view all the available object types by using `Ctrl` + click on the @foundry/ontology-api package name. The open index.ts file shows all of the valid object types you can import into your code:

![ontology-api](/docs/resources/foundry/functions/ontology-api.png)

If you have access to more than one ontology, you can use the selector to pick which ontology you would like to use. Currently, importing multiple ontologies into a single project is unsupported.
