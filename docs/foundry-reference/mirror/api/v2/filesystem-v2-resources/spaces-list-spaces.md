<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/spaces/list-spaces/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Spaces

`GET /api/v2/filesystem/spaces`

Lists all Spaces.

This is a paged endpoint. Each page may be smaller or larger than the requested page size. However, it is guaranteed that if there are more results available, the `nextPageToken` field will be populated. To get the next page, make the same request again, but set the value of the `pageToken` query parameter to be value of the `nextPageToken` value of the previous response. If there is no `nextPageToken` field in the response, you are on the last page.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-read`.

Scopes: `api:filesystem-read`

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListSpacesResponse` · object · required
  - `data` · list
    - `Space` · object · required
      - `rid` · string · required
        "The unique resource identifier (RID) of a Space."
      - `displayName` · string · required
        "The display name of the resource"
      - `description` · string
        "The description of the Space."
      - `path` · string · required
        "The full path to the resource, including the resource name itself"
      - `fileSystemId` · string · required
        "The ID of the Filesystem for this Space, which is where the contents of the Space are stored. If not provided, the default Filesystem for this Enrollment will be used."
      - `usageAccountRid` · string · required
        "The RID of the Usage Account for this Space. Resource usage for projects in this space will accrue to this Usage Account by default. If not provided, the default Usage Account for this Enrollment will be used."
      - `organizations` · list
        "The list of Organizations that are provisioned access to this Space. In order to access this Space, a user must be a member of at least one of these Organizations."
        - `OrganizationRid` · string · required
      - `deletionPolicyOrganizations` · list
        "By default, this Space will use a Last Out deletion policy, meaning that this Space and its projects will be deleted when the last Organization listed here is deleted. Only Organizations in the Space's Enrollment can be included here."
        - `OrganizationRid` · string · required
      - `defaultRoleSetId` · string · required
        "The ID of the default Role Set for this Space, which defines the set of roles that Projects in this Space must use. If not provided, the default Role Set for Projects will be used."
      - `spaceMavenIdentifier` · string
        "The maven identifier used as the prefix to the maven coordinate that uniquely identifies resources published from this space. This is only present if configured in control panel in the space settings."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
