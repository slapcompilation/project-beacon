<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/groups/list-groups/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Groups

`GET /api/v2/admin/groups`

Lists all Groups.

This is a paged endpoint. Each page may be smaller or larger than the requested page size. However, it is guaranteed that if there are more results available, the `nextPageToken` field will be populated. To get the next page, make the same request again, but set the value of the `pageToken` query parameter to be value of the `nextPageToken` value of the previous response. If there is no `nextPageToken` field in the response, you are on the last page.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListGroupsResponse` · object · required
  - `data` · list
    - `Group` · object · required
      - `id` · string · required
        "A Foundry Group ID."
      - `name` · string · required
        "The name of the Group."
      - `description` · string
        "A description of the Group."
      - `realm` · string · required
        "Identifies which Realm a User or Group is a member of. The `palantir-internal-realm` is used for Users or Groups that are created in Foundry by administrators and not associated with any SSO provider."
      - `organizations` · list
        "The RIDs of the Organizations whose members can see this group. At least one Organization RID must be listed."
        - `OrganizationRid` · string · required
      - `attributes` · map
        "A map of the Group's attributes. Attributes prefixed with "multipass:" are reserved for internal use by Foundry and are subject to change."
        - `AttributeName` · string · required
        - `AttributeValues` · list · required
          - `AttributeValue` · string · required
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `InvalidPageSize` (INVALID_ARGUMENT) — "The provided page size was zero or negative. Page sizes must be greater than zero."
