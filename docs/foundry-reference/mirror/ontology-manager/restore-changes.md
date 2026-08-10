<!-- source: https://palantir.com/docs/foundry/ontology-manager/restore-changes/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Review and restore changes

## Review changes made to the Ontology globally

Review unsaved changes made to the Ontology globally:

From the homepage sidebar, select **Unsaved changes** to view a list of all unsaved changes made by you.

![Unsaved changes button](./images/review-restore-unsaved-changes-button.png)

Review saved changes made to the Ontology globally:

Select the **History** tab in the homepage sidebar to view a list of all saved Ontology changes with details on when the changes were made and the user who applied them.

![History button](./images/review-restore-history-button.png)

By default, the list of changes are collapsed. You can select the ![down arrow](./images/down-arrow.png) (down arrow) on any change to view details.

## Filter changes made to the Ontology globally

In the **Ontology history** page, you have the option to hide changes to object and link types that you do not have access to view. If this option is not enabled, you will be able to see that a change was made to the Ontology but will not be able to view additional details.

<img src="./images/review-restore-hide-changes.png" alt="Hide items you cannot see" width="600"/>

Each entry in the edits history corresponds to a single instance of a user saving changes. You also have the option to consolidate the view by merging changes that have been made by the same author into a single entry.

## Review changes made to a single Ontology resource

To review changes made to an Ontology resource, select the **History** tab in the Ontology resource's page. A page will be shown with the list of edits made to the resource, including the following details:

* The unsaved changes you made to the resource.
* All saved changes that were made to the resource with details on when the changes were made and the user who applied them.

<img src="./images/review-restore-entity-history-button.png" alt="Entity history button" width="600"/>

At the bottom left of an Ontology resource view, a footer states when the resource was last edited and by which user.

## Restore changes made to a single object type

Follow the steps below to restore an object type to an older version:

1. Select the restore button ![restore button](./images/restore-button.png) (anti-clockwise arrow)
2. Select **Confirm**.

:::callout{theme="warning" title="Warning"}
After restoring an object type to a previous version, any changes that were made after the entry you selected will be undone. The changes will be added to your working state and you will need to save your changes to the Ontology for your restore to take effect. [Learn more about saving to the Ontology.](/docs/foundry/ontology-manager/save-changes/)
:::
