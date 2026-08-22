<!-- source: https://palantir.com/docs/foundry/object-explorer/apply-actions/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Apply Actions

In an Exploration, buttons in the top right of the perspective will categorize and list actions with relevance to your current object set or selection. The three main categories are **“Actions”** for data writeback, **“Open In”** for bringing your current exploration to another platform application, and **“Export”** for bringing data out of the platform, such as to an Excel spreadsheet.

### Actions

[Action types](/docs/foundry/action-types/overview/) configured in the Ontology are displayed first with a name and description. Selecting one will open a form to allow you to fill in parameters and submit the Action. The current set of selected objects in your exploration (or all objects, if none are selected) is passed directly to the form, so only other parameters must be configured. Note that Actions are unavailable if the number of selected objects exceeds 1000.

Object Explorer prefills action parameters with relevant selected objects. If there is uncertainty over which parameter to prefill, the decision is left to the user and no prefills are provided.

### Opening in other applications

If there are ways to open your current result set in another application, these will be displayed under the **"Open In"** heading.

### Export

Ways to export your object set, such as exporting to Excel or copying object IDs to your clipboard, appear here.
