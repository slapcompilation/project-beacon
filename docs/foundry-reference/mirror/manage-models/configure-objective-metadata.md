<!-- source: https://palantir.com/docs/foundry/manage-models/configure-objective-metadata/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Configure objective metadata

When a model is submitted to a modeling objective, certain metadata about that model and version is collected by default. In addition, you can define additional context-specific metadata to attach to each submitted model.

Different teams have different mandates or required information that they wish to track. For example, you may wish to monitor compliance codes, model vendor IDs, or ticket numbers in a task tracker such as Jira. Custom metadata enables you to track any information you wish to capture associated with a model.

The **Display metadata** tab on the **Settings** page provides the option for changing the display options for the default metadata collected by each objective. However, all metadata in that tab, selected or unselected, will be shown in the **Model details** section for each model submission.

![metadata page](/docs/resources/foundry/manage-models/metadata_settings-metadata.png)

The **Custom model metadata** tab provides an interface for configuring additional custom metadata fields.

![custom metadata](/docs/resources/foundry/manage-models/metadata_custom-metadata.png)

Multiple metadata types are supported.

![metadata types](/docs/resources/foundry/manage-models/metadata_new-metadata.png)

There is a JSON editor option to easily copy/paste metadata between objectives.

![json metadata configuration](/docs/resources/foundry/manage-models/metadata_json-metadata.png)

After adding custom metadata to an objective, when someone submits a model, the custom metadata fields will be available for submitters to enter.

![submission with metadata](/docs/resources/foundry/manage-models/metadata_submission-with-metadata.png)
