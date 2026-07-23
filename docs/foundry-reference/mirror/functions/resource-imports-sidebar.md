<!-- source: https://palantir.com/docs/foundry/functions/resource-imports-sidebar/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Import resources into Code Repositories

:::callout{theme="warning"}
The following documentation is specific to TypeScript v1 functions. For more [robust capabilities](/docs/foundry/functions/language-feature-support/#typescript-v1-vs-typescript-v2), including support for Ontology SDK and configurable resource requests, we recommend [migrating to TypeScript v2](/docs/foundry/functions/typescript-v2-migration/).
:::

The **Resource imports** sidebar in Code Repositories offers a centralized interface to manage imported Foundry resources within your TypeScript functions repository. The sidebar allows you to import, remove, and view details of various resources, including Ontology types, LMS language models, live deployments, and external systems such as REST APIs.

![Resource Imports sidebar](/docs/resources/foundry/functions/resource-imports-sidebar.png)

## Select an Ontology

An Ontology is required to import object and link types. To choose an Ontology:

1. Choose **Add** to open the resource selector menu, and then choose **Ontology** to begin importing Ontology types. If no Ontology is selected, this will automatically open the Ontology selector dialog.

If you have already imported at least one Ontology type, that type's Ontology is automatically selected. To change the Ontology, choose the **Edit** button next to the selected Ontology's name to open the Ontology selector dialog.

![Ontology selector dialog](/docs/resources/foundry/functions/sidebar-ontology-picker.png)

All imported resources within your repository must be associated with the same Ontology. Note that importing resources after changing the Ontology will overwrite any existing imports from other Ontologies.

## Import resources

:::callout{theme="warning"}
Modern versions of the TypeScript v1 template maintain the current state of repository imports in a `resources.json` file checked into your repository.

If you encounter warnings about an unresolvable file in the sidebar, see the [file-based ontology imports](#file-based-repository-imports) section for information about the expected file format and troubleshooting steps for resolving the issue.
:::

To import resources using the sidebar:

1. Use the **Add** button in the top right of the sidebar and select the desired resource type. This will open the selector dialog for that resource.
2. Use the search bar and filters to locate the resources you want to import.
3. Choose a resource to display its preview panel with detailed information.
4. Use the **Select** button to add resources to your selection.
5. Expand the cart panel to review your selection and confirm by choosing **Confirm selection**.

After confirming your selection, Code Assist will be restarted to re-run the necessary code generation tasks to apply your changes.

![Example resource selector dialog](/docs/resources/foundry/functions/language-model-import-dialog.png)

Learn more about importing resources of a specific type:

* [Ontology types](/docs/foundry/functions/ontology-imports/)
* [Language models](/docs/foundry/functions/language-models-python-tsv2/#import-a-language-model)
* [Live deployments](/docs/foundry/functions/functions-on-models/#import-a-live-deployment-in-a-repository)
* [External sources](/docs/foundry/functions/webhooks/)

## Manage imported resources

Resources are categorized by type in the sidebar:

* Ontology: Object, interface, and link types
* Models: LMS models and live deployments
* Sources: External systems such as REST APIs

Choose the corresponding resource icon at the top of the sidebar to filter by type or use the text input to search by name. To remove a resource, hover over the resource icon and choose the **Remove** button. To add or remove multiple resources simultaneously, use a selector dialog. To view more details, select an imported resource to open its preview panel.

Some resource types may have dependencies between other resources. For instance, link types are organized under their respective object types. If an imported resource has dependencies, a message like "(1 link type)" will be displayed next to the resource title. To view a resource's dependencies, hover over the resource icon and select the chevron that appears.

![Resource Imports sidebar filter controls](/docs/resources/foundry/functions/resource-imports-sidebar-filters.png)

## Importing resources without API names

Resources must have an API name to be referenced within code in TypeScript functions repositories. If a resource lacks an API name, a warning is displayed. Hover over the warning sign to learn more or easily configure an API name by choosing **Add API name**.  Alternatively, choose **Learn more** to see documentation about adding an API name tailored to the specific resource type.

![Resource Imports sidebar API name warning](/docs/resources/foundry/functions/resource-imports-sidebar-api-name-warning.png)

## Import resources with value type dependencies

Some resources depend on [value types](/docs/foundry/object-link-types/value-types-overview/) to define the datatypes used to interact with them, for example, function interfaces. For these resources, their value type dependencies are imported into the repository automatically so that they are available to use along with the resource.

In some cases, importing a combination of such resources can result in a value type dependency conflict. This occurs when different resources have a common value type they depend on at differing versions. It is not possible to have both versions of the same value type imported, and this causes a compilation error. This error is accompanied by a warning in the sidebar, allowing you to view the resources with conflicting dependencies.

![Value type conflicts warning](/docs/resources/foundry/functions/value-type-conflicts-warning.png)

## File-based repository imports

Modern versions of the TypeScript v1 template maintain the current state of repository imports using a `resources.json` file checked into your repository. This gives you full Git semantics, allowing you to review, branch, and revert changes to your imports. The resource import sidebar helps you update this file by automatically inserting entries into the `resources.json` file.

If the `resources.json` file is in an invalid state, a warning will appear in the sidebar informing you that the file cannot be processed. If you encounter this error, ensure that your file contains a single JSON object with the following data:

| Field                | Type                                        |
|----------------------|---------------------------------------------|
| `objectTypes`        | Array of `{ rid: string }`                  |
| `linkTypes`          | Array of `{ rid: string }`                  |
| `sources`            | Array of `{ rid: string }`                  |
| `functions`          | Array of `{ rid: string, version: string }` |
| `valueTypes`         | Array of `{ rid: string, version: string }` |
| `functionInterfaces` | Array of `{ rid: string, version: string }` |
| `_comment`           | String                                      |
| `version`\[1]         | Integer                                     |

\[1] The `version` field is used to express the version and format of the `resources.json` file. Currently only `version: 1` is supported. `version: 0` is used to indicate that your repository must undergo a migration from the prior, repository-wide imports workflow. This migration is handled automatically with a patch applied to your repository when a commit with `version: 0` is made.

Note that because the `resources.json` file is checked into your repository, you can view the commit history and use the history to revert the file back to a working state.

## Enable resource types

By default, some resource types may not be enabled for use in your repository. The enabled resource types are determined by your `functions.json` file. This is the contents of a typical default `functions.json` file.

```json
{
  "useOntologyApiNames" : true,
  "enableModelFunctions" : false,
  "enableModelGraphFunctions" : false,
  "enableDiscoverImproperOntologyAccess": false,
  "enableQueries": false,
  "enableModelMetadata": false,
  "useDeploymentApiNames": true,
  "enableVectorProperties": true,
  "enableTimeSeriesProperties": false,
  "enableExternalSystems": false,
  "enableMediaReferenceProperties": false
}
```

Importing resources without enabling the corresponding flag in your `functions.json` file may cause checks to fail in your repository. To use imported live deployments, set `enableModelFunctions` to true. To use imported sources, set `enableExternalSystems` to true.
