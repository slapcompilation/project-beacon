<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/attachments/get-attachment-content/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Attachment Content

`GET /api/v2/ontologies/attachments/{attachmentRid}/content`

Get the content of an attachment.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `attachmentRid` · string · required
  "The RID of the attachment."

## Response

- `body` · string · required
  "Success response."
