<!-- source: https://palantir.com/docs/foundry/object-permissioning/ontology-permissions-legacy/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Ontology permissions \[Legacy]

:::callout{theme="warning" title="Ontology resources now permissioned via Compass"}
Ontology resources (object types, action types, link types, shared properties, and interfaces) can be [regular project resources managed through the Compass filesystem.](/docs/foundry/object-permissioning/ontology-permissions/). This replaces the previous ontology roles and datasource-derived permission models. For more information, [review the updated documentation on Ontology permissions.](/docs/foundry/object-permissioning/ontology-permissions/)
:::

Ontology resources refer to object types, link types, and action types along with their metadata (schema).

You may encounter one of two legacy permission models applicable to your enrollment:

1. **[Ontology roles](#ontology-roles)** are the default method for authorizing Ontology resources. Ontology roles enable the direct application of [roles](#ontology-roles) onto each Ontology resource, independent of its backing datasource.

* For example, a user only requires the `Ontology Editor` role on the object type and does not require any permissions on the backing datasource to edit an object type in the Ontology.
* The `Ontology Editor` role only allows editing Ontology resources and their metadata and does not grant any permission on the data or datasource itself. Access to object data (not metadata) is still governed by the permissions granted on backing datasources.

2. **[Datasource-derived permissions](#datasource-derived-permissions)** are the legacy solution for authorizing Ontology resources. Datasource-derived permissions rely on the permissions defined on the backing datasource for each object type, creating a direct 1:1 dependency between object types in the Ontology and the backing datasource. For this reason, object types with datasource-derived permissions require a backing dataset.

* For example, a user must have `Editor` access to the backing datasource and be a member of the [`Ontology Administrators` group](/docs/foundry/platform-security-management/manage-groups/) (at the Ontology level) to edit an object type in the Ontology.

## Ontology roles

Ontology roles are defined as:

* `Ontology Owner`: Can edit Ontology resources and has full control over their security and sharing
* `Ontology Editor`: Can edit Ontology resources
* `Ontology Viewer`: Can view Ontology resources, but cannot edit them
* `Ontology Discoverer`: Can only see Ontology resource names and metadata, excluding schema

In addition to directly granting the above roles on Ontology resources, you can also grant these roles at the Ontology level by navigating to the **Ontology Configuration** tab of an Ontology in the [Ontology Manager](/docs/foundry/ontology-manager/overview/) application. Only the `Ontology owner` role, granted at the Ontology level, is inherited by all the resources in that Ontology; the `Ontology editor` role is only relevant for Ontology-level permissions.

As a best practice, we strongly recommended defining a trusted group of users that would be responsible for the Ontology as a whole (also referred to as the Ontology Governance Board) and grant that user group the `Ontology Owner` role for the entire ontology.

:::callout{theme="warning"}
It is possible to customize the operations included in a default Ontology role or configure additional custom roles depending on the specific needs of different user groups. For more information on roles and how they can be customized, refer to the [documentation on roles](/docs/foundry/security/projects-and-roles/#roles).
:::

### Create new resources with Ontology roles

Resource creation in the Ontology is restricted to users with `Ontology Owner` or `Ontology Editor` roles at the Ontology level. Newly created object types, link types, shared properties, and Action types with roles will show the creating user as an `Ontology Owner` on that resource and all other users as an `Ontology Viewer` by default. Once the resource is created, the creating user can apply further roles to the resource.

:::callout{theme="neutral"}
By default, every user is granted the `Ontology Editor` role at the Ontology level and can create new Ontology resources for their workflows. To customize which user groups are allowed to add new Ontology resources, an `Ontology Owner` can navigate to the **Ontology configuration** tab in Ontology Manager and adjust the Ontology-level role grants.
:::

### Type-specific edit permissions with Ontology roles

#### Permissions for editing object types and their properties

To make changes to an object type and its properties, a user must have `Ontology Editor` permission on the object type. If the user would like to map datasources/columns to object type properties, then `Viewer` permissions to the datasource that is being mapped is also required.

#### Permissions for shared properties

To make changes to a [shared property](/docs/foundry/object-link-types/shared-property-overview/), a user must have `Ontology Editor` permissions on the shared property. The user must have `Ontology Editor` on any object types to which the user wishes to add the shared property.

#### Permissions for editing link types

To make changes to a link type (create, delete, update, and so on), a user must have the following permissions:

* `Ontology viewer` permission on the object types referenced on both sides of the link type.
* `Ontology editor` permission on the link type itself.

If the link type uses a join table and the modification made involves changes to the join table, then `Viewer` permissions to the join table datasource backing the link type is also required.

#### Permissions for editing action types

To make changes to an action type (create, delete, update, and so on), a user must have the following permissions:

* At least `Editor` permissions of the action type, either directly or through inheritance from the [ontology level](#ontology-roles)
* `Ontology Editor` on all object types for which the action type can generate edits during execution.

The object types for which an action type can generate edits include the following:

* Object types referenced in create, modify, and delete object rules.
* Object types connected to link types referenced in create and delete link rules.
* Object types edited in functions of function-backed Actions.
* The [Action Log](/docs/foundry/action-types/action-log/#action-log) object type (if one is configured).

### Read-only views

When a user does not have access to edit an object type, link type, shared properties, or action type, the edit views will be disabled and a banner will explain to the user what permissions they do and do not have.

![The view permission banner displays access information for users with viewer role.](./images/oma-user-interface-view-permission.png)

![The discover permission banner shows limited access for users with discoverer role.](./images/oma-user-interface-discover-permission.png)

## Datasource derived permissions

* [View permissions](#view-permissions)
* [Type-specific edit permissions](#type-specific-edit-permissions)
  * [Permissions for editing object types and their properties](#permissions-for-editing-object-types-and-their-properties)
  * [Permissions for shared properties](#permissions-for-shared-properties)
  * [Permissions for editing link types](#permissions-for-editing-link-types)
  * [Permissions for editing action types](#permissions-for-editing-action-types)
* [Read-only views](#read-only-views)

### View permissions

Having `Viewer` permissions on the datasource backing an object type or link type allows users to see the object type or link type associated with that specific datasource.

By default, ***action types are visible to all the users*** who have access to the Ontology. All users will be able to see the title, description, and rules of all action types with the datasource-derived permissions model.

### Type-specific edit permissions

To make any changes in the Ontology Manager, a user must be a member of the `Ontology Administrators` user group. Read more about [groups and platform security](/docs/foundry/platform-security-management/manage-groups/).

A user may need additional type-specific permissions to successfully make changes in the Foundry Ontology when datasource-derived permissions are used.

#### Permissions for editing object types and their properties

In order to make any changes to an object type and its properties, a user must have `Editor` permissions to the datasources backing the object type.

:::callout{theme="warning"}
If the object type uses [object security policies](/docs/foundry/object-permissioning/object-security-policies/), additional permissions apply. Creating or editing the security policies requires `Owner` on the Ontology. Once security policies are configured, adding or removing properties requires `Owner` on the Ontology. Because this makes many common workflows highly restrictive, we recommend [migrating to project-based permissions](/docs/foundry/object-permissioning/ontology-permissions/) before configuring object security policies.
:::

#### Permissions for shared properties

To create or edit a [shared property](/docs/foundry/object-link-types/shared-property-overview/) or add a shared property to an object type, a user must be a member of the `Ontology Administrators` group.

#### Permissions for editing link types

In order to make any changes to a link type, a user must have `Editor` permissions to the datasources backing the link type and `Viewer` permissions on the datasources backing both object types referenced in the link type.

#### Permissions for editing action types

* All users with access to an Ontology can view the complete action types (editable properties, name, or user permissions, for example).
* To make changes to an action type in an Ontology (create, delete, update, and so on), a user must be a member of the `Ontology Administrators` group.
* To run the action, the user must be a `Viewer` on all the edited object types.
* If a user creates an action that modifies or adds to an object type, the `Edits` option must be enabled for that object type.

For more information on action types permissions, review the [documentation](/docs/foundry/action-types/permissions/#permissions).

### Read-only views

When a user does not have access to edit an object type, link type, or action type, the edit views will be disabled and a banner will explain to the user what permissions they do and do not have.

### Deleting the backing dataset

If the backing dataset of an object type with datasource-derived permissions has been permanently deleted from the trash, the object type is considered orphaned. Since permissions are derived from the backing dataset, which can no longer be accessed, users can no longer modify the object type as all editor permissions have been lost. The ontology automatically deletes orphaned object types.

:::callout{theme="warning" title="Warning"}
For datasource-derived permissions, all object types must have a backing dataset. To prevent an accumulation of non-editable ontology types, object types with datasource-derived permissions but no backing dataset will be removed after 24 hours.
:::
