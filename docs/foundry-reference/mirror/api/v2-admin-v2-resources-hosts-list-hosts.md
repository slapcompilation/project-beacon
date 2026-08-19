<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/hosts/list-hosts/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Hosts

`GET /api/v2/admin/enrollments/{enrollmentRid}/hosts`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Lists all Hosts.

This is a paged endpoint. Each page may be smaller or larger than the requested page size. However, it is guaranteed that if there are more results available, the `nextPageToken` field will be populated. To get the next page, make the same request again, but set the value of the `pageToken` query parameter to be value of the `nextPageToken` value of the previous response. If there is no `nextPageToken` field in the response, you are on the last page.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `enrollmentRid` · string · required

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ListHostsResponse` · object · required
  - `data` · list
    - `Host` · object · required
      - `hostName` · string · required
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ListHostsPermissionDenied` (PERMISSION_DENIED) — "You do not have permission to list hosts for this enrollment"
- `InvalidPageSize` (INVALID_ARGUMENT) — "The provided page size was zero or negative. Page sizes must be greater than zero."
- `EnrollmentNotFound` (NOT_FOUND) — "The given Enrollment could not be found."
