<!-- source: https://palantir.com/docs/foundry/forms/permissions/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Permissions

:::callout{theme="warning"}
In most cases, permissions should remain as they are set by default. Custom permissions can often cause challenges in tracking platform operations available to different users.
:::

## Create forms

By default, all users can make spreadsheet-backed forms or forms without an origin. Only a subset of users can create forms backed by an object type.

### Details

To create a form, you need permission to create resources in the filesystem folder in which the form will be located.

You also need specific permissions based on the backing data for the form:

* For an object-backed form: `fforms:form-definition:create-phonograph-form`
* For a spreadsheet-backed form: `fforms:form-definition:create-fusion-form`
* For a form that is created without a backing origin: `fforms:form-definition:create-no-origin-form`

The following user groups have these permissions by default, which can be overridden in the Foundry Forms backend configuration:

* `fforms:form-definition:create-phonograph-form` is given to the groups "fforms-admins" and "Platform Administrators".
* `fforms:form-definition:create-fusion-form` is given to all users.
* `fforms:form-definition:create-no-origin-form` is given to all users.

## Create new entries

By default, users only need `Viewer` permissions on the form they are filling to create new entries. Turn off `Allow creation of new objects without read or write permissions` in the settings panel in the Visual Editor to restrict the form so only users with permissions on the backing object type or spreadsheet can fill the form.

### Details

A user may not be able to create new entries for the following reasons:

* A form may not have a published, fillable version.
* If there are any [attachment fields](/docs/foundry/forms/attachments-field/) in the form, then users must have permission to upload files to the attachments folder.

By default, `fforms:form-definition:view` is given to users with the `compass:view` permission on the form. This can be overridden in the Foundry Forms backend configuration.

## Edit existing entries

As with creating new entries, you need permission to view the form. In addition, you need permission to edit the backing origin, whether it is an object type or a spreadsheet.

### Details

The `Allow creation of new objects without read or write permissions` option does not affect editing existing entries. There is no current equivalent for editing entries. However, Foundry Forms previously supported this feature and some older forms may still allow editing entries without origin permissions to allow for backwards compatibility.

As with creating new entries, a published version must still exist, and you will need permission to upload files to any folders referenced in attachment fields.

## Save changes to form definitions

To edit a form, you need `Editor` permission on the form. If you want to limit who can make changes to the version of the form that users see, you can do so by restricting [who has permission to publish the form](#publish-a-version-of-a-form).

### Details

To edit an unpublished version of a form, you need `fforms:form-definition:edit` on the form. To edit a published version of a form, you additionally need all the permissions required to [publish a version of that form](#publish-a-version-of-a-form).

By default `fforms:form-definition:edit` comes from `compass:edit` on the form. This can be overridden in the Foundry Forms backend configuration.

## Publish a version of a form

To publish a form, you need `Editor` permission on the form. If you want to restrict who can publish the form to only users with manage permissions on the form, you can move `fforms:form-definition:manage` from the `compass:edit` to `compass:manage` expansion in the backend configuration.

### Details

To publish a version of a form, you need `fforms:form-definition:manage` on the form. You additionally need:

* [Permission to manage the origin of the form](#manage-the-origin-of-a-form)
* `compass:manage` on any folders used in attachment fields

By default, `fforms:form-definition:manage` comes from `compass:edit` on the form. These options can be changed in the Foundry Forms backend configuration, but the requirement on attachment folders cannot be changed.

## Create a new version of a form

To create a new version of a form, you need `Editor` permission on the form. You will also need to belong to the group that can make either object-backed or spreadsheet-backed forms, depending on your use case.

### Details

To create a new version of a form, you need permission to [create a form of that origin type](#create-forms).  You also need `fforms:form-definition:create-new-version` and [permission to manage the origin of the form](#manage-the-origin-of-a-form).

`fforms:form-definition:create-new-version` comes from `compass:edit` by default, but this can be changed in the backend configuration.

## Change the response destination of a form

To change the response destination of a form you need:

* Permission to [create a form of that origin type](#create-forms)
* Permission to [manage the origin of the form](#manage-the-origin-of-a-form)
* Permission to [save changes to the form definition](#save-changes-to-form-definitions), although you do not need permissions to any folders that appear in attachment fields.

## Change the name of a version of a form

To change the name of a version of a form, you need `Editor` permission on the form. If the form is the published version, then you will need permission to manage it and also [manage its origin](#manage-the-origin-of-a-form).

### Details

To manage a published form, you need `fforms:form-definition:manage` on it, which comes from `compass:edit` by default. This can be overridden in the backend configuration.

## Delete a form

To delete a form, you need `Editor` permission on the form. You will need `fforms:form-definition:manage`, which comes from `compass:edit` by default. This can be changed in backend configuration.

## Unpublish a form

To unpublish the published version of a form, you need `Editor` permission on the form. You will also need `fforms:form-definition:manage`, which comes from `compass:edit` by default. This can be changed in backend configuration.

## Manage the origin of a form

This permission is required for several different operations. Different permissions are required based on what the form is backed by:

* `fforms:form-definition:create-phonograph-form`: The form is backed by an object type
* `fforms:form-origin:manage`: The form is backed by a spreadsheet

`fforms:form-definition:create-phonograph-form` is given to members of the "Platform Administrators" group. `fforms:form-origin:manage` is given to users with `fusion:edit-document` on the backing spreadsheet. These can be changed in the Foundry Forms backend configuration.
