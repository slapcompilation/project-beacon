<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/get-attachment-property-by-rid/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Get Attachment Property By Rid

`GET /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/attachments/{property}/{attachmentRid}`

Get the metadata of a particular attachment in an attachment list.


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

- `AttachmentV2` · object · required
  "Success response."
  - `rid` · string · required
    "The unique resource identifier of an attachment."
  - `filename` · string · required
    "The name of a File within Foundry. Examples: `my-file.txt`, `my-file.jpg`, `dataframe.snappy.parquet`."
  - `sizeBytes` · string · required
    "The size of the file or attachment in bytes."
  - `mediaType` · string · required
    "The [media type](https://www.iana.org/assignments/media-types/media-types.xhtml) of the file or attachment. Examples: `application/json`, `application/pdf`, `application/octet-stream`, `image/jpeg`"
