<!-- source: https://palantir.com/docs/foundry/api/v2/connectivity-v2-resources/table-imports/delete-table-import/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Delete Table Import

`DELETE /api/v2/connectivity/connections/{connectionRid}/tableImports/{tableImportRid}`

Delete the TableImport with the specified RID.
Deleting the table import does not delete the destination dataset but the dataset will no longer
be updated by this import.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:connectivity-table-import-write`.

Scopes: `api:connectivity-table-import-write`

## Path parameters

- `connectionRid` · string · required
  "The Resource Identifier (RID) of a Connection (also known as a source)."
- `tableImportRid` · string · required
  "The Resource Identifier (RID) of a TableImport (also known as a batch sync)."

## Errors

- `DeleteTableImportPermissionDenied` (PERMISSION_DENIED) — "Could not delete the TableImport."
- `TableImportNotFound` (NOT_FOUND) — "The given TableImport could not be found."
