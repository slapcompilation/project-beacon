<!-- source: https://palantir.com/docs/foundry/api/v2/media-sets-v2-resources/media-sets/get-transformation-job-result/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Transformation Job Result

`GET /api/v2/mediasets/{mediaSetRid}/items/{mediaItemRid}/transformationJobs/{transformationJobId}/result`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets the result of a completed transformation job. Returns the transformed media content as binary data.
This endpoint will return an error if the transformation job has not completed successfully.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-transform`.

Scopes: `api:mediasets-transform`

## Path parameters

- `mediaSetRid` · string · required
  "The RID of the media set."
- `mediaItemRid` · string · required
  "The RID of the media item."
- `transformationJobId` · string · required
  "The ID of the transformation job."

## Query parameters

- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Response

- `body` · string · required
  "The transformed media content."
