<!-- source: https://palantir.com/docs/foundry/api/v2/connectivity-v2-resources/table-imports/execute-table-import/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Execute Table Import

`POST /api/v2/connectivity/connections/{connectionRid}/tableImports/{tableImportRid}/execute`

Executes the TableImport, which runs asynchronously as a [Foundry Build](/docs/foundry/data-integration/builds/).
The returned BuildRid can be used to check the status via the Orchestration API.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:connectivity-table-import-execute`.

Scopes: `api:connectivity-table-import-execute`

## Path parameters

- `connectionRid` · string · required
  "The Resource Identifier (RID) of a Connection (also known as a source)."
- `tableImportRid` · string · required
  "The Resource Identifier (RID) of a TableImport (also known as a batch sync)."

## Response

- `BuildRid` · string · required
  "The RID of a Build."

## Errors

- `ExecuteTableImportPermissionDenied` (PERMISSION_DENIED) — "Could not execute the TableImport."
- `TableImportNotFound` (NOT_FOUND) — "The given TableImport could not be found."
