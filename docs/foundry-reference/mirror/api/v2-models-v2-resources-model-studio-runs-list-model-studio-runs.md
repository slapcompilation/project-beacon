<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/model-studio-runs/list-model-studio-runs/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Model Studio Runs

`GET /api/v2/models/modelStudios/{modelStudioRid}/runs`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Lists all runs for a Model Studio.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelStudioRid` · string · required
  "The Resource Identifier (RID) of a Model Studio."

## Query parameters

- `configVersion` · integer
  "Filter runs by configuration version."
- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ListModelStudioRunsResponse` · object · required
  - `data` · list
    - `ModelStudioRun` · object · required
      - `runId` · string · required
        "A unique identifier for this run, derived from the studio, config, and build."
      - `buildRid` · string · required
        "The RID of the build associated with this run."
      - `jobRid` · string · required
        "The RID of the job associated with this run."
      - `configVersion` · integer · required
        "The configuration version used for this run."
      - `startedBy` · string · required
        "The user who started this run."
      - `startedTime` · string · required
        "When this run was started."
      - `buildStatus` · enum
        one of `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`
        "Status of the build."
      - `resolvedOutputs` · map
        "Map of alias to resolved output details (e.g., for models, contains the version RID and experiment)."
        - `OutputAlias` · string · required
          "A string alias used to identify outputs in a Model Studio configuration."
        - `ModelStudioRunOutput` · union · required
          "Resolved output details for a Model Studio run."
          - `model` · object
            "Resolved model output details for a Model Studio run."
            - `modelRid` · string · required
              "The RID of the model."
            - `modelVersionRid` · string · required
              "The RID of the model version created by this run."
            - `experimentRid` · string
              "The RID of the experiment associated with this run, if any."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ModelStudioNotFound` (NOT_FOUND) — "The requested Model Studio was not found."
- `ModelStudioConfigVersionNotFound` (NOT_FOUND) — "The requested Model Studio configuration version was not found."
