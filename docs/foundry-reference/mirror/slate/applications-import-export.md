<!-- source: https://palantir.com/docs/foundry/slate/applications-import-export/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Import, export, and duplicate applications

:::callout{theme="warning"}
These workflows are not recommended for sharing or duplicating complex applications. Instead, use the [Marketplace integration](/docs/foundry/slate/marketplace-slate/) to share applications across Foundry instances, or use [**Save as**](#duplicate-slate-applications) to duplicate applications within the same Foundry enrollment.
:::

## Import Slate applications

To import a Slate application in Edit mode, select **File** > **Import JSON** to open the **Import Slate JSON** dialog. Drag a `.slate.json` file onto the drop zone, or select **Browse** to choose a local file. The dialog displays the file name and size. During upload, the dialog displays a loading state and disables all inputs. If the upload fails, the dialog remains open and displays the error in a toast notification so you can retry.

If the permalink defined in the JSON file is new and unique, you will be prompted to choose a location where a new Slate document will be created. If the permalink defined in the JSON of the Slate document already exists in Foundry, a new version of the existing Slate document will be created with the content of the imported JSON file.

A JSON import includes only the application logic. Slate does not automatically create supporting resources such as images, files, objects, datasets, and data sources. The import fails if referenced data sources are unavailable. If the JSON contains queries that reference unconfigured data sources, you may encounter the error `You don't have permission to edit queries for all datasources in this document.` To resolve this error, remove the queries from the Slate JSON before importing, or configure the referenced data sources first. References to other resources that do not exist cause errors when you open the application. Resolve these errors by manually updating the references in Edit mode. For applications that use the [Ontology SDK](/docs/foundry/slate/concepts-osdk/), you may also need to regenerate the OSDK bundle manually after import.

## Export Slate applications

To export a Slate application, select **Export** in the **File** dropdown while in Edit mode. This will download a JSON file onto your local machine that contains the configuration of the Slate application. This configuration includes widgets, functions, query logic, events, variables, and styles. It does not contain other resources on Foundry that are not contained in the application itself, such as global stylesheets, objects, data sources, datasets, Actions, images, videos, JavaScript, and CSS libraries imported into the code sandbox.

## Duplicate Slate applications

Slate applications can be duplicated by selecting the **Save as** option under the **File** dropdown menu while in Edit mode. A pop-up will appear to enter a new location and name for the duplicate application. The new application will only contain the latest version of the original application and store it as `v1`. For applications that use the [Ontology SDK](/docs/foundry/slate/concepts-osdk/), the existing OSDK bundle is copied from the source application rather than regenerated.

### Duplicate Slate widgets

You can also reuse widgets across your Slate applications. To duplicate a widget, first select it in the Layout pane to the left of your Slate application. Then, press `Cmd+C` (macOS) or `Ctrl+C` (Windows). Finally, navigate to your second Slate app and press `Cmd+V` (macOS) or `Ctrl+V` (Windows) to paste the copied widget.

### Overwrite Slate applications

The **Save as** option also allows you to overwrite existing Slate applications. You can use this to stage or promote applications. To overwrite a Slate application, choose an existing application in the file browser as the location in which to save your application. When overwriting an application, a new version will be created and the content of the selected version of the current application will be copied.
