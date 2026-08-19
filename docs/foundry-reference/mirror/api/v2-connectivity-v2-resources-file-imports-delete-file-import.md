<!-- source: https://palantir.com/docs/foundry/api/v2/connectivity-v2-resources/file-imports/delete-file-import/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Delete File Import

`DELETE /api/v2/connectivity/connections/{connectionRid}/fileImports/{fileImportRid}`

Delete the FileImport with the specified RID.
Deleting the file import does not delete the destination dataset but the dataset will no longer
be updated by this import.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:connectivity-file-import-write`.

Scopes: `api:connectivity-file-import-write`

## Path parameters

- `connectionRid` · string · required
  "The Resource Identifier (RID) of a Connection (also known as a source)."
- `fileImportRid` · string · required
  "The Resource Identifier (RID) of a FileImport (also known as a batch sync)."

## Errors

- `DeleteFileImportPermissionDenied` (PERMISSION_DENIED) — "Could not delete the FileImport."
- `FileImportNotFound` (NOT_FOUND) — "The given FileImport could not be found."
