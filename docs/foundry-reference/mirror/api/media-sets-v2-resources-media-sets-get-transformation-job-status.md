<!-- source: https://palantir.com/docs/foundry/api/media-sets-v2-resources/media-sets/get-transformation-job-status/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Transformation Job Status

`GET /api/v2/mediasets/{mediaSetRid}/items/{mediaItemRid}/transformationJobs/{transformationJobId}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets the status of a transformation job.


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

- `GetTransformationJobStatusResponse` · object · required
  "The status of the transformation job."
  - `status` · enum · required
    one of `PENDING`, `FAILED`, `SUCCESSFUL`
    "The status of a transformation job."
  - `jobId` · string · required
    "An identifier for a media item transformation job."
