<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/get-attachment-property-content-by-rid/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Get Attachment Property Content By Rid

`GET /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/attachments/{property}/{attachmentRid}/content`

Get the content of an attachment by its RID.

The RID must exist in the attachment array of the property.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."
- `objectType` · string · required
  "The API name of the object type. To find the API name, use the **List object types** endpoint or check the **Ontology Manager**."
- `primaryKey` · string · required
  "The primary key of the object containing the attachment."
- `property` · string · required
  "The API name of the attachment property. To find the API name for your attachment, check the **Ontology Manager** or use the **Get object type** endpoint."
- `attachmentRid` · string · required
  "The RID of the attachment."

## Query parameters

- `sdkPackageRid` · string
  "The package rid of the generated SDK."
- `sdkVersion` · string
  "The version of the generated SDK."
- `branch` · string
  "The Foundry branch to read from. If not specified, the default branch will be used."

## Response

- `body` · string · required
  "Success response."
