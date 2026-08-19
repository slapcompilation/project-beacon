<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/artifact-tables/parquet-experiment-artifact-table/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Parquet Experiment Artifact Table

`GET /api/v2/models/{modelRid}/experiments/{experimentRid}/artifactTables/{experimentArtifactTableName}/parquet`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Read raw table data from experiment artifacts in Parquet format.


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

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `body` · string · required

## Errors

- `ExperimentArtifactNotFound` (NOT_FOUND) — "The requested artifact was not found in the experiment."
- `ModelExperimentNotFound` (NOT_FOUND) — "The requested experiment was not found or the user lacks permission to access it."
- `ParquetExperimentArtifactTablePermissionDenied` (PERMISSION_DENIED) — "Could not parquet the ExperimentArtifactTable."
