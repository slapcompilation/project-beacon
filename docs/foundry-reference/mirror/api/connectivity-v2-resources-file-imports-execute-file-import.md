<!-- source: https://palantir.com/docs/foundry/api/connectivity-v2-resources/file-imports/execute-file-import/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Execute File Import

`POST /api/v2/connectivity/connections/{connectionRid}/fileImports/{fileImportRid}/execute`

Executes the FileImport, which runs asynchronously as a [Foundry Build](/docs/foundry/data-integration/builds/).
The returned BuildRid can be used to check the status via the Orchestration API.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:connectivity-file-import-execute`.

Scopes: `api:connectivity-file-import-execute`

## Path parameters

- `connectionRid` · string · required
  "The Resource Identifier (RID) of a Connection (also known as a source)."
- `fileImportRid` · string · required
  "The Resource Identifier (RID) of a FileImport (also known as a batch sync)."

## Response

- `BuildRid` · string · required
  "The RID of a Build."

## Errors

- `ExecuteFileImportPermissionDenied` (PERMISSION_DENIED) — "Could not execute the FileImport."
- `FileImportNotFound` (NOT_FOUND) — "The given FileImport could not be found."
