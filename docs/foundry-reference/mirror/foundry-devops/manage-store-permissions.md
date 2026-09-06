<!-- source: https://palantir.com/docs/foundry/foundry-devops/manage-store-permissions/ · mirrored 2026-09-06 from Palantir Foundry docs -->

# Manage store permissions

Marketplace stores can be either local to your Foundry enrollment or remote. A local Marketplace store can be found in either a Project or folder and will inherit the permissions of the Project or folder in which it is situated. Remote stores are created on one Foundry enrollment and then made available on other enrollments. Permissions for remote stores are [configured in Control Panel](/docs/foundry/administration/configure-remote-marketplace-stores/).

## View permissions

To view a local Marketplace store in either DevOps or Marketplace, you need to have the `marketplace:read-local-marketplace` operation, which is normally granted with the `Viewer` role. `Viewer` permissions for a remote store are configured in Control Panel.

## Install product permissions

To install products from either a local or remote store, you must be able to view the store and have the `marketplace:install-from-local-marketplace` operation, which is normally granted with the `Viewer` role.

For every resource selected as an input to this installation, you must have the `marketplace:use-resource-as-input` operation, which is also normally granted with the `Viewer` role.

Additionally, the locations where you can install, typically the Space and Ontology, require the `marketplace:install-in` operation, which is usually granted with the `Editor` role.

With each installation, Marketplace will either create a new Project in the selected Space or install into an existing Project. To do this, you will need the `marketplace:install-in` operation on the Space, chosen Project, or Folder. This permission is typically granted with the `Editor` role.

You must also have access to at least one Organization Marking present on the store. However, access to the Project containing the store already requires access to one of the Organization Markings.

## Create store permissions

To create a local store, you must have the `marketplace:create-local-marketplace` operation in a Project or folder, which is usually granted with the `Editor` role.

Currently, remote stores can only be created by Palantir.

## Edit product permissions

To create or edit products in a local store, you must have the `marketplace:create-block`, `marketplace:edit-block-set`, and `marketplace:upload-attachment` operations, which will usually be granted to the `Editor` role.

Remote stores are not editable in DevOps.

## Dataset packaging permissions

Packaging a resource that carries underlying data — most commonly a [dataset](/docs/foundry/data-integration/datasets/) added as an output — reads that resource's files so their contents can be recreated on installation. Reading these files requires the `foundry-data-proxy:get-files` (**Download**) operation on the resource, in addition to the [edit permissions](#edit-product-permissions) needed to build the product. Without this operation, packaging a dataset as an output fails with a `foundry-data-proxy:get-files` permission error, even though the rest of the draft may package successfully. Only the **Include with static data** packaging option reads the dataset's files. If you do not need the dataset's rows in the product, choose **Include dataset definition only** or **Include with transform or pipeline** instead; neither option requires the **Download** operation. The second option is named after the dataset's associated producer, so it may instead read **Include with sync**, **Include with restricted view**, or similar, depending on how the dataset is built.

By default, the `foundry-data-proxy:get-files` operation is granted to the `Viewer`, `Editor`, and `Owner` roles, so no additional permission is needed to package a dataset. This operation is only enforced on enrollments that are configured to [restrict downloads](/docs/foundry/security/download-controls/).

