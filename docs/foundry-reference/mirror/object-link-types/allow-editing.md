<!-- source: https://palantir.com/docs/foundry/object-link-types/allow-editing/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Allow users to edit objects and links

## Editing data from Foundry object applications

You can allow users in user applications (like Workshop and Object Views) to edit property values, add and remove links, and create and delete objects. You can also configure side effects (like notifications) based on edits made by users.

The supported way to configure this functionality is to create and configure action types in the Ontology Manager. [Learn more about how to set up action types.](/docs/foundry/action-types/overview/)

The remainder of this documentation covers what needs to be configured on object types and link types before users can take actions.

## Editing data from external applications

The [Objects API](/docs/foundry/api/ontology-resources/actions/apply-action/) provides endpoints for external clients to write and update objects, properties, and links with full permissions enforcement.

## Set up the prerequisites

In order for a user to be able to take an action defined in an action type configuration, a writeback dataset must be created. The writeback dataset will read the edits made by users when it is built and will reflect the most up-to-date state of any given object.

:::callout{theme="neutral"}
Note that edits are written to the writeback dataset and not the dataset backing an object type or link type. This ensures that users have access to both the original data and the edited data in their analyses.
:::

To set up a writeback dataset:

1. Navigate to the **Datasources** page of the object type or link type you want to enable edits on.
2. Select **Generate** in the **Writeback dataset** portion of the page to create a new writeback dataset. A dialog will open asking you to choose a Project where you would like to place the dataset. Select a location.
3. Make sure the users who you want to be able to edit the object type or link type have edit permissions on the writeback dataset.
4. Ensure that the users who you want to be able to view changes made to the object type or link type have view permissions on the writeback dataset.
   * The ability to view objects and links is controlled by an object type and link type’s backing datasources.
   * The ability to view the edits on objects and links is controlled by the permissions on the writeback dataset.
   * If users have access to only the former, they can see only the object as it exists without edits applied. If users have access to the latter, they can see both the edits and the object as it exists at present.

:::callout{theme="neutral"}
If you want a property in your object type to capture manually-entered data from an end user (via an Action or other writeback method) and this data does not yet exist in Foundry, you will need to add an empty column to the object type’s backing dataset and map it to a new property in your object type. You also need to enable edits; this is done by creating a writeback dataset in Object Storage v1 or by toggling on edits in Object Storage v2.
:::
