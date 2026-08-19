<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/attachments/get-attachment/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Attachment

`GET /api/v2/ontologies/attachments/{attachmentRid}`

Get the metadata of an attachment.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `attachmentRid` · string · required
  "The RID of the attachment."

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
