<!-- source: https://palantir.com/docs/foundry/object-edits/user-edit-history/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Enable user edit history

Tracking the history of user edits to objects indexed into Object Storage v2. Enable or disable this feature using the **Track user edit history** toggle in the **Datasources** tab of the Ontology Manager, as shown in the screenshot below.

![Track user edit history toggle](/docs/resources/foundry/object-edits/track-user-edits-history.png)

To allow user edits, the [Edits toggle](/docs/foundry/object-edits/how-edits-applied/) must be enabled.

## Common issues and notes

* The edit history reflects the changes made to objects after enabling the **Track user edit history**. Any changes prior to the activation of this feature will not be tracked.
* Once you enable the **Track user edit history**, it takes a few minutes to initialize. During this short period, users can't perform actions on these objects.
* If you are migrating from Object Storage v1 to Object Storage v2, ensure that `preserve edit history` is checked during the migration if you want to retain the edit history.
* Users who have access to the current state of an object (object with the same primary key) can access the entire history of the object. This implies that if an object is deleted and recreated, users can still see the history that occurred prior to the deletion action.

After enabling **Track user edit history**, the [Edit History widget](/docs/foundry/workshop/widgets-edits-history/) can be added to Workshop modules or Workshop-backed object views to display edit histories.

## Disable edit history

Disabling **Track user edit history** permanently deletes all existing edit histories for this object type. Before saving the ontology, users will receive a warning and must confirm an acknowledgment that edit history will be deleted.

![Disable user edit history toggle](/docs/resources/foundry/object-edits/disable-edits-history.png)
