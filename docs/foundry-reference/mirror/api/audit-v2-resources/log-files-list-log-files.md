<!-- source: https://palantir.com/docs/foundry/api/audit-v2-resources/log-files/list-log-files/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Log Files

`GET /api/v2/audit/organizations/{organizationRid}/logFiles`

Lists all LogFiles.

This is a paged endpoint. Each page may be smaller or larger than the requested page size. However, it is guaranteed that if there are more results available, the `nextPageToken` field will be populated. To get the next page, make the same request again, but set the value of the `pageToken` query parameter to be value of the `nextPageToken` value of the previous response. If there is no `nextPageToken` field in the response, you are on the last page.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:audit-read`.

Scopes: `api:audit-read`

## Path parameters

- `organizationRid` · string · required

## Query parameters

- `startDate` · string
  "List log files for audit events starting from this date. This parameter is required for the initial request (when `pageToken` is not provided)."
- `endDate` · string
  "List log files for audit events up until this date (inclusive). If absent, defaults to no end date. Use the returned `nextPageToken` to continually poll the  `listLogFiles` endpoint to list the latest available logs."
- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListLogFilesResponse` · object · required
  - `data` · list
    - `LogFile` · object · required
      - `id` · string · required
        "The ID of an audit log file"
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ListLogFilesPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to list audit log files."
- `MissingStartDate` (INVALID_ARGUMENT) — "Start date is required to list audit log files."
