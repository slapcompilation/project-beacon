<!-- source: https://palantir.com/docs/foundry/api/v2/connectivity-v2-resources/connections/update-export-settings-for-connection/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Update Export Settings For Connection

`POST /api/v2/connectivity/connections/{connectionRid}/updateExportSettings`

Updates the [export settings on the Connection.](/docs/foundry/data-connection/export-overview/#enable-exports-for-source)
Only users with Information Security Officer role can modify the export settings.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:connectivity-connection-write`.

Scopes: `api:connectivity-connection-write`

## Path parameters

- `connectionRid` · string · required
  "The Resource Identifier (RID) of a Connection (also known as a source)."

## Request

- `UpdateExportSettingsForConnectionRequest` · object · required
  - `exportSettings` · object · required
    "The [export settings of a Connection](/docs/foundry/data-connection/export-overview/#enable-exports-for-source)."
    - `exportsEnabled` · boolean · required
      "Allow exporting datasets from Foundry to this Connection."
    - `exportEnabledWithoutMarkingsValidation` · boolean · required
      "In certain interactive workflows the Connection can be used in, it is not currently possible to validate the security markings of the data being exported. By enabling exports without markings validation, you acknowledge that you are responsible for ensuring that the data being exported is compliant with your organization's policies."

## Errors

- `UpdateExportSettingsForConnectionPermissionDenied` (PERMISSION_DENIED) — "Could not updateExportSettings the Connection."
- `ConnectionNotFound` (NOT_FOUND) — "The given Connection could not be found."
