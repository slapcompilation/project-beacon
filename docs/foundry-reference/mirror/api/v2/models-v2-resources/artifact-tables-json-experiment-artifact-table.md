<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/artifact-tables/json-experiment-artifact-table/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Json Experiment Artifact Table

`GET /api/v2/models/{modelRid}/experiments/{experimentRid}/artifactTables/{experimentArtifactTableName}/json`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Read table data from an experiment artifact as a streamed binary response containing JSON.
The response body is a JSON array of row objects, where each object maps column names to values.
Results are paginated by row count with a default page size of 10 and a maximum of 100.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelRid` · string · required
  "The Resource Identifier (RID) of a Model."
- `experimentRid` · string · required
  "The Resource Identifier (RID) of an Experiment."
- `experimentArtifactTableName` · string · required
  "The name of an experiment artifact."

## Query parameters

- `pageSize` · integer
  "Maximum number of rows to return. Default is 10, maximum is 100."
- `offset` · integer
  "Number of rows to skip from the beginning. Defaults to 0."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `body` · string · required

## Errors

- `ExperimentArtifactNotFound` (NOT_FOUND) — "The requested artifact was not found in the experiment."
- `ModelExperimentNotFound` (NOT_FOUND) — "The requested experiment was not found or the user lacks permission to access it."
- `JsonExperimentArtifactTablePermissionDenied` (PERMISSION_DENIED) — "Could not json the ExperimentArtifactTable."
