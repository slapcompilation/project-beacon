<!-- source: https://palantir.com/docs/foundry/api/datasets-resources/branches/get-branch/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Branch

`GET /api/v1/datasets/{datasetRid}/branches/{branchId}`

Get a Branch of a Dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of the Dataset that contains the Branch."
- `branchId` · string · required
  "The identifier (name) of the Branch."

## Response

- `Branch` · object · required
  "A Branch of a Dataset."
  - `branchId` · string · required
    "The identifier (name) of a Branch."
  - `transactionRid` · string
    "The Resource Identifier (RID) of a Transaction."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
