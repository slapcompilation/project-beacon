<!-- source: https://palantir.com/docs/foundry/api/audit-v2-resources/log-files/get-log-file-content/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Log File Content

`GET /api/v2/audit/organizations/{organizationRid}/logFiles/{logFileId}/content`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:audit-read`.

Scopes: `api:audit-read`

## Path parameters

- `organizationRid` · string · required
- `logFileId` · string · required
  "The ID of an audit log file"

## Response

- `body` · string · required

## Errors

- `GetLogFileContentPermissionDenied` (PERMISSION_DENIED) — "Could not content the LogFile."