Enrollments that restrict downloads often customize their [role set](/docs/foundry/platform-security-management/manage-roles/#role-sets) to remove download operations, including `foundry-data-proxy:get-files`, from the default roles and grant them through a dedicated role instead—for example, an `Exporter` role. On such enrollments, the `Owner` role alone does not include the download operation, so an owner who has not also been granted the download-enabling role cannot package a dataset as an output. Granting that role (or otherwise granting `foundry-data-proxy:get-files` on the dataset) resolves the error.

:::callout{theme="neutral"}
This separation is intentional. Decoupling the ability to export raw data from resource ownership upholds the principle of least privilege and supports centralized [download controls](/docs/foundry/security/download-controls/). As a result, the `Owner` role does not necessarily include export or download permissions on enrollments that restrict downloads.
:::

## Export product permissions

To export products from a local store, a user must have the `marketplace:export-block-set` operation, which will usually be granted to the `Owner` role. Currently, a user cannot export products from a remote store.

## Import product permissions

To import products to a local store, a user must have the `marketplace:import-blockset-with-provenance` operation, which will usually be granted to the `Owner` role. Currently, a user cannot import products to a remote store.

## Edit store tags permissions

To edit tags on a local store, a user must have the `marketplace:edit-local-marketplace` operation, which will usually be granted to the `Editor` role. Currently, users cannot edit tags on a remote store.

## Organization Markings applied to a product creation

All resources packaged in a Marketplace product are marked with one or multiple Organization Markings, usually inherited from the Project in which the resources are stored.
Similarly, a Marketplace store is also marked with the Organization markings of the Project in which it is stored.

If the product resources do not have the same Organization Markings as the Marketplace store, you must obtain `Expand access` permissions for those Organization markings.
For example, suppose a Workshop application belongs to **Organization A**, and the store belongs to both **Organization A** and **Organization B**.  The `Expand access` permission on **Organization A** is required to successfully package this Workshop application in the Marketplace store because you are extending the content from **Organization A** to **Organization B**.

If the product resources have Organization Markings that the Marketplace store does not have, you must obtain `Remove` permissions for those Organization Markings.
For example, imagine a Workshop application belongs to both **Organization A** and **Organization B**, and the store belongs *only* to **Organization A**. The `Remove` permission on **Organization B** is required to successfully package this Workshop application in the Marketplace store because you are removing (or *unmarking*) the Marking of **Organization B**.

:::callout{theme="neutral"}
As a user, you might not be authorized to view all Organizations to which a resource belongs.
:::

## Organization Markings applied to a product installation

In general, a Marketplace store must include all relevant Organization Markings for the Spaces into which you want to install. This means that a local Marketplace store must be located in a Project with all relevant Organization Markings for the Spaces into which you want to install.

For instance, if a Marketplace store only has **Organization A's** Marking and you want to install products of the store into a Space containing both **Organization A** and **Organization B**, you must obtain `Expand access` permissions for **Organization A** at installation time because you are extending the content from **Organization A** to **Organization B**.

:::callout{theme="neutral"}
During the installation, you can also opt to only apply **Organization A's** Markings to your product installation; this would eliminate the need for expanding access permissions.
:::

Alternatively, you can add Organization B's Marking to the store, which would allow more users to install products from the store. For instance, if a Marketplace store has Markings from both Organization A and B, and you want to install products of the store into a Space containing only Organization A, no additional permissions are required. However, users with access to only Organization B will also be able to install products from this store.

## Require approval for new product versions

Marketplace stores can be configured to require approval before new product versions are published. When enabled, an approver must review and approve each draft before a new release is finalized.

The approving user must be different from the author of the draft and must have the `marketplace:finalize-block-set` operation on the store. This operation is granted to store owners and editors by default. To customize the list of allowed approvers, use a custom role set.

![The approval requirement toggle in the store settings.](./images/require-approval-toggle.png)

## Product creation and installation permissions

### Multi-organization scenarios

In Foundry, you must have sufficient permission to move a resource from one Project to another by being the `Owner` of that resource, but you will also need additional permission on the Marking(s) involved if the move would expand the set of Organizations that can access the resources after the move.

For example, suppose a resource is in **Project A**, which belongs to **Organization A**, and you want to move the resource to **Project B**, which belongs to both **Organization A** and **Organization B**. You must have the `Expand access` permission on the **Organization A** Marking. `Expand access` is an elevated permission that allows you to expand the access of resources (belonging to **Organization A** in our example) to other Organizations (like **Organization B**).

If a resource has a Marking indicating PII other sensitive data, you must have the `Remove Marking` permission to remove that particular Marking.

If resources in **Project A** are packaged in a product stored in **Project B**, which is then installed in **Project C**, you must have sufficient permission(s) to both `Expand` Organization Markings and `Remove` additional Markings if any are present, since those Markings are removed during product movement.

### Guidance on permission structure

To avoid friction during product creation, installation, and beyond we recommend the following:

* Resources should initially be located in a Project belonging to a single Organization dedicated to package resources, without additional Markings.
  * The user packaging the resources into a product must have the sufficient permission listed above on this single Organization, which can be granted to a wider spectrum of users.
* Any Organizations expected to install products from a store should have access to the Space in which the Marketplace store Project is located. You can create a dedicated Space for this purpose and include the different Organizations that should have access to the store.
  * The user installing the product will not require additional permission on the Organization Markings to perform installations.

This permission structure allows for any friction to occur at packaging time, allowing you to make necessary changes before the install process begins.
