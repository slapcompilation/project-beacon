<!-- source: https://palantir.com/docs/foundry/api/v1/ontology-resources/attachments/upload-attachment/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Upload Attachment

`POST /api/v1/attachments/upload`

Upload an attachment to use in an action. Any attachment which has not been linked to an object via
an action within one hour after upload will be removed.
Previously mapped attachments which are not connected to any object anymore are also removed on
a biweekly basis.
The body of the request must contain the binary content of the file and the `Content-Type` header must be `application/octet-stream`.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-write`.

Scopes: `api:ontologies-write`

## Query parameters

- `filename` · string · required
  "The name of the file being uploaded."

## Request

- `body` · string · required

## Response

- `Attachment` · object · required
  "Success response."
  - `rid` · string · required
    "The unique resource identifier of an attachment."
  - `filename` · string · required
    "The name of a File within Foundry. Examples: `my-file.txt`, `my-file.jpg`, `dataframe.snappy.parquet`."
  - `sizeBytes` · string · required
    "The size of the file or attachment in bytes."
  - `mediaType` · string · required
    "The [media type](https://www.iana.org/assignments/media-types/media-types.xhtml) of the file or attachment. Examples: `application/json`, `application/pdf`, `application/octet-stream`, `image/jpeg`"
