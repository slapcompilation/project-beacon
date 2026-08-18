<!-- source: https://palantir.com/docs/foundry/action-types/upload-attachments/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Upload attachments

Actions support uploading attachments from Workshop, Object Explorer, Object Views, Quiver, and Slate. Permissions to view, edit, and delete an attachment are consistent with the object to which they are uploaded. For example, if a user has view permissions to an object, they will be able to view and download attachments stored on this object. Replacing an existing attachment would require edit permissions on the object.

You can upload a single attachment or a list of attachments. To upload an attachment using actions, follow the configuration steps for both action types and object types.

## Configuring action types

In the parameter configuration view, select **Attachment** as the parameter type. Attachments can only be uploaded using attachment parameter types. The corresponding column in the object-backing dataset must be a **String** and the edited object property must be of type **Attachment**.

To upload several media files at once, select **Allow multiple values**. Note that support for several media files in one action requires an additional toggle during [object type configuration](#configuring-object-types) to **Allow multiple**, as described below.

## Configuring object types

In the object detail view, select **Attachment** as the property type. Attachments can only be uploaded to attachment property types.

To upload several media files to one property, toggle **Allow multiple**. In this case, the property in the object-backing dataset must be an **Array**.

## Architecture and limits

Attachments are immediately uploaded to Foundry once they are added to an action form. Upon form submission, permissions to view, edit, and delete an attachment are inferred from the user's permissions on the underlying object type. If form submission fails or is cancelled, the outstanding attachment is no longer directly reachable and will automatically be permanently deleted after some time. Similarly, attachments that belong to deleted objects or are no longer mapped to an object (which occurs when the corresponding property is deleted) are no longer directly reachable and will eventually automatically be permanently deleted.

Attachments are supported for both logic-backed and function-backed actions. There is a global, fixed file size limit of 200MB.

* Each attachment can be linked to a maximum of ten objects in its lifetime. If an attachment has been linked to ten objects, it cannot be linked to any other objects even if one or more of the original linked objects has been deleted. After reaching this limit of ten linked objects, you can upload the file again as a new attachment to link it to more objects.
