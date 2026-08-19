<!-- source: https://palantir.com/docs/foundry/api/datasets-v2-resources/branches/get-branch/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Branch

`GET /api/v2/datasets/{datasetRid}/branches/{branchName}`

Get a Branch of a Dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `branchName` · string · required
  "The name of a Branch."

## Response

- `Branch` · object · required
  - `name` · string · required
    "The name of a Branch."
  - `transactionRid` · string
    "The most recent OPEN or COMMITTED transaction on the branch. This will never be an ABORTED transaction."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
