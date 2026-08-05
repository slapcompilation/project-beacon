<!-- source: https://palantir.com/docs/foundry/slate/applications-import-export/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Import, export, and duplicate applications

:::callout{theme="warning"}
These workflows are not recommended for sharing or duplicating complex applications. Instead, use the [Marketplace integration](/docs/foundry/slate/marketplace-slate/) to share applications across Foundry instances, or use [**Save as**](#duplicate-slate-applications) to duplicate applications within the same Foundry enrollment.
:::

## Import Slate applications

To import a Slate application, select the **File** dropdown menu and choose **Import JSON** while in Edit mode to open the upload dialog. Select a JSON file from your local machine to upload as a Slate document. If the permalink defined in the JSON file is new and unique, you will be prompted to choose a location where a new Slate document will be created. If the permalink defined in the JSON of the Slate document already exists in Foundry, a new version of the existing Slate document will be created with the content of the imported JSON file.

When importing an application, only the logic of the application itself is imported. Supporting resources such as images, files, objects, datasets, and data sources are not automatically created. The JSON import will fail if referenced data sources are not available. References to other resources that do not exist will result in an error when opening the application, but these errors can be resolved by re-pointing them manually in edit mode. For applications that use the [Ontology SDK](/docs/foundry/slate/concepts-osdk/), you may also need to regenerate the OSDK bundle manually after import.

## Export Slate applications

To export a Slate application, select **Export** in the **File** dropdown while in Edit mode. This will download a JSON file onto your local machine that contains the configuration of the Slate application. This configuration includes widgets, functions, query logic, events, variables, and styles. It does not contain other resources on Foundry that are not contained in the application itself, such as global stylesheets, objects, data sources, datasets, Actions, images, videos, JavaScript, and CSS libraries imported into the code sandbox.

## Duplicate Slate applications

Slate applications can be duplicated by selecting the **Save as** option under the **File** dropdown menu while in Edit mode. A pop-up will appear to enter a new location and name for the duplicate application. The new application will only contain the latest version of the original application and store it as `v1`. For applications that use the [Ontology SDK](/docs/foundry/slate/concepts-osdk/), the existing OSDK bundle is copied from the source application rather than regenerated.

### Duplicate Slate widgets

You can also reuse widgets across your Slate applications. To duplicate a widget, first select it in the Layout pane to the left of your Slate application. Then, press `Cmd+C` (macOS) or `Ctrl+C` (Windows). Finally, navigate to your second Slate app and press `Cmd+V` (macOS) or `Ctrl+V` (Windows) to paste the copied widget.

### Overwrite Slate applications

The **Save as** option also allows you to overwrite existing Slate applications. You can use this to stage or promote applications. To overwrite a Slate application, choose an existing application in the file browser as the location in which to save your application. When overwriting an application, a new version will be created and the content of the selected version of the current application will be copied.
